"""Stoppable screening workers for the single-process local API.

CPU inference runs in a child process so cancellation stops computation, not just
the HTTP response. Completed stages commit normally and remain readable.
"""
import asyncio
import logging
import multiprocessing
import queue
import time

logger = logging.getLogger(__name__)
CANCELLED = "Screening cancelled by patient."


def worker(screening_id, patient_id, user_id, image, filename, mime, events):
    asyncio.run(_run(screening_id, patient_id, user_id, image, filename, mime, events))


async def _run(screening_id, patient_id, user_id, image, filename, mime, events):
    from app.core.config import get_settings
    from app.db.session import get_session_factory, dispose_engine
    from app.models.user import User
    from app.services.screening_service import ScreeningService
    from app.services.ai_inference_service import AIInferenceService
    from app.services.xai_service import XAIService
    from app.services.risk_assessment_service import RiskAssessmentService
    from app.services.report_service import ReportService

    get_settings().debug = False
    factory = get_session_factory()
    completed = 0
    warnings = []

    def emit(description, status="running"):
        events.put(dict(status=status, completed_steps=completed, description=description, warnings=list(warnings)))

    try:
        emit("Uploading and validating your oral image.")
        async with factory() as db:
            existing = await ScreeningService.get_patient_screening(db, patient_id, screening_id)
            if not existing.images:
                await ScreeningService.attach_screening_image(db, patient_id, screening_id, image, filename, mime)
        completed = 1
        emit("Image saved. Analysing the image for screening findings.")
        async with factory() as db:
            await AIInferenceService.run_screening_inference(db, patient_id, screening_id)
        completed = 2
        emit("Analysis ready. Creating your visual explanation.")
        # Optional outputs fail independently so the report includes everything
        # successfully produced, rather than hiding an otherwise valid analysis.
        for name, operation in [
            ("Visual explanation", lambda db, user: XAIService.generate_screening_xai(db, patient_id, screening_id)),
            ("Next-step guidance", lambda db, user: RiskAssessmentService.assess_screening(db, user, screening_id)),
            ("PDF report", lambda db, user: ReportService.generate_screening_report(db, user, screening_id)),
        ]:
            emit(f"Analysis ready. Generating {name.lower()}.")
            try:
                async with factory() as db:
                    user = await db.get(User, user_id)
                    output = await operation(db, user)
                    if name == 'Visual explanation' and not output.total_results:
                        warnings.append('Visual explanation is unavailable. Other saved results are available.')
            except Exception:
                logger.exception("Screening output failed: %s", name)
                warnings.append(f"{name} could not be generated. Other saved results are available.")
        completed = 3
        emit("Screening finished. All available results have been saved.", "completed")
    except Exception as exc:
        logger.exception("Screening workflow failed")
        message = str(exc) if isinstance(exc, (ValueError, LookupError, RuntimeError)) else "Screening stopped because the server could not complete this step. Saved results remain available."
        from app.models.screening import Screening
        async with factory() as db:
            screening = await db.get(Screening, screening_id)
            if screening:
                screening.status = 'failed'
                screening.error_message = message
                await db.commit()
        emit(message, "failed")
    finally:
        await dispose_engine()


class WorkflowRegistry:
    def __init__(self):
        self.jobs = {}
        self.context = multiprocessing.get_context("spawn")

    def start(self, screening_id, patient_id, user_id, image, filename, mime):
        key = str(screening_id)
        if key in self.jobs:
            return self.status(key)
        # Bound in-memory history and simultaneous model processes.
        for old_key, job in list(self.jobs.items()):
            if time.monotonic() - job["created"] > 3600 and job["state"]["status"] != "running":
                job["events"].close() if job["events"] else None
                del self.jobs[old_key]
        if sum(self.status(k)["status"] == "running" for k in self.jobs) >= 2:
            raise ValueError("Two screenings are already running. Please try again shortly.")
        events = self.context.Queue()
        process = self.context.Process(target=worker, args=(screening_id, patient_id, user_id, image, filename, mime, events), daemon=True)
        state = dict(status="running", completed_steps=0, description="Preparing your image upload.", warnings=[])
        self.jobs[key] = dict(process=process, events=events, state=state, created=time.monotonic())
        try:
            process.start()
        except Exception:
            del self.jobs[key]
            events.close()
            raise
        return dict(state)

    def status(self, screening_id):
        job = self.jobs.get(str(screening_id))
        if not job:
            return None
        if job["events"] and job["state"]["status"] != "cancelled":
            while True:
                try:
                    job["state"] = job["events"].get_nowait()
                except queue.Empty:
                    break
        process = job["process"]
        if process and process.exitcode is not None and job["state"]["status"] == "running":
            job["state"].update(status="failed", description="The screening worker stopped. Saved results remain available.")
        return dict(job["state"])

    async def cancel(self, screening_id):
        key = str(screening_id)
        state = self.status(key) or dict(completed_steps=0, warnings=[])
        if state.get("status") in ("completed", "failed"):
            return state
        # A tombstone also prevents a late upload request from starting a worker.
        job = self.jobs.setdefault(key, dict(process=None, events=None, state=state, created=time.monotonic()))
        job["state"] = dict(state, status="cancelled", description="Screening cancelled. Saved results remain available.")
        process = job["process"]
        if process and process.is_alive():
            process.terminate()
            await asyncio.to_thread(process.join, 5)
            if process.is_alive():
                process.kill()
                await asyncio.to_thread(process.join)
        return dict(job["state"])

    async def shutdown(self):
        for key in list(self.jobs):
            await self.cancel(key)


workflows = WorkflowRegistry()
