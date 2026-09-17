"""
OraVisionAI — Dentist Assessment Domain Service

Manages the clinical lifecycle of professional dentist assessments:
1. Multi-role authorization (verified dentist with active patient relationship, patient owner, admin)
2. Clinical review package aggregation (screening, oral images, AI classification, YOLO, XAI, risk)
3. Clinical assessment creation (observations, diagnosis notes, treatment recommendations, referrals)
4. Draft vs. finalization lifecycle (drafts are editable, finalized assessments are permanently locked)
5. Immutable compliance audit logging (DENTIST_ASSESSMENT_CREATED, VIEWED, UPDATED)
6. Strict separation of professional clinical opinions from automated AI inferences
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, select
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_prediction import AIPrediction
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.dentist import Dentist
from app.models.dentist_assessment import DentistAssessment
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.screening import Screening
from app.models.user import User
from app.schemas.dentist_assessment import (
    DentistAssessmentCreate,
    DentistAssessmentResponse,
    DentistAssessmentUpdate,
    DentistPendingReviewItem,
    DentistPendingReviewListResponse,
    ScreeningReviewRequest,
    ScreeningReviewResponse,
)
from app.schemas.screening import ScreeningImageResponse
from app.services.ai_inference_service import EFFICIENTNET_CLASS_MAPPING
from app.services.notification_service import NotificationService
from app.services.patient_service import PatientService

logger = logging.getLogger(__name__)


class DentistAssessmentService:
    """Domain service encapsulating dentist assessment creation, retrieval, and revision."""

    # =========================================================================
    # Authorization & Relationship Guards
    # =========================================================================

    @classmethod
    async def verify_dentist_clinical_access(
        cls,
        db: AsyncSession,
        user: User,
        screening: Screening,
    ) -> Dentist:
        """
        Verifies that the authenticated user:
        1. Holds the 'dentist' role.
        2. Has an active profile with verification_status == 'approved'.
        3. Maintains an active PatientDentistRelationship (status == 'active') with the patient.
        """
        if user.role != "dentist":
            logger.warning("Access denied: User %s has role '%s', required 'dentist'", user.id, user.role)
            raise PermissionError("Access denied: Only dentists may perform this action.")

        stmt = select(Dentist).where(Dentist.user_id == user.id)
        res = await db.execute(stmt)
        dentist = res.scalar_one_or_none()

        if dentist is None:
            logger.warning("Access denied: Dentist profile not found for user %s", user.id)
            raise PermissionError("Access denied: Dentist profile not found.")

        if dentist.verification_status != "approved":
            logger.warning(
                "Access denied: Dentist %s has verification status '%s' (required 'approved')",
                dentist.id,
                dentist.verification_status,
            )
            raise PermissionError(
                f"Access denied: Dentist account is not verified/approved (status: '{dentist.verification_status}')."
            )

        # Check explicit active patient-dentist relationship
        rel_stmt = select(PatientDentistRelationship).where(
            PatientDentistRelationship.patient_id == screening.patient_id,
            PatientDentistRelationship.dentist_id == dentist.id,
            PatientDentistRelationship.status == "active",
        )
        rel_res = await db.execute(rel_stmt)
        rel = rel_res.scalar_one_or_none()

        if rel is None:
            logger.warning(
                "Access denied: No active relationship between dentist %s and patient %s",
                dentist.id,
                screening.patient_id,
            )
            raise PermissionError("Access denied: No active relationship exists with this patient.")

        # Verify case-level clinical authorization:
        # Dentist must have an assigned review/assessment OR an appointment specifically linked to this screening
        stmt_da = select(DentistAssessment).where(
            and_(
                DentistAssessment.screening_id == screening.id,
                DentistAssessment.dentist_id == dentist.id,
            )
        )
        has_assessment = (await db.execute(stmt_da)).scalar_one_or_none() is not None

        stmt_appt = select(Appointment).where(
            and_(
                Appointment.screening_id == screening.id,
                Appointment.dentist_id == dentist.id,
            )
        )
        has_appt = (await db.execute(stmt_appt)).scalars().first() is not None

        if not (has_assessment or has_appt):
            logger.warning(
                "Access denied: Dentist %s is not authorized for screening %s (no assigned review or linked appointment)",
                dentist.id,
                screening.id,
            )
            raise PermissionError("Access denied: You are not authorized to evaluate this screening session.")

        return dentist

    @classmethod
    async def verify_assessment_view_access(
        cls,
        db: AsyncSession,
        user: User,
        screening: Screening,
    ) -> None:
        """
        Validates read authority for screening assessments:
        - Patient: Must own the screening session.
        - Dentist: Must be approved and have an active relationship with the patient.
        - Admin: Permitted for regulatory compliance and oversight.
        """
        if user.role == "patient":
            patient = await PatientService.get_patient_by_user_id(db, user.id)
            if not patient or patient.id != screening.patient_id:
                logger.warning("Access denied: Patient %s does not own screening %s", user.id, screening.id)
                raise PermissionError("Access denied: You do not own this screening session.")
        elif user.role == "dentist":
            await cls.verify_dentist_clinical_access(db, user, screening)
        elif user.role == "admin":
            # Administrative oversight permitted
            pass
        else:
            raise PermissionError(f"Access denied: Role '{user.role}' is not authorized to view clinical assessments.")

    # =========================================================================
    # Clinical Review Package (For Dentist Workbench)
    # =========================================================================

    @classmethod
    async def get_screening_for_review(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ScreeningReviewResponse:
        """
        Assembles complete screening review data for an authorized treating dentist.
        Consolidates oral photographs, AI classification, YOLO detections, XAI visual
        heatmaps, risk assessment triage, and existing professional assessments.
        """
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
                selectinload(Screening.dentist_assessments).selectinload(DentistAssessment.dentist).selectinload(Dentist.user),
                selectinload(Screening.patient).selectinload(Patient.user),
            )
        )
        result = await db.execute(stmt)
        screening = result.scalar_one_or_none()

        if screening is None:
            raise LookupError(f"Screening '{screening_id}' not found.")

        # Enforce view authority
        await cls.verify_assessment_view_access(db, user, screening)

        patient = screening.patient
        p_user = patient.user if patient else None
        p_name = f"{p_user.first_name} {p_user.last_name}".strip() if p_user else "Anonymous Patient"

        # Calculate patient age from date of birth
        p_age: Optional[int] = None
        if patient and patient.date_of_birth:
            today = datetime.date.today()
            dob = patient.date_of_birth
            p_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

        # Primary AI Prediction & Probabilities
        primary_pred: Optional[Dict[str, Any]] = None
        if screening.ai_predictions:
            pred = screening.ai_predictions[0]
            prob_items = []
            if getattr(pred, "probabilities", None):
                for p in sorted(pred.probabilities, key=lambda x: x.class_index):
                    class_code = next(
                        (c for c, n in EFFICIENTNET_CLASS_MAPPING.items() if n == p.class_name),
                        p.class_name[:3].upper(),
                    )
                    prob_items.append({
                        "class_index": p.class_index,
                        "class_name": p.class_name,
                        "class_code": class_code,
                        "probability": float(p.probability),
                    })
            primary_pred = {
                "id": str(pred.id),
                "predicted_class": pred.predicted_class,
                "confidence": float(pred.confidence),
                "inference_duration_ms": pred.inference_duration_ms,
                "probabilities": prob_items,
            }

        # YOLO Detections
        yolo_list: List[Dict[str, Any]] = []
        if screening.yolo_detections:
            for d in screening.yolo_detections:
                yolo_list.append({
                    "id": str(d.id),
                    "detected_class": d.detected_class,
                    "confidence": float(d.confidence),
                    "bbox": {
                        "x_min": float(d.bbox_x_min),
                        "y_min": float(d.bbox_y_min),
                        "x_max": float(d.bbox_x_max),
                        "y_max": float(d.bbox_y_max),
                    },
                })

        # XAI Visual Explanations
        xai_list: List[Dict[str, Any]] = []
        for p in screening.ai_predictions:
            if getattr(p, "xai_results", None):
                for x in p.xai_results:
                    xai_list.append({
                        "id": str(x.id),
                        "method": x.method,
                        "target_layer": x.target_layer,
                        "is_primary_user_facing": x.is_primary_user_facing,
                        "heatmap_storage_path": x.heatmap_storage_path,
                        "overlay_image_storage_path": x.overlay_image_storage_path,
                    })

        # Risk Assessment
        risk_data: Optional[Dict[str, Any]] = None
        if screening.risk_assessment:
            ra = screening.risk_assessment
            risk_data = {
                "id": str(ra.id),
                "risk_level": ra.risk_level,
                "risk_score": float(ra.risk_score),
                "summary": ra.summary,
                "recommended_action": ra.recommended_action,
                "contributing_factors": ra.contributing_factors,
            }

        # Dentist Assessments
        d_assessments = [
            cls._build_assessment_response(da)
            for da in (screening.dentist_assessments or [])
        ]

        # Audit log for screening review
        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_ASSESSMENT_VIEWED",
            resource_type="screening",
            resource_id=str(screening.id),
            details={
                "action": "review_screening_findings",
                "screening_id": str(screening.id),
                "viewer_role": user.role,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()

        return ScreeningReviewResponse(
            screening_id=screening.id,
            patient_id=screening.patient_id,
            patient_name=p_name,
            patient_age=p_age,
            patient_gender=patient.gender if patient else None,
            patient_notes=screening.clinical_notes,
            screening_status=screening.status,
            screening_created_at=screening.created_at or datetime.datetime.now(datetime.timezone.utc),
            total_images=len(screening.images) if screening.images else 0,
            images=[ScreeningImageResponse.model_validate(img) for img in (screening.images or [])],
            primary_prediction=primary_pred,
            yolo_detections=yolo_list,
            xai_results=xai_list,
            risk_assessment=risk_data,
            dentist_assessments=d_assessments,
        )

    # =========================================================================
    # Clinical Assessment CRUD & Lifecycle
    # =========================================================================

    @classmethod
    async def create_assessment(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
        create_in: DentistAssessmentCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistAssessmentResponse:
        """
        Creates an independent professional dentist assessment for a screening session.
        Enforces treating dentist verification and active patient relationship.
        Supports draft vs. finalized creation.
        """
        stmt = (
            select(Screening)
            .where(
                Screening.id == screening_id,
                Screening.is_deleted.is_(False),
            )
        )
        result = await db.execute(stmt)
        screening = result.scalar_one_or_none()

        if screening is None:
            raise LookupError(f"Screening '{screening_id}' not found.")

        # Enforce treating dentist authorization
        dentist = await cls.verify_dentist_clinical_access(db, user, screening)

        # Check for existing assessment by this dentist
        existing_stmt = select(DentistAssessment).where(
            DentistAssessment.screening_id == screening_id,
            DentistAssessment.dentist_id == dentist.id,
        )
        existing_res = await db.execute(existing_stmt)
        existing_assessment = existing_res.scalar_one_or_none()

        if existing_assessment is not None:
            if existing_assessment.is_finalized:
                raise ValueError("A finalized clinical assessment already exists for this screening.")
            else:
                raise ValueError("An assessment draft already exists for this screening. Use PATCH to update it.")

        # Determine finalization timestamp
        finalized_at = datetime.datetime.now(datetime.timezone.utc) if create_in.is_finalized else None

        new_assessment = DentistAssessment(
            id=uuid.uuid4(),
            screening_id=screening_id,
            dentist_id=dentist.id,
            clinical_observations=create_in.clinical_observations.strip(),
            diagnosis_notes=create_in.diagnosis_notes.strip(),
            treatment_recommendation=create_in.treatment_recommendation.strip(),
            referral_needed=create_in.referral_needed,
            referral_specialty=create_in.referral_specialty.strip() if create_in.referral_specialty else None,
            is_finalized=create_in.is_finalized,
            finalized_at=finalized_at,
        )
        db.add(new_assessment)

        # Audit Logging
        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_ASSESSMENT_CREATED",
            resource_type="dentist_assessment",
            resource_id=str(new_assessment.id),
            details={
                "screening_id": str(screening_id),
                "dentist_id": str(dentist.id),
                "is_finalized": new_assessment.is_finalized,
                "referral_needed": new_assessment.referral_needed,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(new_assessment)

        # Notify patient if assessment is finalized
        if new_assessment.is_finalized:
            try:
                stmt_p = select(Patient).where(Patient.id == screening.patient_id)
                patient = (await db.execute(stmt_p)).scalar_one_or_none()
                if patient:
                    dentist_name = f"Dr. {user.first_name} {user.last_name}".strip()
                    await NotificationService.create_notification(
                        db=db,
                        user_id=patient.user_id,
                        notification_type="dentist_assessment_added",
                        title="Clinical Assessment Completed",
                        message=f"{dentist_name} has finalized a clinical assessment for your screening.",
                        action_url=f"/patient/screenings/{screening.id}",
                    )
            except Exception as exc:
                logger.warning("Failed to emit dentist_assessment_added notification: %s", exc)

        logger.info(
            "Created dentist assessment %s for screening %s by dentist %s (finalized: %s)",
            new_assessment.id,
            screening_id,
            dentist.id,
            new_assessment.is_finalized,
        )

        return cls._build_assessment_response(new_assessment, dentist=dentist, dentist_user=user)

    @classmethod
    async def update_assessment(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
        update_in: DentistAssessmentUpdate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistAssessmentResponse:
        """
        Updates an existing dentist assessment draft.
        If the assessment has already been finalized (is_finalized=True), rejects with 409 Conflict.
        If update_in.is_finalized is True, permanently locks the assessment.
        """
        stmt = (
            select(Screening)
            .where(
                Screening.id == screening_id,
                Screening.is_deleted.is_(False),
            )
        )
        result = await db.execute(stmt)
        screening = result.scalar_one_or_none()

        if screening is None:
            raise LookupError(f"Screening '{screening_id}' not found.")

        # Enforce treating dentist authorization
        dentist = await cls.verify_dentist_clinical_access(db, user, screening)

        # Query the dentist's assessment
        a_stmt = select(DentistAssessment).where(
            DentistAssessment.screening_id == screening_id,
            DentistAssessment.dentist_id == dentist.id,
        )
        a_res = await db.execute(a_stmt)
        assessment = a_res.scalar_one_or_none()

        if assessment is None:
            raise LookupError(f"No dentist assessment found for screening '{screening_id}' by this dentist.")

        # Enforce Draft / Finalized Lifecycle Constraint
        if assessment.is_finalized:
            logger.warning(
                "Rejected update attempt on finalized dentist assessment %s by dentist %s",
                assessment.id,
                dentist.id,
            )
            raise ValueError(
                "Cannot modify a finalized dentist assessment. Finalized clinical evaluations are permanently locked."
            )

        # Apply non-null updates
        if update_in.clinical_observations is not None:
            assessment.clinical_observations = update_in.clinical_observations.strip()
        if update_in.diagnosis_notes is not None:
            assessment.diagnosis_notes = update_in.diagnosis_notes.strip()
        if update_in.treatment_recommendation is not None:
            assessment.treatment_recommendation = update_in.treatment_recommendation.strip()
        if update_in.referral_needed is not None:
            assessment.referral_needed = update_in.referral_needed
        if update_in.referral_specialty is not None:
            assessment.referral_specialty = update_in.referral_specialty.strip() if update_in.referral_specialty else None

        # Handle finalization lock
        if update_in.is_finalized is True:
            assessment.is_finalized = True
            assessment.finalized_at = datetime.datetime.now(datetime.timezone.utc)
            logger.info("Dentist assessment %s finalized by dentist %s", assessment.id, dentist.id)

        # Audit Logging
        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_ASSESSMENT_UPDATED",
            resource_type="dentist_assessment",
            resource_id=str(assessment.id),
            details={
                "screening_id": str(screening_id),
                "dentist_id": str(dentist.id),
                "is_finalized": assessment.is_finalized,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(assessment)

        # Notify patient if assessment was finalized
        if update_in.is_finalized is True:
            try:
                stmt_p = select(Patient).where(Patient.id == screening.patient_id)
                patient = (await db.execute(stmt_p)).scalar_one_or_none()
                if patient:
                    dentist_name = f"Dr. {user.first_name} {user.last_name}".strip()
                    await NotificationService.create_notification(
                        db=db,
                        user_id=patient.user_id,
                        notification_type="dentist_assessment_added",
                        title="Clinical Assessment Completed",
                        message=f"{dentist_name} has finalized a clinical assessment for your screening.",
                        action_url=f"/patient/screenings/{screening.id}",
                    )
            except Exception as exc:
                logger.warning("Failed to emit dentist_assessment_added notification: %s", exc)

        return cls._build_assessment_response(assessment, dentist=dentist, dentist_user=user)

    @classmethod
    async def get_screening_assessment(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistAssessmentResponse:
        """
        Retrieves the latest clinical assessment for a screening.
        Accessible by the screening patient owner, authorized treating dentist, or admin.
        """
        stmt = (
            select(Screening)
            .where(
                Screening.id == screening_id,
                Screening.is_deleted.is_(False),
            )
        )
        result = await db.execute(stmt)
        screening = result.scalar_one_or_none()

        if screening is None:
            raise LookupError(f"Screening '{screening_id}' not found.")

        # Enforce view authorization
        await cls.verify_assessment_view_access(db, user, screening)

        # Retrieve latest assessment with dentist metadata
        a_stmt = (
            select(DentistAssessment)
            .where(DentistAssessment.screening_id == screening_id)
            .order_by(desc(DentistAssessment.created_at))
            .options(
                selectinload(DentistAssessment.dentist).selectinload(Dentist.user),
            )
        )
        a_res = await db.execute(a_stmt)
        assessment = a_res.scalar_one_or_none()

        if assessment is None:
            raise LookupError(f"No dentist assessment found for screening '{screening_id}'.")

        # Audit Logging
        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_ASSESSMENT_VIEWED",
            resource_type="dentist_assessment",
            resource_id=str(assessment.id),
            details={
                "screening_id": str(screening_id),
                "viewer_role": user.role,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()

        dentist = assessment.dentist
        dentist_user = dentist.user if dentist else None

        return cls._build_assessment_response(assessment, dentist=dentist, dentist_user=dentist_user)

    # =========================================================================
    # Helpers
    # =========================================================================

    @classmethod
    def _build_assessment_response(
        cls,
        assessment: DentistAssessment,
        dentist: Optional[Dentist] = None,
        dentist_user: Optional[User] = None,
    ) -> DentistAssessmentResponse:
        d = dentist or getattr(assessment, "dentist", None)
        u = dentist_user or (d.user if d else None)

        d_name: Optional[str] = None
        d_clinic: Optional[str] = None
        d_license: Optional[str] = None

        if u:
            d_name = f"Dr. {u.first_name} {u.last_name}".strip()
        if d:
            d_clinic = d.clinic_name
            d_license = d.license_number

        return DentistAssessmentResponse(
            id=assessment.id,
            screening_id=assessment.screening_id,
            dentist_id=assessment.dentist_id,
            clinical_observations=assessment.clinical_observations,
            diagnosis_notes=assessment.diagnosis_notes,
            treatment_recommendation=assessment.treatment_recommendation,
            referral_needed=assessment.referral_needed,
            referral_specialty=assessment.referral_specialty,
            is_finalized=assessment.is_finalized,
            finalized_at=assessment.finalized_at,
            created_at=assessment.created_at,
            updated_at=assessment.updated_at,
            dentist_name=d_name,
            dentist_clinic=d_clinic,
            dentist_license=d_license,
        )

    @classmethod
    async def request_screening_review(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
        data: ScreeningReviewRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistAssessmentResponse:
        """Patient initiates or checks an idempotent clinical review request for a screening.

        Establishes active PatientDentistRelationship, provisions initial unfinalized
        DentistAssessment draft, emits event notifications, and logs compliance audit record.
        """
        if user.role != "patient":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only patients can request clinical reviews.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive.",
            )

        # 1. Resolve patient profile
        stmt_p = select(Patient).where(Patient.user_id == user.id)
        patient = (await db.execute(stmt_p)).scalar_one_or_none()
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found.",
            )

        # 2. Resolve screening and verify ownership
        stmt_s = select(Screening).where(
            Screening.id == screening_id,
            Screening.is_deleted.is_(False),
        )
        screening = (await db.execute(stmt_s)).scalar_one_or_none()
        if screening is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Screening session not found.",
            )
        if screening.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not own this screening session.",
            )

        # 3. Resolve target dentist and verify approved status
        stmt_d = (
            select(Dentist)
            .join(User, Dentist.user_id == User.id)
            .where(
                Dentist.id == data.dentist_id,
                Dentist.verification_status == "approved",
                User.is_active.is_(True),
            )
            .options(selectinload(Dentist.user))
        )
        dentist = (await db.execute(stmt_d)).scalar_one_or_none()
        if dentist is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target dentist not found, inactive, or not approved.",
            )

        # 4. Idempotently establish or reactivate PatientDentistRelationship
        stmt_rel = select(PatientDentistRelationship).where(
            and_(
                PatientDentistRelationship.patient_id == patient.id,
                PatientDentistRelationship.dentist_id == dentist.id,
            )
        )
        rel = (await db.execute(stmt_rel)).scalar_one_or_none()
        if rel is None:
            rel = PatientDentistRelationship(
                id=uuid.uuid4(),
                patient_id=patient.id,
                dentist_id=dentist.id,
                status="active",
                established_via="screening_share",
            )
            db.add(rel)
            logger.info("Established new PatientDentistRelationship via review request (%s -> %s)", patient.id, dentist.id)
        elif rel.status != "active":
            rel.status = "active"
            logger.info("Reactivated existing PatientDentistRelationship via review request (%s -> %s)", patient.id, dentist.id)

        # 5. Idempotently provision or return existing DentistAssessment draft
        stmt_da = select(DentistAssessment).where(
            and_(
                DentistAssessment.screening_id == screening.id,
                DentistAssessment.dentist_id == dentist.id,
            )
        )
        da = (await db.execute(stmt_da)).scalar_one_or_none()
        is_new_request = False

        if da is None:
            is_new_request = True
            notes = f"Patient notes: {data.patient_notes.strip()}" if data.patient_notes and data.patient_notes.strip() else "Review requested by patient."
            da = DentistAssessment(
                id=uuid.uuid4(),
                screening_id=screening.id,
                dentist_id=dentist.id,
                clinical_observations=notes,
                diagnosis_notes="Pending professional clinical evaluation.",
                treatment_recommendation="Pending professional clinical evaluation.",
                referral_needed=False,
                is_finalized=False,
            )
            db.add(da)

        # 6. Audit Logging
        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_REVIEW_REQUESTED",
            resource_type="screening",
            resource_id=str(screening.id),
            details={
                "screening_id": str(screening.id),
                "dentist_id": str(dentist.id),
                "is_new_request": is_new_request,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        # 7. Notifications (emitted when a new request is created)
        if is_new_request:
            patient_name = f"{user.first_name} {user.last_name}".strip() or "Patient"
            dentist_name = f"Dr. {dentist.user.first_name} {dentist.user.last_name}".strip()

            try:
                await NotificationService.create_notification(
                    db=db,
                    user_id=dentist.user.id,
                    notification_type="system_alert",
                    title="New Clinical Review Request",
                    message=f"Patient {patient_name} requested a clinical evaluation for screening.",
                    action_url=f"/dentist/screenings/{screening.id}/review",
                    suppress_duplicates_window_seconds=300,
                )
            except Exception as exc:
                logger.warning("Failed to notify dentist of review request: %s", exc)

            try:
                await NotificationService.create_notification(
                    db=db,
                    user_id=user.id,
                    notification_type="system_alert",
                    title="Review Request Submitted",
                    message=f"Your screening review request has been sent to {dentist_name}.",
                    action_url=f"/patient/screenings/{screening.id}",
                    suppress_duplicates_window_seconds=300,
                )
            except Exception as exc:
                logger.warning("Failed to notify patient of review request: %s", exc)

        await db.commit()
        await db.refresh(da)

        return cls._build_assessment_response(da, dentist=dentist, dentist_user=dentist.user)

    @classmethod
    async def get_dentist_pending_reviews(
        cls,
        db: AsyncSession,
        user: User,
    ) -> DentistPendingReviewListResponse:
        """Retrieves list of pending screening reviews assigned to the authenticated dentist."""
        stmt_d = select(Dentist).where(Dentist.user_id == user.id)
        dentist = (await db.execute(stmt_d)).scalar_one_or_none()
        if dentist is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dentist profile not found.",
            )

        stmt = (
            select(DentistAssessment)
            .join(Screening, DentistAssessment.screening_id == Screening.id)
            .join(Patient, Screening.patient_id == Patient.id)
            .join(User, Patient.user_id == User.id)
            .where(
                and_(
                    DentistAssessment.dentist_id == dentist.id,
                    DentistAssessment.is_finalized.is_(False),
                    Screening.is_deleted.is_(False),
                )
            )
            .options(
                selectinload(DentistAssessment.screening).selectinload(Screening.patient).selectinload(Patient.user)
            )
            .order_by(DentistAssessment.created_at.desc())
        )
        res = await db.execute(stmt)
        assessments = res.scalars().all()

        items = []
        for da in assessments:
            s = da.screening
            p = s.patient if s else None
            pu = p.user if p else None
            p_name = f"{pu.first_name} {pu.last_name}".strip() if pu else "Patient"
            items.append(
                DentistPendingReviewItem(
                    assessment_id=da.id,
                    screening_id=da.screening_id,
                    patient_id=p.id if p else uuid.UUID(int=0),
                    patient_name=p_name,
                    screening_date=s.created_at if s else da.created_at,
                    requested_at=da.created_at,
                    status="pending",
                    clinical_notes=s.clinical_notes if s else None,
                )
            )

        return DentistPendingReviewListResponse(items=items, total=len(items))
