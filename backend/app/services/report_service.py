"""
OraVisionAI — Clinical Report Domain Service

Orchestrates clinical report generation, historical diagnostic snapshot assembly,
unique report number assignment, ReportLab PDF rendering, cloud storage upload,
multi-role access authorization (Patient, Dentist, Admin), and immutable audit logging.
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_prediction import AIPrediction
from app.models.audit_log import AuditLog
from app.models.dentist import Dentist
from app.models.dentist_assessment import DentistAssessment
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.prediction_probability import PredictionProbability
from app.models.report import Report
from app.models.risk_assessment import RiskAssessment
from app.models.screening import Screening
from app.models.screening_image import ScreeningImage
from app.models.user import User
from app.models.xai_result import XAIResult
from app.models.yolo_detection import YOLODetection
from app.schemas.report import ReportResponse, ReportSummaryResponse
from app.services.pdf_report_renderer import PDFReportRenderer
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)


def generate_report_number() -> str:
    """
    Generates a unique, collision-resistant clinical report identifier.
    Format: RPT-YYYYMMDD-XXXXXX (e.g. RPT-20260901-A4F98B)
    """
    today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
    random_hex = uuid.uuid4().hex[:6].upper()
    return f"RPT-{today_str}-{random_hex}"


class ReportService:
    """Consolidated clinical report domain service."""

    @staticmethod
    async def verify_user_report_access(
        db: AsyncSession,
        user: User,
        screening: Screening,
    ) -> bool:
        """
        Verifies whether the authenticated user has legitimate clinical authority to view the report.
        - Patient: Must own the screening (screening.patient_id == patient.id)
        - Dentist: Must have an active PatientDentistRelationship with the patient
        - Admin: Full oversight access
        """
        if user.role == "admin":
            return True

        if user.role == "patient":
            stmt = select(Patient).where(Patient.user_id == user.id)
            patient = (await db.execute(stmt)).scalar_one_or_none()
            if patient and patient.id == screening.patient_id:
                return True
            return False

        if user.role == "dentist":
            stmt_dentist = select(Dentist).where(Dentist.user_id == user.id)
            dentist = (await db.execute(stmt_dentist)).scalar_one_or_none()
            if not dentist:
                return False

            stmt_rel = select(PatientDentistRelationship).where(
                PatientDentistRelationship.patient_id == screening.patient_id,
                PatientDentistRelationship.dentist_id == dentist.id,
                PatientDentistRelationship.status == "active",
            )
            rel = (await db.execute(stmt_rel)).scalar_one_or_none()
            return rel is not None

        return False

    @staticmethod
    def build_report_snapshot(
        screening: Screening,
        patient: Optional[Patient] = None,
        report_title: str = "Oral Health AI Screening Report",
        report_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Assembles a comprehensive, frozen diagnostic snapshot for the screening session.
        """
        # 1. Primary AI Prediction & Probabilities
        primary_pred_dict: Dict[str, Any] = {}
        if screening.ai_predictions:
            pred: AIPrediction = screening.ai_predictions[0]
            prob_items: List[Dict[str, Any]] = []
            if getattr(pred, "probabilities", None):
                for p in sorted(pred.probabilities, key=lambda x: x.class_index):
                    prob_items.append({
                        "class_index": p.class_index,
                        "class_name": p.class_name,
                        "class_code": p.class_name[:3].upper(),
                        "probability": float(p.probability),
                    })
            primary_pred_dict = {
                "id": str(pred.id),
                "predicted_class": pred.predicted_class,
                "confidence": float(pred.confidence),
                "inference_duration_ms": pred.inference_duration_ms,
                "model_name": "OravisionAI_7Teeth_EfficientNetB0",
                "model_version": "v1.0",
                "probabilities": prob_items,
            }

        # 2. YOLO Detections
        detections_list: List[Dict[str, Any]] = []
        if getattr(screening, "yolo_detections", None):
            for d in screening.yolo_detections:
                detections_list.append({
                    "id": str(d.id),
                    "class_name": d.detected_class,
                    "confidence": float(d.confidence),
                    "bbox": {
                        "x_min": float(d.bbox_x_min),
                        "y_min": float(d.bbox_y_min),
                        "x_max": float(d.bbox_x_max),
                        "y_max": float(d.bbox_y_max),
                    },
                })

        # 3. XAI Visual Explanations
        xai_list: List[Dict[str, Any]] = []
        for pred in screening.ai_predictions:
            if getattr(pred, "xai_results", None):
                for x in pred.xai_results:
                    xai_list.append({
                        "id": str(x.id),
                        "method": x.method,
                        "target_layer": x.target_layer,
                        "is_primary_user_facing": x.is_primary_user_facing,
                        "heatmap_storage_path": x.heatmap_storage_path,
                        "overlay_image_storage_path": x.overlay_image_storage_path,
                    })

        # 4. Risk Assessment
        risk_dict: Optional[Dict[str, Any]] = None
        if getattr(screening, "risk_assessment", None) and screening.risk_assessment:
            ra: RiskAssessment = screening.risk_assessment
            risk_dict = {
                "risk_level": ra.risk_level,
                "risk_score": float(ra.risk_score),
                "summary": ra.summary,
                "recommended_action": ra.recommended_action,
            }

        # 5. Dentist Clinical Assessments
        dentist_evals: List[Dict[str, Any]] = []
        if getattr(screening, "dentist_assessments", None):
            for da in screening.dentist_assessments:
                dentist_evals.append({
                    "id": str(da.id),
                    "clinical_observations": da.clinical_observations,
                    "diagnosis_notes": da.diagnosis_notes,
                    "treatment_recommendation": da.treatment_recommendation,
                    "referral_needed": da.referral_needed,
                    "referral_specialty": da.referral_specialty,
                    "is_finalized": da.is_finalized,
                })

        # 6. Patient Profile
        patient_dict: Dict[str, Any] = {}
        if patient:
            patient_dict = {
                "id": str(patient.id),
                "first_name": patient.user.first_name if patient.user else "",
                "last_name": patient.user.last_name if patient.user else "",
                "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
                "gender": patient.gender,
            }

        snapshot: Dict[str, Any] = {
            "report_number": report_number or generate_report_number(),
            "report_title": report_title,
            "screening_date": screening.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if screening.created_at else datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
            "screening_status": screening.status,
            "total_images": len(screening.images) if screening.images else 0,
            "patient": patient_dict,
            "screening": {
                "id": str(screening.id),
                "clinical_notes": screening.clinical_notes,
            },
            "primary_prediction": primary_pred_dict,
            "detections": detections_list,
            "xai_results": xai_list,
            "risk_assessment": risk_dict,
            "dentist_assessments": dentist_evals,
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        return snapshot

    @classmethod
    async def generate_screening_report(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
        force_regenerate: bool = False,
        report_title: str = "Oral Health AI Screening Report",
    ) -> Report:
        """
        Generates or reuses a consolidated clinical report and PDF document for a screening.
        Enforces authorization, creates frozen snapshot, renders PDF, uploads to storage, and persists Report.
        """
        # 1. Fetch full screening graph
        stmt = (
            select(Screening)
            .where(
                Screening.id == screening_id,
                Screening.is_deleted.is_(False),
            )
            .options(
                selectinload(Screening.images),
                selectinload(Screening.ai_predictions).selectinload(AIPrediction.probabilities),
                selectinload(Screening.ai_predictions).selectinload(AIPrediction.xai_results),
                selectinload(Screening.yolo_detections),
                selectinload(Screening.risk_assessment),
                selectinload(Screening.dentist_assessments),
                selectinload(Screening.report),
                selectinload(Screening.patient).selectinload(Patient.user),
            )
        )
        result = await db.execute(stmt)
        screening = result.scalar_one_or_none()

        if screening is None:
            raise LookupError(f"Screening '{screening_id}' not found.")

        # 2. Check clinical access authority
        has_access = await cls.verify_user_report_access(db, user, screening)
        if not has_access:
            raise PermissionError("User is not authorized to generate or access clinical reports for this screening.")

        # 3. Check for existing report (Idempotency)
        if screening.report and not force_regenerate:
            logger.info("Reusing existing report %s for screening %s", screening.report.report_number, screening_id)
            return screening.report

        # 4. Generate Report Number & Assemble Snapshot
        report_num = screening.report.report_number if screening.report else generate_report_number()
        snapshot = cls.build_report_snapshot(
            screening=screening,
            patient=screening.patient,
            report_title=report_title,
            report_number=report_num,
        )

        # 5. Render PDF bytes via ReportLab
        pdf_bytes = PDFReportRenderer.render_pdf(snapshot)

        # 6. Upload PDF to Firebase Storage
        pdf_storage_path = StorageService.upload_report_pdf(
            pdf_bytes=pdf_bytes,
            patient_id=screening.patient_id,
            screening_id=screening.id,
            report_number=report_num,
        )

        # 7. Generate clinical summary text
        pred_class = snapshot.get("primary_prediction", {}).get("predicted_class", "Undetermined")
        conf_val = float(snapshot.get("primary_prediction", {}).get("confidence", 0.0)) * 100
        summary_text = (
            f"Oral health screening analysis completed. AI model classification: {pred_class} ({conf_val:.1f}% confidence). "
            f"Total images evaluated: {snapshot.get('total_images', 1)}. Clinical professional review pending."
        )

        # 8. Upsert Report Record in PostgreSQL
        if screening.report:
            report_record = screening.report
            report_record.report_title = report_title
            report_record.summary = summary_text
            report_record.report_data = snapshot
            report_record.pdf_storage_path = pdf_storage_path
            report_record.generated_by_id = user.id
        else:
            report_record = Report(
                id=uuid.uuid4(),
                screening_id=screening.id,
                report_number=report_num,
                generated_by_id=user.id,
                report_title=report_title,
                summary=summary_text,
                report_data=snapshot,
                pdf_storage_path=pdf_storage_path,
                created_at=datetime.datetime.now(datetime.timezone.utc),
                updated_at=datetime.datetime.now(datetime.timezone.utc),
            )
            db.add(report_record)

        # 9. Record Audit Log
        audit_entry = AuditLog(
            user_id=user.id,
            action="REPORT_GENERATED",
            resource_type="report",
            resource_id=report_num,
            details={
                "screening_id": str(screening.id),
                "patient_id": str(screening.patient_id),
                "report_number": report_num,
                "force_regenerate": force_regenerate,
            },
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(report_record)
        logger.info("Successfully persisted clinical report %s for screening %s", report_num, screening.id)

        return report_record

    @classmethod
    async def get_screening_report(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
    ) -> Report:
        """
        Retrieves the report for a screening session with authorization checking and audit logging.
        """
        stmt = (
            select(Screening)
            .where(Screening.id == screening_id, Screening.is_deleted.is_(False))
            .options(selectinload(Screening.report))
        )
        screening = (await db.execute(stmt)).scalar_one_or_none()

        if screening is None:
            raise LookupError(f"Clinical report for screening '{screening_id}' not found.")

        has_access = await cls.verify_user_report_access(db, user, screening)
        if not has_access:
            raise PermissionError("User is not authorized to view this clinical report.")

        if screening.report is None:
            raise LookupError(f"Clinical report for screening '{screening_id}' not found.")

        # Log viewing event
        audit_entry = AuditLog(
            user_id=user.id,
            action="REPORT_VIEWED",
            resource_type="report",
            resource_id=screening.report.report_number,
            details={"screening_id": str(screening.id)},
        )
        db.add(audit_entry)
        await db.commit()

        return screening.report

    @classmethod
    async def get_report_by_id(
        cls,
        db: AsyncSession,
        user: User,
        report_id: uuid.UUID,
    ) -> Report:
        """
        Retrieves a report by its primary UUID with authorization checking and audit logging.
        """
        stmt = (
            select(Report)
            .where(Report.id == report_id)
            .options(selectinload(Report.screening))
        )
        report = (await db.execute(stmt)).scalar_one_or_none()

        if report is None:
            raise LookupError(f"Report '{report_id}' not found.")

        has_access = await cls.verify_user_report_access(db, user, report.screening)
        if not has_access:
            raise PermissionError("User is not authorized to view this clinical report.")

        audit_entry = AuditLog(
            user_id=user.id,
            action="REPORT_VIEWED",
            resource_type="report",
            resource_id=report.report_number,
            details={"report_id": str(report.id)},
        )
        db.add(audit_entry)
        await db.commit()

        return report

    @classmethod
    async def get_report_pdf_bytes(
        cls,
        db: AsyncSession,
        user: User,
        report_id: uuid.UUID,
    ) -> Tuple[bytes, str]:
        """
        Downloads and returns the PDF binary data for an authorized user along with filename.
        """
        report = await cls.get_report_by_id(db, user, report_id)

        if not report.pdf_storage_path:
            raise LookupError("PDF document has not been compiled for this report.")

        pdf_bytes = StorageService.download_report_pdf(report.pdf_storage_path)

        audit_entry = AuditLog(
            user_id=user.id,
            action="REPORT_DOWNLOADED",
            resource_type="report",
            resource_id=report.report_number,
            details={"report_id": str(report.id), "storage_path": report.pdf_storage_path},
        )
        db.add(audit_entry)
        await db.commit()

        safe_filename = f"{report.report_number}.pdf"
        return pdf_bytes, safe_filename
