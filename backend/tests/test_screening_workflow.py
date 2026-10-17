import asyncio
import time
import unittest
import queue
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from app.services.screening_workflow import WorkflowRegistry, _run


class WorkflowCancellationTests(unittest.IsolatedAsyncioTestCase):
    async def test_optional_output_failure_still_generates_report_and_keeps_findings(self):
        from app.db import session
        from app.services.screening_service import ScreeningService
        from app.services.ai_inference_service import AIInferenceService
        from app.services.xai_service import XAIService
        from app.services.risk_assessment_service import RiskAssessmentService
        from app.services.report_service import ReportService

        class FakeSession:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def get(self, *args): return SimpleNamespace(id='user')

        events = queue.Queue()
        report = AsyncMock()
        with patch.object(session, 'get_session_factory', return_value=FakeSession), \
             patch.object(session, 'dispose_engine', new=AsyncMock()), \
             patch.object(ScreeningService, 'get_patient_screening', new=AsyncMock(return_value=SimpleNamespace(images=[]))), \
             patch.object(ScreeningService, 'attach_screening_image', new=AsyncMock()), \
             patch.object(AIInferenceService, 'run_screening_inference', new=AsyncMock()), \
             patch.object(XAIService, 'generate_screening_xai', new=AsyncMock(side_effect=RuntimeError('XAI unavailable'))), \
             patch.object(RiskAssessmentService, 'assess_screening', new=AsyncMock()), \
             patch.object(ReportService, 'generate_screening_report', new=report), \
             self.assertLogs('app.services.screening_workflow', level='ERROR'):
            await _run('screening', 'patient', 'user', b'image', 'oral.jpg', 'image/jpeg', events)
        states = []
        while not events.empty(): states.append(events.get())
        self.assertTrue(any(s['completed_steps'] == 2 for s in states))
        self.assertEqual(states[-1]['status'], 'completed')
        self.assertEqual(states[-1]['completed_steps'], 3)
        self.assertIn('Other saved results', states[-1]['warnings'][0])
        report.assert_awaited_once()

    async def test_only_the_patient_owner_can_manage_the_workflow(self):
        from fastapi import HTTPException
        from app.api.screenings import workflow_screening
        from app.services.patient_service import PatientService
        from app.services.screening_service import ScreeningService
        lookup = AsyncMock(return_value=None)
        with patch.object(PatientService, 'get_patient_by_user_id', new=AsyncMock(return_value=SimpleNamespace(id='authenticated-patient'))), \
             patch.object(ScreeningService, 'get_patient_screening', new=lookup):
            with self.assertRaises(HTTPException) as error:
                await workflow_screening('db', SimpleNamespace(id='authenticated-user'), 'someone-elses-screening')
        self.assertEqual(error.exception.status_code, 404)
        lookup.assert_awaited_once_with('db', 'authenticated-patient', 'someone-elses-screening')

    async def test_cancelling_kills_computation_and_preserves_completed_steps(self):
        registry = WorkflowRegistry()
        process = registry.context.Process(target=time.sleep, args=(60,))
        process.start()
        registry.jobs['screening'] = dict(
            process=process, events=None, created=time.monotonic(),
            state=dict(status='running', completed_steps=2, description='Generating report', warnings=[]),
        )
        try:
            result = await registry.cancel('screening')
            self.assertEqual(result['status'], 'cancelled')
            self.assertEqual(result['completed_steps'], 2)
            self.assertFalse(process.is_alive())
            self.assertEqual(registry.status('screening')['status'], 'cancelled')
        finally:
            if process.is_alive():
                process.kill()
                process.join()
            process.close()

    async def test_cancel_before_upload_prevents_late_start(self):
        registry = WorkflowRegistry()
        await registry.cancel('screening')
        result = registry.start('screening', None, None, b'image', 'oral.jpg', 'image/jpeg')
        self.assertEqual(result['status'], 'cancelled')
        self.assertIsNone(registry.jobs['screening']['process'])

    async def test_unpolled_finished_jobs_do_not_consume_worker_capacity(self):
        registry = WorkflowRegistry()
        for key in ('first', 'second'):
            events = queue.Queue()
            events.put(dict(status='completed', completed_steps=3, description='Ready', warnings=[]))
            registry.jobs[key] = dict(process=SimpleNamespace(exitcode=0), events=events, created=time.monotonic(), state=dict(status='running', completed_steps=2, description='Report', warnings=[]))
        registry.context = SimpleNamespace(Queue=queue.Queue, Process=lambda **kwargs: SimpleNamespace(start=lambda: None, exitcode=None))
        self.assertEqual(registry.start('third', None, None, b'image', 'oral.jpg', 'image/jpeg')['status'], 'running')

    async def test_finished_results_are_not_marked_cancelled(self):
        registry = WorkflowRegistry()
        registry.jobs['screening'] = dict(process=None, events=None, created=time.monotonic(), state=dict(status='completed', completed_steps=3, description='Ready', warnings=[]))
        self.assertEqual((await registry.cancel('screening'))['status'], 'completed')

    async def test_crashed_worker_is_reported_as_failed(self):
        registry = WorkflowRegistry()
        process = registry.context.Process(target=time.sleep, args=(0,))
        process.start()
        await asyncio.to_thread(process.join)
        registry.jobs['screening'] = dict(process=process, events=None, created=time.monotonic(), state=dict(status='running', completed_steps=1, description='Analysis', warnings=[]))
        try:
            self.assertEqual(registry.status('screening')['status'], 'failed')
        finally:
            process.close()


if __name__ == '__main__':
    unittest.main()
