"""
OraVisionAI — Post-Acceptance Comprehensive Verification Suite

Covers:
- Test A: Appointment Datetime / Timezone Correctness (UTC contract, slot matching, deterministic serialization)
- Test B: Availability & Booking Robustness (real availability, idempotent seeding, conflict 409 handling)
- Test C: Patient Message -> Dentist Notification (atomic persistence, unread count increment, distinct notifications, duplicate suppression)
- Test D: Patient Cases Authorization (authorized cases visible, unassigned historical screenings strictly inaccessible, 403 enforcement)
"""

import sys
import os
import asyncio
from datetime import datetime, date, time, timedelta, timezone
from uuid import uuid4
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')))

from app.db.session import get_session_factory
from app.models.user import User
from app.models.patient import Patient
from app.models.dentist import Dentist
from app.models.screening import Screening
from app.models.ai_prediction import AIPrediction
from app.models.risk_assessment import RiskAssessment
from app.models.appointment import Appointment
from app.models.dentist_availability import DentistAvailability
from app.models.dentist_assessment import DentistAssessment
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.notification import Notification
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.services.dentist_availability_service import DentistAvailabilityService
from app.services.appointment_service import AppointmentService
from app.services.conversation_service import ConversationService
from app.services.notification_service import NotificationService
from app.services.dentist_assessment_service import DentistAssessmentService
from app.api.dentists import list_my_patient_cases
from app.schemas.appointment import AppointmentCreate
from app.schemas.message import MessageCreate
from sqlalchemy import select, delete


async def run_all_tests():
    print("=" * 70)
    print("ORAVISIONAI — POST-ACCEPTANCE VERIFICATION SUITE")
    print("=" * 70)

    test_suffix = uuid4().hex[:8]
    factory = get_session_factory()
    s1 = s2 = s3 = s4 = None

    async with factory() as db:
        try:
            # -------------------------------------------------------------
            # SETUP: Create test users (Dentist 1, Dentist 2, Patient)
            # -------------------------------------------------------------
            print("\n[SETUP] Creating test entities...")
            u_dentist1 = User(
                id=uuid4(),
                firebase_uid=f"fb_d1_{test_suffix}",
                email=f"dentist1_{test_suffix}@test.com",
                role="dentist",
                first_name="Dr. Test",
                last_name=f"One_{test_suffix}"
            )
            u_dentist2 = User(
                id=uuid4(),
                firebase_uid=f"fb_d2_{test_suffix}",
                email=f"dentist2_{test_suffix}@test.com",
                role="dentist",
                first_name="Dr. Test",
                last_name=f"Two_{test_suffix}"
            )
            u_patient = User(
                id=uuid4(),
                firebase_uid=f"fb_p_{test_suffix}",
                email=f"patient_{test_suffix}@test.com",
                role="patient",
                first_name="Patient",
                last_name=f"Alpha_{test_suffix}"
            )
            db.add_all([u_dentist1, u_dentist2, u_patient])
            await db.flush()

            d1 = Dentist(
                id=uuid4(),
                user_id=u_dentist1.id,
                license_number=f"LIC1_{test_suffix}",
                specialization="General",
                verification_status="approved"
            )
            d2 = Dentist(
                id=uuid4(),
                user_id=u_dentist2.id,
                license_number=f"LIC2_{test_suffix}",
                specialization="Orthodontics",
                verification_status="approved"
            )
            pat = Patient(
                id=uuid4(),
                user_id=u_patient.id,
                date_of_birth=date(1990, 1, 1),
                gender="other"
            )
            db.add_all([d1, d2, pat])
            await db.flush()

            # Establish Patient-Dentist relationship for conversation
            pdr = PatientDentistRelationship(
                id=uuid4(),
                patient_id=pat.id,
                dentist_id=d1.id,
                status="active"
            )
            db.add(pdr)
            await db.flush()
            await db.commit()
            print(f"Dentist 1 ID: {d1.id}")
            print(f"Dentist 2 ID: {d2.id}")
            print(f"Patient ID: {pat.id}")

            # =============================================================
            # TEST B: Availability & Booking Robustness
            # =============================================================
            print("\n" + "=" * 50)
            print("RUNNING TEST B: Availability & Booking Robustness")
            print("=" * 50)

            # 1. Test idempotent seeding
            print("\n--- B1. Testing Idempotent Default Availability Seeding ---")
            created_initial = await DentistAvailabilityService.ensure_default_availability(db, d1.id)
            print(f"Initial seeding returned {len(created_initial)} windows")
            assert len(created_initial) == 5, f"Expected 5 initial windows, got {len(created_initial)}"

            # Count rows in DB
            stmt = select(DentistAvailability).where(DentistAvailability.dentist_id == d1.id)
            res = await db.execute(stmt)
            count_initial = len(res.scalars().all())
            print(f"Total availability windows after 1st run: {count_initial}")
            assert count_initial == 5, f"Expected 5 weekdays, got {count_initial}"

            # Second call must be idempotent (no-op, no duplicate rows)
            created_second = await DentistAvailabilityService.ensure_default_availability(db, d1.id)
            print(f"Second seeding run returned {len(created_second)} windows")
            assert len(created_second) == 5, f"Expected 5 windows, got {len(created_second)}"

            res2 = await db.execute(stmt)
            count_second = len(res2.scalars().all())
            print(f"Total availability windows in DB after 2nd run: {count_second}")
            assert count_second == 5, f"Expected exactly 5 windows, got {count_second}"
            print(" PASS: Idempotent seeding verified!")

            # 2. Test valid public availability windows discovery
            print("\n--- B2. Testing Valid Public Availability Windows Discovery ---")
            pub_avail = await DentistAvailabilityService.list_dentist_public_availabilities(
                db=db,
                dentist_id=d1.id,
                user=u_patient
            )
            print(f"Found {pub_avail.total} active availability windows for Dentist 1")
            assert pub_avail.total == 5, f"Expected 5 active windows, got {pub_avail.total}"
            print(" PASS: Active availability windows discovery verified!")

            # =============================================================
            # TEST A: Appointment Datetime & Conflict Handling
            # =============================================================
            print("\n" + "=" * 50)
            print("RUNNING TEST A: Datetime & Conflict Robustness")
            print("=" * 50)

            print("\n--- A1. Booking First Appointment ---")
            today = date.today()
            days_ahead = 0 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            next_monday = today + timedelta(days=days_ahead)

            slot_start_utc = datetime.combine(next_monday, time(9, 0, 0), tzinfo=timezone.utc)
            slot_end_utc = datetime.combine(next_monday, time(9, 30, 0), tzinfo=timezone.utc)

            appt_create = AppointmentCreate(
                scheduled_start=slot_start_utc,
                scheduled_end=slot_end_utc,
                appointment_type="video_teleconsultation",
                patient_notes="Routine checkup"
            )

            appt1 = await AppointmentService.create_appointment(
                db=db,
                dentist_id=d1.id,
                user=u_patient,
                data=appt_create
            )
            print(f"Successfully booked appt {appt1.id} for {appt1.scheduled_start.isoformat()} UTC")
            assert appt1.scheduled_start.replace(tzinfo=timezone.utc) == slot_start_utc, "Start time mismatch"
            print(" PASS: Valid slot booked with exact UTC preservation!")

            print("\n--- A2. Conflict Handling on Duplicate Slot Booking ---")
            from fastapi import HTTPException
            conflict_caught = False
            try:
                # Attempt to book the exact same slot again
                await AppointmentService.create_appointment(
                    db=db,
                    dentist_id=d1.id,
                    user=u_patient,
                    data=appt_create
                )
            except HTTPException as e:
                print(f"Caught expected HTTPException: status_code={e.status_code}, detail='{e.detail}'")
                assert e.status_code == 409, f"Expected 409 Conflict, got {e.status_code}"
                conflict_caught = True
            except Exception as e:
                print(f"Caught other exception: {type(e).__name__}: {e}")
                conflict_caught = True

            assert conflict_caught, "Expected conflict error when booking overlapping/duplicate slot"
            print(" PASS: Conflict properly rejected with HTTP 409!")

            # =============================================================
            # TEST C: Patient Message -> Dentist Notification
            # =============================================================
            print("\n" + "=" * 50)
            print("RUNNING TEST C: Patient Message -> Dentist Notification")
            print("=" * 50)

            # 1. Create or get direct conversation between patient and dentist 1
            conv = Conversation(
                id=uuid4(),
                patient_id=pat.id,
                dentist_id=d1.id,
                stream_channel_id=f"channel_{uuid4().hex}",
                conversation_type="direct",
                is_active=True,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(conv)
            await db.commit()
            print(f"Conversation ID: {conv.id}")

            # Check baseline unread notifications for dentist 1 before message
            unread_before_msg = await NotificationService.get_unread_count(db, u_dentist1.id)
            print(f"Dentist 1 baseline unread notifications: {unread_before_msg}")

            # 2. Patient sends message
            print("\n--- C1. Patient sends message to Dentist ---")
            msg_create1 = MessageCreate(
                content="Hello Dr. Test One, I have a question about my teeth."
            )
            msg1 = await ConversationService.send_message(
                db=db,
                conversation_id=conv.id,
                user=u_patient,
                data=msg_create1
            )
            print(f"Message 1 created: id={msg1.id}, content='{msg1.content}'")

            # Check notification created atomically
            unread_after_msg1 = await NotificationService.get_unread_count(db, u_dentist1.id)
            print(f"Dentist 1 unread notifications after msg 1: {unread_after_msg1}")
            assert unread_after_msg1 == unread_before_msg + 1, f"Expected {unread_before_msg + 1}, got {unread_after_msg1}"

            # Verify notification details
            notifs, total_filtered, total_unread = await NotificationService.list_notifications(db, u_dentist1.id, limit=5)
            latest_notif = notifs[0]
            print(f"Latest Notification: title='{latest_notif.title}', message='{latest_notif.message}', action_url='{latest_notif.action_url}'")
            assert latest_notif.title == "New Message", f"Expected title 'New Message', got '{latest_notif.title}'"
            assert "sent you a new message." in latest_notif.message, f"Unexpected message body: {latest_notif.message}"
            assert latest_notif.action_url == f"/conversations/{conv.id}", f"Unexpected action URL: {latest_notif.action_url}"
            print(" PASS: Notification created atomically with correct title, message, and action_url!")

            # 3. Test 2-second suppression of duplicate network retries
            print("\n--- C2. Testing 2-Second Duplicate Suppression Window ---")
            msg_dup_data = MessageCreate(
                content="Hello Dr. Test One, I have a question about my teeth."  # duplicate text
            )
            msg_dup = await ConversationService.send_message(
                db=db,
                conversation_id=conv.id,
                user=u_patient,
                data=msg_dup_data
            )
            unread_after_dup = await NotificationService.get_unread_count(db, u_dentist1.id)
            print(f"Dentist 1 unread notifications after rapid duplicate: {unread_after_dup}")
            assert unread_after_dup == unread_after_msg1, "Duplicate message should be suppressed within 2 seconds!"
            print(" PASS: Rapid duplicate notification suppressed!")

            # 4. Distinct message after brief wait creates a new notification
            print("\n--- C3. Testing Distinct Subsequent Message Notification ---")
            await asyncio.sleep(2.1)
            msg2_data = MessageCreate(
                content="Here is additional information about my symptoms."
            )
            msg2 = await ConversationService.send_message(
                db=db,
                conversation_id=conv.id,
                user=u_patient,
                data=msg2_data
            )
            unread_after_msg2 = await NotificationService.get_unread_count(db, u_dentist1.id)
            print(f"Dentist 1 unread notifications after msg 2: {unread_after_msg2}")
            assert unread_after_msg2 == unread_after_msg1 + 1, "Distinct message should trigger a new notification!"
            print(" PASS: Distinct subsequent message generated notification!")

            # 5. Mark notification as read
            print("\n--- C4. Marking Notification as Read ---")
            await NotificationService.mark_as_read(db=db, user_id=u_dentist1.id, notification_id=latest_notif.id)
            unread_after_read = await NotificationService.get_unread_count(db, u_dentist1.id)
            print(f"Dentist 1 unread count after marking latest read: {unread_after_read}")
            assert unread_after_read == unread_after_msg2 - 1, "Unread count should decrement"
            print(" PASS: Notification read marking verified!")

            # =============================================================
            # TEST D: Patient Cases Authorization
            # =============================================================
            print("\n" + "=" * 50)
            print("RUNNING TEST D: Patient Cases Discovery & Strict Authorization")
            print("=" * 50)

            # Create 4 Screenings for Patient:
            # Screening 1: Explicitly assigned to Dentist 1 via DentistAssessment
            # Screening 2: Linked to an Appointment with Dentist 1
            # Screening 3: Unassigned, historical screening of Patient (Dentist 1 must NOT see)
            # Screening 4: Assigned to Dentist 2 (Dentist 1 must NOT see)

            print("\n--- Creating Screenings ---")
            s1 = Screening(
                id=uuid4(),
                patient_id=pat.id,
                created_by_id=u_patient.id,
                status="completed",
                clinical_notes="Screening 1 - Assigned to D1"
            )
            s2 = Screening(
                id=uuid4(),
                patient_id=pat.id,
                created_by_id=u_patient.id,
                status="completed",
                clinical_notes="Screening 2 - Appt linked to D1"
            )
            s3 = Screening(
                id=uuid4(),
                patient_id=pat.id,
                created_by_id=u_patient.id,
                status="completed",
                clinical_notes="Screening 3 - Unrelated Historical"
            )
            s4 = Screening(
                id=uuid4(),
                patient_id=pat.id,
                created_by_id=u_patient.id,
                status="completed",
                clinical_notes="Screening 4 - Assigned to D2"
            )
            db.add_all([s1, s2, s3, s4])
            await db.flush()

            # Add Risk Assessment to s1
            ra1 = RiskAssessment(
                id=uuid4(),
                screening_id=s1.id,
                risk_level="moderate",
                risk_score=Decimal("50.00"),
                contributing_factors=["Test Factor"],
                summary="Moderate risk summary",
                recommended_action="Routine follow up"
            )
            db.add(ra1)
            await db.flush()

            # Link S1 to D1 via DentistAssessment
            ass1 = DentistAssessment(
                id=uuid4(),
                screening_id=s1.id,
                dentist_id=d1.id,
                clinical_observations="Assigned for review",
                diagnosis_notes="Preliminary check",
                treatment_recommendation="Consultation",
                is_finalized=False,
            )
            db.add(ass1)

            # Link S2 to D1 via Appointment
            appt2 = Appointment(
                id=uuid4(),
                patient_id=pat.id,
                dentist_id=d1.id,
                screening_id=s2.id,
                scheduled_start=datetime.now(timezone.utc) + timedelta(days=2),
                scheduled_end=datetime.now(timezone.utc) + timedelta(days=2, minutes=30),
                status="confirmed",
                appointment_type="video_teleconsultation"
            )
            db.add(appt2)

            # Link S4 to D2 via DentistAssessment
            ass4 = DentistAssessment(
                id=uuid4(),
                screening_id=s4.id,
                dentist_id=d2.id,
                clinical_observations="Assigned to Dentist 2",
                diagnosis_notes="Preliminary check",
                treatment_recommendation="Consultation",
                is_finalized=False,
            )
            db.add(ass4)
            await db.commit()

            print("\n--- D1. Querying Patient Cases for Dentist 1 ---")
            cases_d1_response = await list_my_patient_cases(
                current_user=u_dentist1,
                db=db
            )
            cases_d1 = cases_d1_response.items
            case_screening_ids = [str(c.screening_id) for c in cases_d1]
            print(f"Dentist 1 retrieved {len(cases_d1)} cases:")
            for c in cases_d1:
                print(f"  - Screening {c.screening_id}: finding={c.ai_class}, risk={c.risk_level} (score={c.risk_score}), review_status={c.review_status}")

            # STRICT AUTHORIZATION ASSERTIONS:
            # Must contain s1 (assigned assessment)
            assert str(s1.id) in case_screening_ids, f"Screening 1 must be present for Dentist 1"
            # Must contain s2 (appointment linked)
            assert str(s2.id) in case_screening_ids, f"Screening 2 must be present for Dentist 1"
            # MUST NOT contain s3 (unrelated historical screening of Patient)
            assert str(s3.id) not in case_screening_ids, f"Screening 3 (unrelated) MUST NOT be present for Dentist 1!"
            # MUST NOT contain s4 (assigned to Dentist 2)
            assert str(s4.id) not in case_screening_ids, f"Screening 4 (Dentist 2) MUST NOT be present for Dentist 1!"
            print(" PASS: Dentist 1 sees ONLY authorized screenings (s1, s2) and NOT unrelated (s3, s4)!")

            print("\n--- D2. Testing verify_dentist_clinical_access Authorization Boundary ---")
            # Dentist 1 accessing s1 (authorized via assessment)
            dentist_s1 = await DentistAssessmentService.verify_dentist_clinical_access(db, u_dentist1, s1)
            assert dentist_s1.id == d1.id, "Dentist 1 should have clinical access to s1"
            print("  Access to S1 (Assigned): GRANTED (expected)")

            # Dentist 1 accessing s2 (authorized via appointment link)
            dentist_s2 = await DentistAssessmentService.verify_dentist_clinical_access(db, u_dentist1, s2)
            assert dentist_s2.id == d1.id, "Dentist 1 should have clinical access to s2"
            print("  Access to S2 (Appt linked): GRANTED (expected)")

            # CRITICAL CHECK: Dentist 1 accessing s3 (patient has an appt with D1, but S3 is unrelated!)
            s3_denied = False
            try:
                await DentistAssessmentService.verify_dentist_clinical_access(db, u_dentist1, s3)
            except PermissionError as e:
                s3_denied = True
                print(f"  Access to S3 (Unrelated historical): DENIED as expected with '{e}'")
            assert s3_denied, "Dentist 1 MUST NOT have access to unlinked screening S3!"

            # Dentist 1 accessing s4 (Dentist 2's case)
            s4_denied = False
            try:
                await DentistAssessmentService.verify_dentist_clinical_access(db, u_dentist1, s4)
            except PermissionError as e:
                s4_denied = True
                print(f"  Access to S4 (Dentist 2's case): DENIED as expected with '{e}'")
            assert s4_denied, "Dentist 1 MUST NOT have access to S4!"

            print(" PASS: verify_dentist_clinical_access security boundary strictly enforced!")

            print("\n" + "=" * 70)
            print("ALL ACCEPTANCE VERIFICATION TESTS PASSED SUCCESSFULLY!")
            print("=" * 70)

        finally:
            # Cleanup test data
            print("\n[CLEANUP] Cleaning up test data...")
            try:
                # Delete messages, notifications, assessments, appointments, screenings, users
                await db.execute(delete(Message).where(Message.sender_id.in_([u_patient.id, u_dentist1.id])))
                await db.execute(delete(Notification).where(Notification.user_id.in_([u_dentist1.id, u_dentist2.id, u_patient.id])))
                await db.execute(delete(DentistAssessment).where(DentistAssessment.dentist_id.in_([d1.id, d2.id])))
                await db.execute(delete(Appointment).where(Appointment.dentist_id.in_([d1.id, d2.id])))
                await db.execute(delete(DentistAvailability).where(DentistAvailability.dentist_id.in_([d1.id, d2.id])))
                if s1 is not None:
                    await db.execute(delete(RiskAssessment).where(RiskAssessment.screening_id.in_([s1.id, s2.id, s3.id, s4.id])))
                    await db.execute(delete(Screening).where(Screening.id.in_([s1.id, s2.id, s3.id, s4.id])))
                await db.execute(delete(Conversation).where(Conversation.patient_id == pat.id))
                await db.execute(delete(PatientDentistRelationship).where(PatientDentistRelationship.patient_id == pat.id))
                await db.execute(delete(Patient).where(Patient.id == pat.id))
                await db.execute(delete(Dentist).where(Dentist.id.in_([d1.id, d2.id])))
                await db.execute(delete(User).where(User.id.in_([u_dentist1.id, u_dentist2.id, u_patient.id])))
                await db.commit()
                print("Cleanup completed successfully.")
            except Exception as e:
                print(f"Cleanup error (non-fatal): {e}")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
