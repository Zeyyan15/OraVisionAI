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
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_prediction import AIPrediction
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
    ScreeningReviewResponse,
)
from app.schemas.screening import ScreeningImageResponse
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
                    prob_items.append({
                        "class_index": p.class_index,
                        "class_name": p.class_name,
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
