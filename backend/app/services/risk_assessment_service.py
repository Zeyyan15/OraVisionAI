"""
OraVisionAI — Risk Assessment & Clinical Context Domain Service

Implements the deterministic Clinical Context Engine for screening triage prioritization.
Synthesizes primary AI classification findings, spatial YOLO localizations, patient medical/lifestyle
context, and age-associated screening factors into a reproducible risk level (low, moderate, high, critical)
without creating unvalidated numerical point systems or clinical disease staging.
"""

from __future__ import annotations

import datetime
import decimal
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.ai_prediction import AIPrediction
from app.models.audit_log import AuditLog
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.patient_medical_profile import PatientMedicalProfile
from app.models.risk_assessment import RiskAssessment
from app.models.screening import Screening
from app.models.user import User
from app.models.yolo_detection import YOLODetection

logger = logging.getLogger(__name__)

# Non-clinical technical ordinal index stored to satisfy the database NUMERIC(5, 2) NOT NULL constraint
# Explicitly documented as a tier index, NOT epidemiological disease risk or cancer probability
TIER_TECHNICAL_INDEX: Dict[str, decimal.Decimal] = {
    "low": decimal.Decimal("25.00"),
    "moderate": decimal.Decimal("50.00"),
    "high": decimal.Decimal("75.00"),
    "critical": decimal.Decimal("100.00"),
}


def calculate_patient_age(date_of_birth: Optional[datetime.date]) -> Optional[int]:
    """Calculates patient age in full years from date of birth."""
    if not date_of_birth:
        return None
    today = datetime.date.today()
    return today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))


class RiskAssessmentService:
    """Consolidated clinical context and screening triage service."""

    @staticmethod
    async def verify_user_screening_access(
        db: AsyncSession,
        user: User,
        screening: Screening,
    ) -> bool:
        """
        Verifies whether the authenticated user has legitimate clinical authority to view or assess the screening.
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
    def evaluate_clinical_context(
        primary_prediction: AIPrediction,
        yolo_detections: List[YOLODetection],
        medical_profile: Optional[PatientMedicalProfile],
        patient: Optional[Patient],
    ) -> Tuple[str, List[Dict[str, Any]], str, str]:
        """
        Executes the hierarchical Clinical Context Engine waterfall:
        1. Tier 1 -> critical: Primary AI classification == 'Oral Cancer' (OC)
        2. Tier 2 -> high: Primary AI classification == 'Oral Lichen Planus' (OLP) OR multiple current documented exposures
        3. Tier 3 -> moderate: Primary AI classification in ('Gum Disease', 'Oral Thrush') OR single established exposure
        4. Tier 4 -> moderate: Age >= 50 AND qualifying oral finding present AND no higher-priority Tier 1-3 condition met
        5. Tier 5 -> low: Otherwise / no flagged context

        Returns: (risk_level, contributing_factors, summary, recommended_action)
        """
        predicted_class = primary_prediction.predicted_class
        confidence_pct = float(primary_prediction.confidence) * 100.0

        factors: List[Dict[str, Any]] = []

        # 1. AI Classification observation
        factors.append({
            "category": "AI Classification",
            "observation": f"Primary AI screening classification: {predicted_class} (model confidence: {confidence_pct:.1f}%).",
            "source": "ai_predictions",
        })

        # 2. YOLO Spatial Localization observation (strictly non-escalating localization evidence)
        yolo_count = len(yolo_detections)
        if yolo_count > 0:
            factors.append({
                "category": "Spatial Localization",
                "observation": f"YOLO detector localized {yolo_count} discrete finding region(s) in screening images.",
                "source": "yolo_detections",
            })
        else:
            factors.append({
                "category": "Spatial Localization",
                "observation": "No discrete localized finding regions detected by YOLO model.",
                "source": "yolo_detections",
            })

        # 3. Analyze documented lifestyle context
        active_exposures = 0
        exposure_descriptions = []

        if medical_profile:
            has_betel = bool(medical_profile.betel_quid_user)
            is_regular_or_heavy_smoker = medical_profile.smoking_status in ("regular", "heavy")
            is_mod_or_freq_drinker = medical_profile.alcohol_consumption in ("moderate", "frequent")
            is_freq_drinker = medical_profile.alcohol_consumption == "frequent"

            if has_betel:
                active_exposures += 1
                exposure_descriptions.append("active betel quid chewing")
            if is_regular_or_heavy_smoker:
                active_exposures += 1
                exposure_descriptions.append(f"{medical_profile.smoking_status} tobacco smoking")
            if is_mod_or_freq_drinker:
                active_exposures += 1
                exposure_descriptions.append(f"{medical_profile.alcohol_consumption} alcohol consumption")

            if exposure_descriptions:
                factors.append({
                    "category": "Lifestyle Context",
                    "observation": f"Documented lifestyle exposure factors: {', '.join(exposure_descriptions)}.",
                    "source": "patient_medical_profiles",
                })
            else:
                factors.append({
                    "category": "Lifestyle Context",
                    "observation": "No active tobacco, alcohol, or betel quid exposures documented in medical profile.",
                    "source": "patient_medical_profiles",
                })
        else:
            factors.append({
                "category": "Lifestyle Context",
                "observation": "Patient medical profile not on file; lifestyle risk factors unassessed.",
                "source": "patient_medical_profiles",
            })
            has_betel = False
            is_regular_or_heavy_smoker = False
            is_freq_drinker = False

        # 4. Patient Age
        patient_age = calculate_patient_age(patient.date_of_birth) if (patient and patient.date_of_birth) else None
        if patient_age is not None:
            factors.append({
                "category": "Demographic Context",
                "observation": f"Patient age evaluated: {patient_age} years.",
                "source": "patients",
            })

        # =========================================================================
        # Waterfall Evaluation
        # =========================================================================

        # Tier 1: Warning Signs Taking Priority (Primary AI classification == 'Oral Cancer')
        if predicted_class in ("Oral Cancer", "OC"):
            risk_level = "critical"
            decision_note = "Primary AI classification flagged an Oral Cancer visual class requiring prompt professional evaluation."
            summary = (
                "The AI screening model flagged an Oral Cancer visual class. "
                "Prompt professional dental evaluation is recommended."
            )
            recommended_action = (
                "Prompt specialist dental evaluation recommended. Arrange an immediate in-person clinical "
                "evaluation with an oral and maxillofacial specialist or hospital dental clinic for comprehensive diagnostic examination."
            )

        # Tier 2: High Clinical Vigilance / Multiple Current Exposures
        elif predicted_class in ("Oral Lichen Planus", "OLP") or active_exposures >= 2:
            risk_level = "high"
            if predicted_class in ("Oral Lichen Planus", "OLP"):
                trigger_reason = "Oral Lichen Planus screening classification requiring elevated clinical vigilance"
            else:
                trigger_reason = f"multiple concurrent documented lifestyle exposure factors ({', '.join(exposure_descriptions)})"
            decision_note = f"Elevated to HIGH triage tier based on {trigger_reason}."
            summary = (
                f"Screening session flagged for elevated clinical vigilance based on {trigger_reason}. "
                "Priority professional dental evaluation is recommended."
            )
            recommended_action = (
                "Priority dental evaluation recommended. Schedule an in-person clinical examination "
                "with a licensed dentist or oral medicine clinic within 1–2 weeks."
            )

        # Tier 3: Established Exposure / Active Tissue Pathology
        elif (
            predicted_class in ("Gum Disease", "Gum", "Oral Thrush", "OT")
            or has_betel
            or is_regular_or_heavy_smoker
            or is_freq_drinker
        ):
            risk_level = "moderate"
            if predicted_class in ("Gum Disease", "Gum", "Oral Thrush", "OT"):
                trigger_reason = f"active mucosal condition ({predicted_class})"
            else:
                trigger_reason = f"single documented established exposure factor ({', '.join(exposure_descriptions)})"
            decision_note = f"Assigned to MODERATE triage tier based on {trigger_reason}."
            summary = (
                f"Screening session identified oral findings and context consistent with moderate screening priority based on {trigger_reason}. "
                "Professional dental evaluation is recommended."
            )
            recommended_action = (
                "Professional dental evaluation recommended. Schedule an outpatient dental consultation "
                "for clinical inspection, periodontal/mucosal assessment, and professional care."
            )

        # Tier 4: Age-Associated Context (Age >= 50 AND qualifying oral finding present AND no Tier 1-3 condition)
        elif patient_age is not None and patient_age >= 50 and predicted_class is not None:
            risk_level = "moderate"
            decision_note = f"Assigned to MODERATE triage tier based on age-associated screening context (patient age {patient_age} >= 50 with oral finding present)."
            summary = (
                f"Screening session identified oral findings in patient aged {patient_age} years, "
                "warranting age-associated clinical evaluation during routine dental care."
            )
            recommended_action = (
                "Professional dental evaluation recommended. Discuss these screening findings during "
                "an in-person clinical dental consultation."
            )

        # Tier 5: No Flagged Context (Otherwise / Low Priority)
        else:
            risk_level = "low"
            decision_note = "Assigned to LOW triage tier: benign or self-limiting oral screening finding with no high-risk lifestyle exposures or age-associated context flagged."
            summary = (
                f"Screening session identified visual features consistent with {predicted_class} with no flagged high-risk exposure context. "
                "Routine oral health follow-up is recommended."
            )
            recommended_action = (
                "Routine oral health follow-up. Maintain regular bi-annual dental check-ups. "
                "Re-evaluate if oral sores persist beyond 10–14 days, increase in size, or become symptomatic."
            )

        factors.append({
            "category": "Clinical Context Decision",
            "observation": decision_note,
            "source": "clinical_context_engine",
        })

        return risk_level, factors, summary, recommended_action

    @classmethod
    async def assess_screening(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
        force_recompute: bool = False,
    ) -> RiskAssessment:
        """
        Generates or retrieves a deterministic screening risk assessment.
        Applies multi-role authorization, prerequisite validation, idempotent caching,
        PostgreSQL persistence in risk_assessments, and immutable audit logging.
        """
        # 1. Fetch screening with all relevant relations loaded
        stmt = (
            select(Screening)
            .where(
                Screening.id == screening_id,
                Screening.is_deleted.is_(False),
            )
            .options(
                selectinload(Screening.images),
                selectinload(Screening.ai_predictions),
                selectinload(Screening.yolo_detections),
                selectinload(Screening.risk_assessment),
                selectinload(Screening.patient).selectinload(Patient.medical_profile),
            )
        )
        result = await db.execute(stmt)
        screening = result.scalar_one_or_none()

        if screening is None:
            raise LookupError(f"Screening '{screening_id}' not found.")

        # 2. Authorization check
        has_access = await cls.verify_user_screening_access(db, user, screening)
        if not has_access:
            raise PermissionError("User is not authorized to generate or access risk assessments for this screening.")

        # 3. Prerequisite check: AI inference must be completed
        if not screening.ai_predictions:
            raise ValueError(
                f"Screening '{screening_id}' has no completed AI predictions. "
                "AI inference must be executed before generating a risk assessment."
            )

        # 4. Idempotency check: reuse existing assessment if not forcing recompute
        if screening.risk_assessment and not force_recompute:
            logger.info("Reusing existing risk assessment for screening %s", screening_id)
            # Log viewing audit event
            audit_view = AuditLog(
                user_id=user.id,
                action="RISK_ASSESSMENT_VIEWED",
                resource_type="risk_assessment",
                resource_id=str(screening.risk_assessment.id),
                details={"screening_id": str(screening.id), "cached": True},
            )
            db.add(audit_view)
            await db.commit()
            return screening.risk_assessment

        # 5. Evaluate Clinical Context Engine
        primary_pred = screening.ai_predictions[0]
        patient = screening.patient
        medical_profile = patient.medical_profile if patient else None

        risk_level, factors, summary, recommended_action = cls.evaluate_clinical_context(
            primary_prediction=primary_pred,
            yolo_detections=screening.yolo_detections or [],
            medical_profile=medical_profile,
            patient=patient,
        )

        # Non-clinical technical tier index satisfying NUMERIC(5, 2) NOT NULL
        technical_score = TIER_TECHNICAL_INDEX.get(risk_level, decimal.Decimal("25.00"))

        # 6. Upsert RiskAssessment record
        if screening.risk_assessment:
            assessment = screening.risk_assessment
            assessment.ai_prediction_id = primary_pred.id
            assessment.risk_level = risk_level
            assessment.risk_score = technical_score
            assessment.contributing_factors = factors
            assessment.summary = summary
            assessment.recommended_action = recommended_action
        else:
            assessment = RiskAssessment(
                id=uuid.uuid4(),
                screening_id=screening.id,
                ai_prediction_id=primary_pred.id,
                risk_level=risk_level,
                risk_score=technical_score,
                contributing_factors=factors,
                summary=summary,
                recommended_action=recommended_action,
                created_at=datetime.datetime.now(datetime.timezone.utc),
            )
            db.add(assessment)

        # 7. Audit log
        audit_gen = AuditLog(
            user_id=user.id,
            action="RISK_ASSESSMENT_GENERATED",
            resource_type="risk_assessment",
            resource_id=str(assessment.id),
            details={
                "screening_id": str(screening.id),
                "risk_level": risk_level,
                "force_recompute": force_recompute,
            },
        )
        db.add(audit_gen)

        await db.commit()
        await db.refresh(assessment)
        logger.info("Successfully persisted risk assessment %s (tier=%s) for screening %s", assessment.id, risk_level, screening.id)

        return assessment

    @classmethod
    async def get_screening_risk_assessment(
        cls,
        db: AsyncSession,
        user: User,
        screening_id: uuid.UUID,
    ) -> RiskAssessment:
        """
        Retrieves an existing risk assessment for a screening session.
        Applies authorization verification and records audit log.
        """
        stmt = (
            select(Screening)
            .where(
                Screening.id == screening_id,
                Screening.is_deleted.is_(False),
            )
            .options(selectinload(Screening.risk_assessment))
        )
        screening = (await db.execute(stmt)).scalar_one_or_none()

        if screening is None or screening.risk_assessment is None:
            raise LookupError(f"Risk assessment for screening '{screening_id}' not found.")

        has_access = await cls.verify_user_screening_access(db, user, screening)
        if not has_access:
            raise PermissionError("User is not authorized to access the risk assessment for this screening.")

        # Log viewing audit event
        audit_view = AuditLog(
            user_id=user.id,
            action="RISK_ASSESSMENT_VIEWED",
            resource_type="risk_assessment",
            resource_id=str(screening.risk_assessment.id),
            details={"screening_id": str(screening.id)},
        )
        db.add(audit_view)
        await db.commit()

        return screening.risk_assessment

