"""
OraVisionAI — Post-Acceptance Enhancement Verification Suite
Covers the 21 required test cases:
- TESTS 01-05: Dentist rejection with predefined and custom reasons, whitespace trimming, and >= 3 char validation.
- TESTS 06-09: Patient and dentist visibility of CANCELLED status and cancellation reason, and notification contents.
- TESTS 10-11: Security boundary enforcement (unauthorized dentist and patient cannot call reject).
- TESTS 12-15: Patient Cases discovery (authorized screening discovery, unauthorized exclusion, deduplication, and direct UUID authorization).
- TESTS 16-17: UTC timestamp preservation and zero PKT drift.
- TESTS 18-19: Adjacent appointments confirmable, overlapping appointments blocked with HTTP 409.
- TESTS 20-21: Existing messaging and notification workflows preserved.
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

from pydantic import ValidationError
from fastapi import HTTPException
from app.db.session import get_session_factory
from app.models.user import User
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.screening import Screening
from app.models.ai_prediction import AIPrediction
from app.models.ai_model import AIModel
from app.models.screening_image import ScreeningImage
from app.models.risk_assessment import RiskAssessment
from app.models.dentist_assessment import DentistAssessment
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.audit_log import AuditLog
from app.schemas.appointment import AppointmentCancel, AppointmentConfirm
from app.schemas.conversation import ConversationCreate
from app.schemas.message import MessageCreate
from app.services.appointment_service import AppointmentService
from app.services.conversation_service import ConversationService
from app.services.dentist_assessment_service import DentistAssessmentService
from app.api.dentists import list_my_patient_cases
from sqlalchemy import select, delete


async def run_suite():
    print("=" * 75)
    print("ORAVISIONAI — POST-ACCEPTANCE ENHANCEMENT VERIFICATION SUITE")
    print("=" * 75)

    test_suffix = uuid4().hex[:8]
    factory = get_session_factory()
    passed = 0
    total = 21

    test_user_ids = []
    test_dentist_ids = []
    test_patient_ids = []
    test_screening_ids = []
    test_appointment_ids = []
    test_assessment_ids = []

    try:
        # =====================================================================
        # SETUP TEST FIXTURES
        # =====================================================================
        print("\n[SETUP] Initializing test fixtures...")
        async with factory() as db:
            # 1. Dentist 1 (Primary Treating Dentist)
            u_d1 = User(
                id=uuid4(),
                firebase_uid=f"d1_{test_suffix}",
                email=f"dentist1_{test_suffix}@test.com",
                role="dentist",
                first_name="Dr. Marcus",
                last_name=f"Vance_{test_suffix}",
                is_active=True,
            )
            db.add(u_d1)
            d1 = Dentist(
                id=uuid4(),
                user_id=u_d1.id,
                license_number=f"DEN1-{test_suffix}",
                specialization="Endodontics",
                clinic_name="Vance Dental Clinic",
                verification_status="approved",
                years_of_experience=12,
            )
            db.add(d1)

            # 2. Dentist 2 (Unauthorized / Second Dentist)
            u_d2 = User(
                id=uuid4(),
                firebase_uid=f"d2_{test_suffix}",
                email=f"dentist2_{test_suffix}@test.com",
                role="dentist",
                first_name="Dr. Sarah",
                last_name=f"Jenkins_{test_suffix}",
                is_active=True,
            )
            db.add(u_d2)
            d2 = Dentist(
                id=uuid4(),
                user_id=u_d2.id,
                license_number=f"DEN2-{test_suffix}",
                specialization="Periodontics",
                clinic_name="Jenkins Periodontal",
                verification_status="approved",
                years_of_experience=8,
            )
            db.add(d2)

            # 3. Patient 1 (Primary Patient)
            u_p1 = User(
                id=uuid4(),
                firebase_uid=f"p1_{test_suffix}",
                email=f"patient1_{test_suffix}@test.com",
                role="patient",
                first_name="John",
                last_name=f"Doe_{test_suffix}",
                is_active=True,
            )
            db.add(u_p1)
            p1 = Patient(
                id=uuid4(),
                user_id=u_p1.id,
            )
            db.add(p1)

            # 4. Patient 2 (Unrelated Patient)
            u_p2 = User(
                id=uuid4(),
                firebase_uid=f"p2_{test_suffix}",
                email=f"patient2_{test_suffix}@test.com",
                role="patient",
                first_name="Jane",
                last_name=f"Smith_{test_suffix}",
                is_active=True,
            )
            db.add(u_p2)
            p2 = Patient(
                id=uuid4(),
                user_id=u_p2.id,
            )
            db.add(p2)

            # 5. Screening 1 for Patient 1
            s1 = Screening(
                id=uuid4(),
                patient_id=p1.id,
                created_by_id=u_p1.id,
                status="completed",
                clinical_notes="Test oral lesion screening",
                is_deleted=False,
            )
            db.add(s1)

            # 6. Screening 2 for Patient 2 (Unauthorized for Dentist 1)
            s2 = Screening(
                id=uuid4(),
                patient_id=p2.id,
                created_by_id=u_p2.id,
                status="completed",
                clinical_notes="Unrelated patient screening",
                is_deleted=False,
            )
            db.add(s2)

            # 7. Add AI Prediction for Screening 1
            ai_model = (await db.execute(select(AIModel).limit(1))).scalar_one_or_none()
            if ai_model:
                s_img = ScreeningImage(
                    id=uuid4(),
                    screening_id=s1.id,
                    storage_path="screenings/test/test.png",
                    file_name="test.png",
                    file_size_bytes=1024,
                    mime_type="image/png",
                )
                db.add(s_img)
                pred1 = AIPrediction(
                    id=uuid4(),
                    screening_id=s1.id,
                    screening_image_id=s_img.id,
                    ai_model_id=ai_model.id,
                    predicted_class="Oral Cancer",
                    confidence=0.9542,
                    inference_duration_ms=45,
                )
                db.add(pred1)

            # 8. Clinical Review Request for Screening 1 assigned to Dentist 1
            rel1 = PatientDentistRelationship(
                id=uuid4(),
                patient_id=p1.id,
                dentist_id=d1.id,
                status="active",
                established_via="screening_share",
            )
            db.add(rel1)
            da1 = DentistAssessment(
                id=uuid4(),
                screening_id=s1.id,
                dentist_id=d1.id,
                clinical_observations="",
                diagnosis_notes="",
                treatment_recommendation="",
                is_finalized=False,
            )
            db.add(da1)

            # 9. Appointment 1 (Requested, for predefined rejection test)
            start1 = datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc)
            end1 = datetime(2026, 9, 22, 10, 30, tzinfo=timezone.utc)
            appt1 = Appointment(
                id=uuid4(),
                patient_id=p1.id,
                dentist_id=d1.id,
                scheduled_start=start1,
                scheduled_end=end1,
                appointment_type="video_teleconsultation",
                status="requested",
                patient_notes="Check wisdom tooth",
            )
            db.add(appt1)

            # 10. Appointment 2 (Requested, for custom rejection test)
            start2 = datetime(2026, 9, 22, 11, 0, tzinfo=timezone.utc)
            end2 = datetime(2026, 9, 22, 11, 30, tzinfo=timezone.utc)
            appt2 = Appointment(
                id=uuid4(),
                patient_id=p1.id,
                dentist_id=d1.id,
                scheduled_start=start2,
                scheduled_end=end2,
                appointment_type="video_teleconsultation",
                status="requested",
                patient_notes="Followup consultation",
            )
            db.add(appt2)

            # 11. Appointment 3 (Requested, linked to Screening 1 for deduplication test)
            start3 = datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc)
            end3 = datetime(2026, 9, 22, 12, 30, tzinfo=timezone.utc)
            appt3 = Appointment(
                id=uuid4(),
                patient_id=p1.id,
                dentist_id=d1.id,
                screening_id=s1.id,
                scheduled_start=start3,
                scheduled_end=end3,
                appointment_type="video_teleconsultation",
                status="requested",
                patient_notes="Review my screening",
            )
            db.add(appt3)

            # Track IDs for cleanup
            test_user_ids.extend([u_d1.id, u_d2.id, u_p1.id, u_p2.id])
            test_dentist_ids.extend([d1.id, d2.id])
            test_patient_ids.extend([p1.id, p2.id])
            test_screening_ids.extend([s1.id, s2.id])
            test_appointment_ids.extend([appt1.id, appt2.id, appt3.id])
            test_assessment_ids.append(da1.id)

            await db.commit()
        print("[SETUP] Fixtures provisioned successfully.")

        # =====================================================================
        # TESTS 01 & 02: Predefined Rejection Reason
        # =====================================================================
        predefined_reason = "Schedule unavailable — please select another slot."
        async with factory() as db:
            res_reject1 = await AppointmentService.reject_appointment(
                db=db,
                appointment_id=appt1.id,
                user=u_d1,
                data=AppointmentCancel(cancellation_reason=predefined_reason),
            )
            assert res_reject1.status == "cancelled"
            print(f"[PASS] TEST 01: Dentist rejected REQUESTED appointment using predefined reason")
            passed += 1

            assert res_reject1.cancellation_reason == predefined_reason
            # Verify persisted in database
            persisted1 = (await db.execute(select(Appointment).where(Appointment.id == appt1.id))).scalar_one()
            assert persisted1.status == "cancelled"
            assert persisted1.cancellation_reason == predefined_reason
            print(f"[PASS] TEST 02: Predefined rejection reason persisted in cancellation_reason: '{predefined_reason}'")
            passed += 1

        # =====================================================================
        # TESTS 03 & 04: Custom Rejection Reason with Whitespace Trimming
        # =====================================================================
        raw_custom_reason = "   Emergency clinical session already scheduled.   "
        expected_trimmed = "Emergency clinical session already scheduled."
        async with factory() as db:
            res_reject2 = await AppointmentService.reject_appointment(
                db=db,
                appointment_id=appt2.id,
                user=u_d1,
                data=AppointmentCancel(cancellation_reason=raw_custom_reason),
            )
            assert res_reject2.status == "cancelled"
            print(f"[PASS] TEST 03: Dentist rejected using custom reason")
            passed += 1

            assert res_reject2.cancellation_reason == expected_trimmed
            persisted2 = (await db.execute(select(Appointment).where(Appointment.id == appt2.id))).scalar_one()
            assert persisted2.cancellation_reason == expected_trimmed
            print(f"[PASS] TEST 04: Custom reason persisted exactly after trimming: '{expected_trimmed}'")
            passed += 1

        # =====================================================================
        # TEST 05: Custom Reason Validation (< 3 characters rejected)
        # =====================================================================
        short_rejected = False
        try:
            AppointmentCancel(cancellation_reason="   ab   ")
        except (ValueError, ValidationError):
            short_rejected = True
        assert short_rejected, "AppointmentCancel must reject reason with < 3 characters after trimming"

        empty_rejected = False
        try:
            AppointmentCancel(cancellation_reason="      ")
        except (ValueError, ValidationError):
            empty_rejected = True
        assert empty_rejected, "AppointmentCancel must reject whitespace-only reason"
        print("[PASS] TEST 05: Custom reason shorter than 3 characters after trimming is strictly rejected")
        passed += 1

        # =====================================================================
        # TESTS 06 & 07: Patient Display of CANCELLED Status & Reason
        # =====================================================================
        async with factory() as db:
            patient_appts = await AppointmentService.list_appointments(db=db, user=u_p1)
            appt1_patient_view = next((a for a in patient_appts.items if a.id == appt1.id), None)
            assert appt1_patient_view is not None
            assert appt1_patient_view.status == "cancelled"
            print("[PASS] TEST 06: Patient sees CANCELLED status on appointment record")
            passed += 1

            assert appt1_patient_view.cancellation_reason == predefined_reason
            print(f"[PASS] TEST 07: Patient sees actual cancellation reason ('{appt1_patient_view.cancellation_reason}')")
            passed += 1

        # =====================================================================
        # TEST 08: Dentist Display of Cancellation Reason
        # =====================================================================
        async with factory() as db:
            dentist_appts = await AppointmentService.list_appointments(db=db, user=u_d1)
            appt1_dentist_view = next((a for a in dentist_appts.items if a.id == appt1.id), None)
            assert appt1_dentist_view is not None
            assert appt1_dentist_view.status == "cancelled"
            assert appt1_dentist_view.cancellation_reason == predefined_reason
            print(f"[PASS] TEST 08: Dentist sees actual cancellation reason on appointment record")
            passed += 1

        # =====================================================================
        # TEST 09: Patient Cancellation Notification Contains Actual Reason
        # =====================================================================
        async with factory() as db:
            stmt_notif = select(Notification).where(
                Notification.user_id == u_p1.id,
                Notification.notification_type == "appointment_cancelled",
            ).order_by(Notification.created_at.desc())
            notif = (await db.execute(stmt_notif)).scalars().first()
            assert notif is not None
            assert predefined_reason in notif.message or expected_trimmed in notif.message
            print(f"[PASS] TEST 09: Patient received cancellation notification with actual reason: '{notif.message}'")
            passed += 1

        # =====================================================================
        # TEST 10: Unauthorized Dentist Cannot Reject Another's Appointment
        # =====================================================================
        async with factory() as db:
            unauthorized_d2_rejected = False
            try:
                await AppointmentService.reject_appointment(
                    db=db,
                    appointment_id=appt3.id,
                    user=u_d2,
                    data=AppointmentCancel(cancellation_reason="Unauthorized rejection attempt"),
                )
            except HTTPException as exc:
                if exc.status_code == 403:
                    unauthorized_d2_rejected = True
            assert unauthorized_d2_rejected, "Dentist 2 must be blocked with HTTP 403 when rejecting Dentist 1's appointment"
            print("[PASS] TEST 10: Unauthorized dentist cannot reject another dentist's appointment (HTTP 403)")
            passed += 1

        # =====================================================================
        # TEST 11: Patient Cannot Call Dentist Reject Endpoint
        # =====================================================================
        async with factory() as db:
            patient_reject_blocked = False
            try:
                await AppointmentService.reject_appointment(
                    db=db,
                    appointment_id=appt3.id,
                    user=u_p1,
                    data=AppointmentCancel(cancellation_reason="Patient calling dentist reject"),
                )
            except HTTPException as exc:
                if exc.status_code == 403:
                    patient_reject_blocked = True
            assert patient_reject_blocked, "Patient must be blocked with HTTP 403 when calling dentist reject"
            print("[PASS] TEST 11: Patient cannot call dentist reject endpoint (HTTP 403)")
            passed += 1

        # =====================================================================
        # TEST 12: Patient Cases Returns Authorized Clinical-Review Screening
        # =====================================================================
        async with factory() as db:
            case_list = await list_my_patient_cases(current_user=u_d1, db=db)
            matching_s1 = [c for c in case_list.items if c.screening_id == s1.id]
            assert len(matching_s1) == 1, f"Expected screening {s1.id} in patient cases"
            case_item = matching_s1[0]
            assert case_item.patient_name == f"John Doe_{test_suffix}"
            assert case_item.ai_class == "Oral Cancer"
            print(f"[PASS] TEST 12: Patient Cases returns authorized clinical-review screening (AI: {case_item.ai_class})")
            passed += 1

        # =====================================================================
        # TEST 13: Patient Cases Excludes Unauthorized Screening
        # =====================================================================
        async with factory() as db:
            case_list = await list_my_patient_cases(current_user=u_d1, db=db)
            unauthorized_present = any(c.screening_id == s2.id for c in case_list.items)
            assert not unauthorized_present, "Unauthorized screening 2 must NOT appear in Dentist 1's patient cases"
            print("[PASS] TEST 13: Patient Cases does not return unauthorized screening")
            passed += 1

        # =====================================================================
        # TEST 14: Deduplication of Multiple Authorization Paths
        # =====================================================================
        async with factory() as db:
            # s1 is authorized via both DentistAssessment AND Appointment 3 (screening_id=s1.id)
            case_list = await list_my_patient_cases(current_user=u_d1, db=db)
            s1_count = sum(1 for c in case_list.items if c.screening_id == s1.id)
            assert s1_count == 1, f"Screening authorized via assessment + appointment must appear exactly ONCE, got {s1_count}"
            case_item = next(c for c in case_list.items if c.screening_id == s1.id)
            assert case_item.appointment_id == appt3.id, f"Expected appointment_id {appt3.id}, got {case_item.appointment_id}"
            print(f"[PASS] TEST 14: Deduplication verified: screening appearing in review + appt returned once with appointment_id={case_item.appointment_id}")
            passed += 1

        # =====================================================================
        # TEST 15: Direct Screening UUID Lookup Enforces Authorization
        # =====================================================================
        async with factory() as db:
            # Dentist 1 accessing Screening 1 -> Authorized
            d_profile = await DentistAssessmentService.verify_dentist_clinical_access(db=db, user=u_d1, screening=s1)
            assert d_profile.id == d1.id

            # Dentist 1 accessing Screening 2 -> PermissionError / Denied
            s2_blocked = False
            try:
                await DentistAssessmentService.verify_dentist_clinical_access(db=db, user=u_d1, screening=s2)
            except PermissionError:
                s2_blocked = True
            assert s2_blocked, "Direct lookup of unauthorized screening must raise PermissionError"
            print("[PASS] TEST 15: Direct Screening UUID lookup strictly enforces authorization (unauthorized screening raises PermissionError)")
            passed += 1

        # =====================================================================
        # TESTS 16 & 17: UTC Date/Time Preservation and Zero PKT Drift
        # =====================================================================
        async with factory() as db:
            persisted_appt3 = (await db.execute(select(Appointment).where(Appointment.id == appt3.id))).scalar_one()
            # Stored start was 2026-09-22 12:00:00 UTC
            assert persisted_appt3.scheduled_start.tzinfo is not None
            assert persisted_appt3.scheduled_start.hour == 12
            assert persisted_appt3.scheduled_start.minute == 0
            print(f"[PASS] TEST 16: UTC appointment timestamp unchanged from booking: {persisted_appt3.scheduled_start.isoformat()}")
            passed += 1

            # Verify no +5 hour local shift (which would make it 17:00)
            assert persisted_appt3.scheduled_start.hour != 17, "Timestamp was shifted by +5 hours PKT!"
            print("[PASS] TEST 17: Zero PKT (+5 hours) drift confirmed (hour is 12:00 UTC, not 17:00)")
            passed += 1

        # =====================================================================
        # TEST 18: Adjacent Appointments Remain Confirmable
        # =====================================================================
        # Slot A: 14:00 - 14:30 UTC
        # Slot B: 14:30 - 15:00 UTC
        adj_a_id = uuid4()
        adj_b_id = uuid4()
        async with factory() as db:
            adj_a = Appointment(
                id=adj_a_id,
                patient_id=p1.id,
                dentist_id=d1.id,
                scheduled_start=datetime(2026, 9, 22, 14, 0, tzinfo=timezone.utc),
                scheduled_end=datetime(2026, 9, 22, 14, 30, tzinfo=timezone.utc),
                appointment_type="video_teleconsultation",
                status="requested",
            )
            adj_b = Appointment(
                id=adj_b_id,
                patient_id=p1.id,
                dentist_id=d1.id,
                scheduled_start=datetime(2026, 9, 22, 14, 30, tzinfo=timezone.utc),
                scheduled_end=datetime(2026, 9, 22, 15, 0, tzinfo=timezone.utc),
                appointment_type="video_teleconsultation",
                status="requested",
            )
            db.add_all([adj_a, adj_b])
            test_appointment_ids.extend([adj_a_id, adj_b_id])
            await db.commit()

        async with factory() as db:
            conf_a = await AppointmentService.confirm_appointment(db=db, appointment_id=adj_a_id, user=u_d1)
            assert conf_a.status == "confirmed"

        async with factory() as db:
            conf_b = await AppointmentService.confirm_appointment(db=db, appointment_id=adj_b_id, user=u_d1)
            assert conf_b.status == "confirmed"
            print("[PASS] TEST 18: Adjacent appointments (14:00–14:30 and 14:30–15:00 UTC) both confirmed successfully")
            passed += 1

        # =====================================================================
        # TEST 19: Overlapping Appointments Blocked with HTTP 409
        # =====================================================================
        overlap_id = uuid4()
        async with factory() as db:
            # Overlapping Slot: 14:15 - 14:45 UTC (overlaps with both adj_a and adj_b)
            overlap_appt = Appointment(
                id=overlap_id,
                patient_id=p1.id,
                dentist_id=d1.id,
                scheduled_start=datetime(2026, 9, 22, 14, 15, tzinfo=timezone.utc),
                scheduled_end=datetime(2026, 9, 22, 14, 45, tzinfo=timezone.utc),
                appointment_type="video_teleconsultation",
                status="requested",
            )
            db.add(overlap_appt)
            test_appointment_ids.append(overlap_id)
            await db.commit()

        async with factory() as db:
            overlap_blocked = False
            try:
                await AppointmentService.confirm_appointment(db=db, appointment_id=overlap_id, user=u_d1)
            except HTTPException as exc:
                if exc.status_code == 409:
                    overlap_blocked = True
            assert overlap_blocked, "Overlapping appointment must be rejected with HTTP 409 Conflict"
            print("[PASS] TEST 19: Overlapping appointment (14:15–14:45 UTC) blocked with HTTP 409 Conflict")
            passed += 1

        # =====================================================================
        # TEST 20: Existing Messaging Workflow Remains Functional
        # =====================================================================
        async with factory() as db:
            conv_resp, _ = await ConversationService.create_or_reactivate_for_patient(
                db=db,
                dentist_id=d1.id,
                user=u_p1,
                data=ConversationCreate(),
            )
            assert conv_resp is not None
            msg = await ConversationService.send_message(
                db=db,
                conversation_id=conv_resp.id,
                user=u_p1,
                data=MessageCreate(content="Hello doctor, confirming our upcoming consultation."),
            )
            assert msg.content == "Hello doctor, confirming our upcoming consultation."
            print(f"[PASS] TEST 20: Messaging workflow operational (Conv ID={conv_resp.id}, Msg ID={msg.id})")
            passed += 1

        # =====================================================================
        # TEST 21: Existing Notification Workflow Remains Functional
        # =====================================================================
        async with factory() as db:
            stmt_m_notif = select(Notification).where(
                Notification.user_id == u_d1.id,
                Notification.notification_type == "new_message",
            ).order_by(Notification.created_at.desc())
            m_notif = (await db.execute(stmt_m_notif)).scalars().first()
            assert m_notif is not None
            assert "sent you a new message" in m_notif.message
            print(f"[PASS] TEST 21: Message notification dispatched to dentist: '{m_notif.message}'")
            passed += 1

    finally:
        # =====================================================================
        # CLEANUP
        # =====================================================================
        print("\n[CLEANUP] Cleaning up test fixtures...")
        async with factory() as db:
            if test_appointment_ids:
                await db.execute(delete(Appointment).where(Appointment.id.in_(test_appointment_ids)))
            if test_assessment_ids:
                await db.execute(delete(DentistAssessment).where(DentistAssessment.id.in_(test_assessment_ids)))
            if test_screening_ids:
                await db.execute(delete(RiskAssessment).where(RiskAssessment.screening_id.in_(test_screening_ids)))
                await db.execute(delete(AIPrediction).where(AIPrediction.screening_id.in_(test_screening_ids)))
                await db.execute(delete(ScreeningImage).where(ScreeningImage.screening_id.in_(test_screening_ids)))
                await db.execute(delete(Screening).where(Screening.id.in_(test_screening_ids)))
            if test_patient_ids:
                await db.execute(delete(Conversation).where(Conversation.patient_id.in_(test_patient_ids)))
                await db.execute(delete(PatientDentistRelationship).where(PatientDentistRelationship.patient_id.in_(test_patient_ids)))
            if test_user_ids:
                await db.execute(delete(Notification).where(Notification.user_id.in_(test_user_ids)))
                await db.execute(delete(Message).where(Message.sender_id.in_(test_user_ids)))
                await db.execute(delete(AuditLog).where(AuditLog.user_id.in_(test_user_ids)))
            if test_patient_ids:
                await db.execute(delete(Patient).where(Patient.id.in_(test_patient_ids)))
            if test_dentist_ids:
                await db.execute(delete(Dentist).where(Dentist.id.in_(test_dentist_ids)))
            if test_user_ids:
                await db.execute(delete(User).where(User.id.in_(test_user_ids)))
            await db.commit()
        print("[CLEANUP] Cleaned up all test entities.")

    print("\n" + "=" * 75)
    print(f"ENHANCEMENT CYCLE RESULT: {passed} / {total} PASSED")
    print("=" * 75)
    if passed == total:
        print("ALL 21 POST-ACCEPTANCE ENHANCEMENT TESTS PASSED SUCCESSFULLY!")
    else:
        print(f"FAILED: {total - passed} tests failed.")


if __name__ == "__main__":
    asyncio.run(run_suite())
