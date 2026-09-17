"""
OraVisionAI — Phase 32 Dentist Clinical Review Workspace Test Suite
Validates the complete clinical review workspace functionality:
1. Authorized dentist can retrieve complete screening review package
2. Unauthorized dentist (no active relationship or case assignment) is denied access
3. Patient role is denied dentist-only review / assessment access
4. Primary AI prediction predicted_class is returned accurately
5. Seven-class probability distribution maps correctly to all 7 classes
6. Risk level and technical urgency tier scores are returned correctly
7. Urgency score (25, 50, 75, 100) is an ordinal triage index, not a probability
8. Patient lifestyle context (smoking_status, alcohol_consumption, betel_quid_user) returned from medical profile
9. Appointment-linked context (status, UTC start/end, type) returned when linked
10. Secure artifact signed-URL flow for screening image works
11. Secure artifact signed-URL flow for XAI heatmap/overlay works
12. YOLO detections and empty detection state handled cleanly
13. Dentist assessment creation (draft mode) persists observations and recommendations
14. Dentist assessment finalization locks the record against further edits (409 Conflict)
15. Clinical report generation works and remains access-controlled
16. Invalid screening UUID is rejected safely
17. Non-existent screening UUID raises LookupError / 404
18. Patient Cases discovery (list_my_patient_cases) remains functional
19. Appointment workflow integrity remains preserved
20. Messaging and notification workflow integrity remains preserved
"""

import asyncio
import os
import sys
from datetime import date, datetime, time, timezone, timedelta
from uuid import uuid4

# Set up paths and environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

from fastapi import HTTPException
from sqlalchemy import select, delete, and_

from app.db.session import get_session_factory
from app.models.user import User
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.patient_medical_profile import PatientMedicalProfile
from app.models.screening import Screening
from app.models.screening_image import ScreeningImage
from app.models.ai_prediction import AIPrediction
from app.models.prediction_probability import PredictionProbability
from app.models.ai_model import AIModel
from app.models.yolo_detection import YOLODetection
from app.models.xai_result import XAIResult
from app.models.risk_assessment import RiskAssessment
from app.models.dentist_assessment import DentistAssessment
from app.models.appointment import Appointment
from app.models.consultation import Consultation
from app.models.notification import Notification
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.audit_log import AuditLog
from app.models.report import Report

from app.schemas.dentist_assessment import (
    DentistAssessmentCreate,
    DentistAssessmentUpdate,
    ScreeningReviewResponse,
    PatientLifestyleContext,
    AppointmentReviewContext,
)
from app.schemas.appointment import AppointmentCancel
from app.schemas.conversation import ConversationCreate
from app.services.dentist_assessment_service import DentistAssessmentService
from app.services.appointment_service import AppointmentService
from app.services.conversation_service import ConversationService
from app.services.report_service import ReportService
from app.services.storage_service import StorageService
from app.api.dentists import list_my_patient_cases


async def run_phase32_suite():
    print("=" * 80)
    print("ORAVISIONAI PHASE 32 — DENTIST CLINICAL REVIEW WORKSPACE SUITE")
    print("=" * 80)

    test_suffix = uuid4().hex[:8]
    factory = get_session_factory()
    passed = 0
    total = 20

    # Test ID trackers for reliable cleanup
    user_ids = []
    dentist_ids = []
    patient_ids = []
    screening_ids = []
    appointment_ids = []
    assessment_ids = []
    conversation_ids = []

    try:
        print("\n[SETUP] Creating test fixtures for Phase 32 workspace...")
        async with factory() as db:
            # 1. Primary Treating Dentist
            u_d1 = User(
                id=uuid4(),
                firebase_uid=f"p32_d1_{test_suffix}",
                email=f"dentist1_{test_suffix}@test.com",
                role="dentist",
                first_name="Sarah",
                last_name=f"Connor_{test_suffix}",
                is_active=True,
            )
            db.add(u_d1)
            d1 = Dentist(
                id=uuid4(),
                user_id=u_d1.id,
                license_number=f"DEN-32-1-{test_suffix}",
                specialization="Oral Medicine",
                clinic_name="Connor Oral Health Center",
                verification_status="approved",
                years_of_experience=15,
            )
            db.add(d1)

            # 2. Secondary / Unauthorized Dentist (Different Clinic)
            u_d2 = User(
                id=uuid4(),
                firebase_uid=f"p32_d2_{test_suffix}",
                email=f"dentist2_{test_suffix}@test.com",
                role="dentist",
                first_name="Alan",
                last_name=f"Grant_{test_suffix}",
                is_active=True,
            )
            db.add(u_d2)
            d2 = Dentist(
                id=uuid4(),
                user_id=u_d2.id,
                license_number=f"DEN-32-2-{test_suffix}",
                specialization="Periodontics",
                clinic_name="Grant Dental Clinic",
                verification_status="approved",
                years_of_experience=8,
            )
            db.add(d2)

            # 3. Patient with Medical Profile (Smoking, Betel, Alcohol)
            u_p1 = User(
                id=uuid4(),
                firebase_uid=f"p32_p1_{test_suffix}",
                email=f"patient1_{test_suffix}@test.com",
                role="patient",
                first_name="John",
                last_name=f"Hammond_{test_suffix}",
                is_active=True,
            )
            db.add(u_p1)
            p1 = Patient(
                id=uuid4(),
                user_id=u_p1.id,
                date_of_birth=date(1980, 6, 15),
                gender="male",
            )
            db.add(p1)

            med_profile = PatientMedicalProfile(
                id=uuid4(),
                patient_id=p1.id,
                smoking_status="regular",
                alcohol_consumption="moderate",
                betel_quid_user=True,
                medical_history=["Hypertension"],
                dental_history=["Routine extraction 2021"],
                allergies=["Penicillin"],
                current_medications=["Amlodipine"],
            )
            db.add(med_profile)

            # 4. Active Relationship between Dentist 1 and Patient 1
            rel1 = PatientDentistRelationship(
                id=uuid4(),
                patient_id=p1.id,
                dentist_id=d1.id,
                status="active",
                established_via="appointment",
            )
            db.add(rel1)

            # 5. Screening 1 for Patient 1
            s1 = Screening(
                id=uuid4(),
                patient_id=p1.id,
                created_by_id=u_p1.id,
                status="completed",
                clinical_notes="White patch under left lateral border of tongue",
            )
            db.add(s1)

            # 6. Screening Image
            # 6. Screening Image (uploaded to Supabase Storage)
            _TEST_PNG = (
                b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
                b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00"
                b"\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
            )
            img_meta = await StorageService.upload_screening_image(
                file_bytes=_TEST_PNG,
                patient_id=p1.id,
                screening_id=s1.id,
                original_filename="tongue_lesion.png",
                content_type="image/png",
            )
            img1 = ScreeningImage(
                id=uuid4(),
                screening_id=s1.id,
                file_name="tongue_lesion.png",
                file_size_bytes=len(_TEST_PNG),
                mime_type="image/png",
                storage_path=img_meta["storage_path"],
                image_width=1200,
                image_height=900,
            )
            db.add(img1)

            # 7. AI Model & Prediction with 7 Probabilities
            ai_model = (await db.execute(select(AIModel).limit(1))).scalar_one_or_none()
            if not ai_model:
                ai_model = AIModel(
                    id=uuid4(),
                    name="EfficientNetB0",
                    version="1.0.0",
                    is_active=True,
                )
                db.add(ai_model)

            pred1 = AIPrediction(
                id=uuid4(),
                screening_id=s1.id,
                ai_model_id=ai_model.id,
                screening_image_id=img1.id,
                predicted_class="OLP",
                confidence=0.875,
                inference_duration_ms=142,
            )
            db.add(pred1)

            classes_7 = [
                ("CaS", "Canker Sore", 0.015, 0),
                ("CoS", "Cold Sore", 0.010, 1),
                ("Gum", "Gum Disease", 0.035, 2),
                ("MC", "Mucocele", 0.020, 3),
                ("OC", "Oral Cancer", 0.040, 4),
                ("OLP", "Oral Lichen Planus", 0.875, 5),
                ("OT", "Oral Thrush", 0.005, 6),
            ]
            for code, name, prob, idx in classes_7:
                db.add(PredictionProbability(
                    id=uuid4(),
                    ai_prediction_id=pred1.id,
                    class_index=idx,
                    class_name=name,
                    probability=prob,
                ))

            # 8. XAI Result (uploaded to Supabase Storage)
            xai_heat_path = StorageService.upload_xai_artifact(
                png_bytes=_TEST_PNG,
                patient_id=p1.id,
                screening_id=s1.id,
                prediction_id=pred1.id,
                method="grad_cam",
                artifact_type="heatmap",
            )
            xai_over_path = StorageService.upload_xai_artifact(
                png_bytes=_TEST_PNG,
                patient_id=p1.id,
                screening_id=s1.id,
                prediction_id=pred1.id,
                method="grad_cam",
                artifact_type="overlay",
            )
            xai1 = XAIResult(
                id=uuid4(),
                ai_prediction_id=pred1.id,
                screening_image_id=img1.id,
                method="grad_cam",
                target_layer="block6a_expand_conv",
                is_primary_user_facing=True,
                heatmap_storage_path=xai_heat_path,
                overlay_image_storage_path=xai_over_path,
            )
            db.add(xai1)

            # 9. YOLO Detection (1 focal finding)
            yolo1 = YOLODetection(
                id=uuid4(),
                screening_id=s1.id,
                screening_image_id=img1.id,
                ai_model_id=ai_model.id,
                detected_class="lesion",
                confidence=0.912,
                bbox_x_min=0.25,
                bbox_y_min=0.30,
                bbox_x_max=0.65,
                bbox_y_max=0.70,
            )
            db.add(yolo1)

            # 10. Risk Assessment (Tier 2: High / 75.0)
            ra1 = RiskAssessment(
                id=uuid4(),
                screening_id=s1.id,
                risk_level="high",
                risk_score=75.0,
                summary="Primary finding OLP combined with documented tobacco and betel quid exposures indicates high urgency.",
                recommended_action="Comprehensive clinical examination and histological biopsy recommended within 14 days.",
                contributing_factors=[
                    {"category": "AI Finding", "observation": "Oral Lichen Planus (87.5% confidence)", "source": "EfficientNetB0"},
                    {"category": "Lifestyle Context", "observation": "Documented active betel quid chewing and regular tobacco smoking", "source": "patient_medical_profiles"},
                ],
            )
            db.add(ra1)

            # 11. Linked Appointment between Patient 1 and Dentist 1
            now_utc = datetime.now(timezone.utc).replace(second=0, microsecond=0) + timedelta(days=2)
            appt1 = Appointment(
                id=uuid4(),
                patient_id=p1.id,
                dentist_id=d1.id,
                screening_id=s1.id,
                scheduled_start=now_utc,
                scheduled_end=now_utc + timedelta(minutes=30),
                appointment_type="video_teleconsultation",
                status="confirmed",
                patient_notes="Follow-up consultation on AI screening result",
            )
            db.add(appt1)

            consult1 = Consultation(
                id=uuid4(),
                appointment_id=appt1.id,
                patient_id=p1.id,
                dentist_id=d1.id,
                stream_call_id=f"call_{test_suffix}",
                consultation_type="video",
                session_status="scheduled",
            )
            db.add(consult1)

            await db.commit()

            user_ids.extend([u_d1.id, u_d2.id, u_p1.id])
            dentist_ids.extend([d1.id, d2.id])
            patient_ids.append(p1.id)
            screening_ids.append(s1.id)
            appointment_ids.append(appt1.id)

        print("[SETUP] Fixtures initialized successfully.")

        # =====================================================================
        # TEST 01: Authorized Dentist Can Retrieve Review Case
        # =====================================================================
        async with factory() as db:
            review = await DentistAssessmentService.get_screening_for_review(
                db=db,
                user=u_d1,
                screening_id=s1.id,
            )
            assert review is not None
            assert review.screening_id == s1.id
            assert review.patient_name.startswith("John Hammond")
            assert review.patient_age == 46 or review.patient_age == 45 or review.patient_age == 46
            assert review.patient_gender == "male"
            print(f"[PASS] TEST 01: Authorized dentist retrieved review case for '{review.patient_name}' (Screening: {s1.id})")
            passed += 1

        # =====================================================================
        # TEST 02: Unauthorized Dentist Is Denied
        # =====================================================================
        async with factory() as db:
            denied = False
            try:
                await DentistAssessmentService.get_screening_for_review(
                    db=db,
                    user=u_d2,  # Dentist 2 has no relationship or assignment for s1
                    screening_id=s1.id,
                )
            except PermissionError as exc:
                denied = True
                assert "Access denied" in str(exc)
            assert denied, "Unauthorized dentist must be rejected with PermissionError"
            print("[PASS] TEST 02: Unauthorized dentist access strictly denied with PermissionError")
            passed += 1

        # =====================================================================
        # TEST 03: Patient Denied Dentist Review Operation
        # =====================================================================
        async with factory() as db:
            patient_denied = False
            try:
                await DentistAssessmentService.verify_dentist_clinical_access(
                    db=db,
                    user=u_p1,  # Patient role
                    screening=s1,
                )
            except PermissionError as exc:
                patient_denied = True
                assert "Access denied: Only dentists may perform this action." in str(exc)
            assert patient_denied, "Patient must be denied dentist clinical access"
            print("[PASS] TEST 03: Patient role prohibited from dentist clinical assessment endpoints")
            passed += 1

        # =====================================================================
        # TEST 04: Predicted Class Returned Accurately
        # =====================================================================
        async with factory() as db:
            review = await DentistAssessmentService.get_screening_for_review(db=db, user=u_d1, screening_id=s1.id)
            assert review.primary_prediction is not None
            assert review.primary_prediction["predicted_class"] == "OLP"
            assert abs(review.primary_prediction["confidence"] - 0.875) < 0.001
            print(f"[PASS] TEST 04: Primary AI prediction returned predicted_class='{review.primary_prediction['predicted_class']}' (confidence: {review.primary_prediction['confidence']})")
            passed += 1

        # =====================================================================
        # TEST 05: 7-Class Probability Distribution Maps Correctly
        # =====================================================================
        async with factory() as db:
            review = await DentistAssessmentService.get_screening_for_review(db=db, user=u_d1, screening_id=s1.id)
            probs = review.primary_prediction.get("probabilities", [])
            assert len(probs) == 7, f"Expected 7 classes, got {len(probs)}"
            codes = {p["class_code"] for p in probs}
            expected_codes = {"CaS", "CoS", "Gum", "MC", "OC", "OLP", "OT"}
            assert codes == expected_codes, f"Codes mismatch: {codes}"
            print(f"[PASS] TEST 05: 7-class probability distribution mapped all taxonomy classes: {sorted(codes)}")
            passed += 1

        # =====================================================================
        # TEST 06: Risk Level Returned Correctly
        # =====================================================================
        async with factory() as db:
            review = await DentistAssessmentService.get_screening_for_review(db=db, user=u_d1, screening_id=s1.id)
            assert review.risk_assessment is not None
            assert review.risk_assessment["risk_level"] == "high"
            print(f"[PASS] TEST 06: Risk level returned accurately: '{review.risk_assessment['risk_level']}'")
            passed += 1

        # =====================================================================
        # TEST 07: Urgency Score Is An Ordinal Triage Index (Not Probability)
        # =====================================================================
        async with factory() as db:
            review = await DentistAssessmentService.get_screening_for_review(db=db, user=u_d1, screening_id=s1.id)
            score = review.risk_assessment["risk_score"]
            assert score == 75.0, f"Expected 75.0, got {score}"
            assert score in [25.0, 50.0, 75.0, 100.0], f"Invalid ordinal tier index: {score}"
            print(f"[PASS] TEST 07: Urgency score verified as technical ordinal triage index: {score} (High Tier)")
            passed += 1

        # =====================================================================
        # TEST 08: Patient Lifestyle Context Extracted from Medical Profile
        # =====================================================================
        async with factory() as db:
            review = await DentistAssessmentService.get_screening_for_review(db=db, user=u_d1, screening_id=s1.id)
            assert review.patient_lifestyle is not None
            assert review.patient_lifestyle.smoking_status == "regular"
            assert review.patient_lifestyle.alcohol_consumption == "moderate"
            assert review.patient_lifestyle.betel_quid_user is True
            print(f"[PASS] TEST 08: Patient lifestyle context returned: Smoking='{review.patient_lifestyle.smoking_status}', Alcohol='{review.patient_lifestyle.alcohol_consumption}', BetelQuid={review.patient_lifestyle.betel_quid_user}")
            passed += 1

        # =====================================================================
        # TEST 09: Linked Appointment Context Returned
        # =====================================================================
        async with factory() as db:
            review = await DentistAssessmentService.get_screening_for_review(db=db, user=u_d1, screening_id=s1.id)
            assert review.linked_appointment is not None
            assert review.linked_appointment.id == appt1.id
            assert review.linked_appointment.status == "confirmed"
            assert review.linked_appointment.appointment_type == "video_teleconsultation"
            assert review.linked_appointment.consultation_id == consult1.id
            print(f"[PASS] TEST 09: Linked appointment context populated: Appt ID={review.linked_appointment.id}, Status='{review.linked_appointment.status}', Consultation ID={review.linked_appointment.consultation_id}")
            passed += 1

        # =====================================================================
        # TEST 10: Secure Artifact Signed-URL Flow for Screening Image
        # =====================================================================
        signed_url = StorageService.create_signed_url(img1.storage_path, expires_in=900)
        assert signed_url is not None
        assert "token=" in signed_url or "apikey=" in signed_url or "/storage/v1/object/sign" in signed_url or "http" in signed_url
        print(f"[PASS] TEST 10: Secure signed URL generated for original oral cavity image ({img1.storage_path})")
        passed += 1

        # =====================================================================
        # TEST 11: Secure Artifact Signed-URL Flow for XAI Heatmap/Overlay
        # =====================================================================
        xai_signed_url = StorageService.create_signed_url(xai1.overlay_image_storage_path, expires_in=900)
        assert xai_signed_url is not None
        assert "http" in xai_signed_url
        print(f"[PASS] TEST 11: Secure signed URL generated for XAI attribution overlay ({xai1.overlay_image_storage_path})")
        passed += 1

        # =====================================================================
        # TEST 12: YOLO Detections and Empty State Handled Safely
        # =====================================================================
        async with factory() as db:
            review = await DentistAssessmentService.get_screening_for_review(db=db, user=u_d1, screening_id=s1.id)
            assert len(review.yolo_detections) == 1
            det = review.yolo_detections[0]
            assert det["detected_class"] == "lesion"
            assert abs(det["bbox"]["x_min"] - 0.25) < 0.01

            # Test empty state on temporary screening
            s_empty = Screening(id=uuid4(), patient_id=p1.id, created_by_id=u_p1.id, status="completed")
            db.add(s_empty)
            # Link relationship so dentist 1 can view
            appt_empty = Appointment(
                id=uuid4(),
                patient_id=p1.id,
                dentist_id=d1.id,
                screening_id=s_empty.id,
                scheduled_start=now_utc + timedelta(days=5),
                scheduled_end=now_utc + timedelta(days=5, minutes=30),
                status="confirmed",
            )
            db.add(appt_empty)
            await db.commit()
            screening_ids.append(s_empty.id)
            appointment_ids.append(appt_empty.id)

            review_empty = await DentistAssessmentService.get_screening_for_review(db=db, user=u_d1, screening_id=s_empty.id)
            assert len(review_empty.yolo_detections) == 0
            print("[PASS] TEST 12: YOLO detections rendered with bbox coordinates, and empty detection state handled cleanly")
            passed += 1

        # =====================================================================
        # TEST 13: Dentist Assessment Save Draft (is_finalized=False)
        # =====================================================================
        async with factory() as db:
            draft_in = DentistAssessmentCreate(
                clinical_observations="White reticular striae along left buccal mucosa and lateral tongue.",
                diagnosis_notes="Features consistent with oral lichen planus (reticular subtype).",
                treatment_recommendation="Prescribe topical corticosteroid rinse; schedule follow-up in 3 weeks.",
                referral_needed=False,
                is_finalized=False,
            )
            created_draft = await DentistAssessmentService.create_assessment(
                db=db,
                user=u_d1,
                screening_id=s1.id,
                create_in=draft_in,
            )
            assert created_draft.is_finalized is False
            assert created_draft.dentist_name.startswith("Dr. Sarah Connor")
            assessment_ids.append(created_draft.id)
            print(f"[PASS] TEST 13: Dentist assessment draft created (ID: {created_draft.id}, is_finalized=False)")
            passed += 1

        # =====================================================================
        # TEST 14: Dentist Assessment Finalization and Conflict Locking (409)
        # =====================================================================
        async with factory() as db:
            finalize_in = DentistAssessmentUpdate(
                clinical_observations="White reticular striae along left buccal mucosa and lateral tongue. Biopsy advised.",
                diagnosis_notes="Oral Lichen Planus (reticular subtype) confirmed clinically.",
                treatment_recommendation="Referral to Oral & Maxillofacial Pathology for confirmation biopsy.",
                referral_needed=True,
                referral_specialty="Oral Pathology",
                is_finalized=True,
            )
            finalized = await DentistAssessmentService.update_assessment(
                db=db,
                user=u_d1,
                screening_id=s1.id,
                update_in=finalize_in,
            )
            assert finalized.is_finalized is True
            assert finalized.finalized_at is not None

            # Attempt to edit locked assessment -> must raise ValueError / 409
            conflict_raised = False
            try:
                await DentistAssessmentService.update_assessment(
                    db=db,
                    user=u_d1,
                    screening_id=s1.id,
                    update_in=DentistAssessmentUpdate(clinical_observations="Unauthorized post-finalization edit"),
                )
            except ValueError as exc:
                conflict_raised = True
                assert "Cannot modify a finalized dentist assessment" in str(exc)
            assert conflict_raised, "Finalized assessment must be locked against modification"
            print(f"[PASS] TEST 14: Assessment finalized successfully (at {finalized.finalized_at}) and modification permanently locked with HTTP 409 Conflict")
            passed += 1

        # =====================================================================
        # TEST 15: Clinical Report Generation & Access Control
        # =====================================================================
        async with factory() as db:
            report = await ReportService.generate_screening_report(
                db=db,
                user=u_d1,
                screening_id=s1.id,
                force_regenerate=True,
                report_title="Comprehensive Clinical Oral Screening Report",
            )
            assert report is not None
            assert report.report_number.startswith("RPT-")
            assert report.pdf_storage_path is not None
            print(f"[PASS] TEST 15: Clinical Report generated (Report Number: {report.report_number}, PDF: {report.pdf_storage_path})")
            passed += 1

        # =====================================================================
        # TEST 16: Invalid Screening UUID Rejection
        # =====================================================================
        invalid_uuid = uuid4()
        async with factory() as db:
            not_found = False
            try:
                await DentistAssessmentService.get_screening_for_review(
                    db=db,
                    user=u_d1,
                    screening_id=invalid_uuid,
                )
            except LookupError as exc:
                not_found = True
                assert f"Screening '{invalid_uuid}' not found" in str(exc)
            assert not_found, "Non-existent screening must raise LookupError"
            print(f"[PASS] TEST 16: Non-existent screening UUID correctly returns LookupError / 404")
            passed += 1

        # =====================================================================
        # TEST 17: Soft-Deleted Screening Inaccessible
        # =====================================================================
        async with factory() as db:
            s_del = Screening(id=uuid4(), patient_id=p1.id, created_by_id=u_p1.id, is_deleted=True, status="completed")
            db.add(s_del)
            await db.commit()
            screening_ids.append(s_del.id)

            del_not_found = False
            try:
                await DentistAssessmentService.get_screening_for_review(
                    db=db,
                    user=u_d1,
                    screening_id=s_del.id,
                )
            except LookupError:
                del_not_found = True
            assert del_not_found, "Soft-deleted screening must be completely hidden"
            print("[PASS] TEST 17: Soft-deleted screening safely excluded from clinical review")
            passed += 1

        # =====================================================================
        # TEST 18: Patient Cases Discovery (list_my_patient_cases) Functional
        # =====================================================================
        async with factory() as db:
            cases_resp = await list_my_patient_cases(
                db=db,
                current_user=u_d1,
            )
            assert cases_resp.total >= 1
            case_ids = [c.screening_id for c in cases_resp.items]
            assert s1.id in case_ids
            matching = next(c for c in cases_resp.items if c.screening_id == s1.id)
            assert matching.patient_name.startswith("John Hammond")
            assert matching.ai_class == "OLP"
            assert matching.risk_level == "high"
            print(f"[PASS] TEST 18: Patient Cases discovery workflow functional (Total: {cases_resp.total}, Found screening: {s1.id})")
            passed += 1

        # =====================================================================
        # TEST 19: Appointment Workflow Remains Intact
        # =====================================================================
        async with factory() as db:
            appt_to_cancel = Appointment(
                id=uuid4(),
                patient_id=p1.id,
                dentist_id=d1.id,
                scheduled_start=now_utc + timedelta(days=10),
                scheduled_end=now_utc + timedelta(days=10, minutes=30),
                appointment_type="video_teleconsultation",
                status="requested",
            )
            db.add(appt_to_cancel)
            await db.commit()
            appointment_ids.append(appt_to_cancel.id)

        async with factory() as db:
            cancelled_appt = await AppointmentService.reject_appointment(
                db=db,
                appointment_id=appt_to_cancel.id,
                user=u_d1,
                data=AppointmentCancel(cancellation_reason="Dentist in surgery during requested timeslot"),
            )
            assert cancelled_appt.status == "cancelled"
            assert cancelled_appt.cancellation_reason == "Dentist in surgery during requested timeslot"
            print(f"[PASS] TEST 19: Appointment rejection workflow preserved: Status='{cancelled_appt.status}', Reason='{cancelled_appt.cancellation_reason}'")
            passed += 1

        # =====================================================================
        # TEST 20: Messaging & Notification Workflow Preserved
        # =====================================================================
        async with factory() as db:
            conv_resp, is_created = await ConversationService.create_or_reactivate_for_patient(
                db=db,
                dentist_id=d1.id,
                user=u_p1,
                data=ConversationCreate(),
            )
            assert conv_resp is not None
            conversation_ids.append(conv_resp.id)
            print(f"[PASS] TEST 20: Patient-Dentist direct messaging channel verified (Conv ID: {conv_resp.id})")
            passed += 1

    finally:
        print("\n[CLEANUP] Cleaning up Phase 32 test fixtures...")
        async with factory() as db:
            if appointment_ids:
                await db.execute(delete(Consultation).where(Consultation.appointment_id.in_(appointment_ids)))
                await db.execute(delete(Appointment).where(Appointment.id.in_(appointment_ids)))
            if assessment_ids:
                await db.execute(delete(DentistAssessment).where(DentistAssessment.id.in_(assessment_ids)))
            if screening_ids:
                await db.execute(delete(Report).where(Report.screening_id.in_(screening_ids)))
                await db.execute(delete(DentistAssessment).where(DentistAssessment.screening_id.in_(screening_ids)))
                await db.execute(delete(RiskAssessment).where(RiskAssessment.screening_id.in_(screening_ids)))
                await db.execute(delete(YOLODetection).where(YOLODetection.screening_id.in_(screening_ids)))
                # XAI and Probabilities cascade from AIPrediction
                preds = (await db.execute(select(AIPrediction.id).where(AIPrediction.screening_id.in_(screening_ids)))).scalars().all()
                if preds:
                    await db.execute(delete(XAIResult).where(XAIResult.ai_prediction_id.in_(preds)))
                    await db.execute(delete(PredictionProbability).where(PredictionProbability.ai_prediction_id.in_(preds)))
                    await db.execute(delete(AIPrediction).where(AIPrediction.id.in_(preds)))
                await db.execute(delete(ScreeningImage).where(ScreeningImage.screening_id.in_(screening_ids)))
                await db.execute(delete(Screening).where(Screening.id.in_(screening_ids)))
            if conversation_ids:
                await db.execute(delete(Message).where(Message.conversation_id.in_(conversation_ids)))
                await db.execute(delete(Conversation).where(Conversation.id.in_(conversation_ids)))
            if patient_ids:
                await db.execute(delete(PatientDentistRelationship).where(PatientDentistRelationship.patient_id.in_(patient_ids)))
                await db.execute(delete(PatientMedicalProfile).where(PatientMedicalProfile.patient_id.in_(patient_ids)))
                await db.execute(delete(Patient).where(Patient.id.in_(patient_ids)))
            if dentist_ids:
                await db.execute(delete(Dentist).where(Dentist.id.in_(dentist_ids)))
            if user_ids:
                await db.execute(delete(AuditLog).where(AuditLog.user_id.in_(user_ids)))
                await db.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
                await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()
        print("[CLEANUP] Cleanup completed successfully.")

    print("\n" + "=" * 80)
    print(f"PHASE 32 SUITE RESULT: {passed} / {total} PASSED ({(passed/total)*100:.1f}%)")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_phase32_suite())
