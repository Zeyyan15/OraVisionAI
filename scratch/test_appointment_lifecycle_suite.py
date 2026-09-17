"""
OraVisionAI — Appointment Lifecycle & Conflict Protection Verification Suite
Verifies the 18 test requirements specified in Section 15:
1. Requested appointment can be confirmed by correct dentist.
2. Confirmed status persists.
3. Patient sees CONFIRMED after refresh.
4. Confirmation notification is created.
5. Requested appointment can be rejected/cancelled by correct dentist.
6. Rejection persists.
7. Patient sees CANCELLED after refresh.
8. Cancellation/rejection notification is created.
9. Patient cannot call dentist confirmation endpoint (HTTP 403).
10. Dentist cannot confirm another dentist's appointment (HTTP 403).
11. Already confirmed appointment cannot be confirmed again (HTTP 409).
12. Cancelled appointment cannot be confirmed (HTTP 409).
13. Completed appointment cannot be confirmed (HTTP 409).
14. Conflicting confirmed appointment returns 409.
15. Non-overlapping adjacent appointments are allowed.
16. Existing messaging still works.
17. Existing appointment cancellation still works.
18. UTC date/time remains unchanged.
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
from app.db.session import get_session_factory
from app.models.user import User
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.dentist_availability import DentistAvailability
from app.models.notification import Notification
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.audit_log import AuditLog
from app.schemas.appointment import AppointmentCancel, AppointmentStatusUpdate
from app.schemas.conversation import ConversationCreate
from app.schemas.message import MessageCreate
from app.services.appointment_service import AppointmentService
from app.services.conversation_service import ConversationService
from sqlalchemy import select, delete


async def run_suite():
    print("=" * 75)
    print("ORAVISIONAI — APPOINTMENT LIFECYCLE & CONFLICT PROTECTION VERIFICATION")
    print("=" * 75)

    test_suffix = uuid4().hex[:8]
    factory = get_session_factory()
    passed = 0
    total = 18

    def report(num: int, title: str, status: bool, detail: str = ""):
        nonlocal passed
        res = "PASS" if status else "FAIL"
        if status:
            passed += 1
        print(f"[{res}] TEST {num:02d}: {title}")
        if detail:
            print(f"         {detail}")

    async with factory() as db:
        u_dentist1 = None
        u_dentist2 = None
        u_patient = None
        d1 = None
        d2 = None
        pat = None
        created_appts = []

        try:
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
                clinic_name=f"Clinic Alpha {test_suffix}",
                verification_status="approved"
            )
            d2 = Dentist(
                id=uuid4(),
                user_id=u_dentist2.id,
                license_number=f"LIC2_{test_suffix}",
                specialization="Orthodontics",
                clinic_name=f"Clinic Beta {test_suffix}",
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

            # Establish active relationship
            pdr = PatientDentistRelationship(
                id=uuid4(),
                patient_id=pat.id,
                dentist_id=d1.id,
                status="active"
            )
            db.add(pdr)
            await db.commit()

            base_time = datetime(2026, 9, 21, 10, 0, 0, tzinfo=timezone.utc)

            # Helper to create appointment
            async def make_appt(dentist_id, start_dt, end_dt, status="requested"):
                a = Appointment(
                    id=uuid4(),
                    patient_id=pat.id,
                    dentist_id=dentist_id,
                    scheduled_start=start_dt,
                    scheduled_end=end_dt,
                    appointment_type="video_teleconsultation",
                    status=status,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(a)
                await db.commit()
                await db.refresh(a)
                created_appts.append(a.id)
                return a

            print("\n--- Running Lifecycle & Confirmation Tests ---")

            # -------------------------------------------------------------
            # TEST 1: Requested appointment can be confirmed by correct dentist
            # -------------------------------------------------------------
            appt1 = await make_appt(d1.id, base_time, base_time + timedelta(minutes=30), "requested")
            resp1 = await AppointmentService.confirm_appointment(
                db=db,
                appointment_id=appt1.id,
                user=u_dentist1,
                dentist_notes="Pre-op instructions sent."
            )
            report(1, "Requested appointment confirmed by dentist", resp1.status == "confirmed", f"Status: {resp1.status}")

            # -------------------------------------------------------------
            # TEST 2: Confirmed status persists
            # -------------------------------------------------------------
            stmt = select(Appointment).where(Appointment.id == appt1.id)
            res = await db.execute(stmt)
            persisted1 = res.scalar_one()
            report(2, "Confirmed status persisted in database", persisted1.status == "confirmed" and persisted1.dentist_notes == "Pre-op instructions sent.", f"Persisted status: {persisted1.status}")

            # -------------------------------------------------------------
            # TEST 3: Patient sees CONFIRMED after refresh
            # -------------------------------------------------------------
            patient_view = await AppointmentService.get_appointment_by_id(db, appt1.id, u_patient)
            report(3, "Patient sees CONFIRMED status", patient_view.status == "confirmed", f"Patient viewed status: {patient_view.status}")

            # -------------------------------------------------------------
            # TEST 4: Confirmation notification is created for patient
            # -------------------------------------------------------------
            stmt_notif1 = select(Notification).where(
                Notification.user_id == u_patient.id,
                Notification.notification_type == "appointment_confirmed"
            )
            res_notif1 = await db.execute(stmt_notif1)
            notif1 = res_notif1.scalars().first()
            report(4, "Confirmation notification created for patient", notif1 is not None and notif1.title == "Appointment Confirmed", f"Notification title: {notif1.title if notif1 else None}")

            # -------------------------------------------------------------
            # TEST 5: Requested appointment can be rejected/cancelled by correct dentist
            # -------------------------------------------------------------
            t2_start = base_time + timedelta(hours=1)
            appt2 = await make_appt(d1.id, t2_start, t2_start + timedelta(minutes=30), "requested")
            reject_reason = "Dr. Test is attending emergency surgery."
            resp2 = await AppointmentService.reject_appointment(
                db=db,
                appointment_id=appt2.id,
                user=u_dentist1,
                data=AppointmentCancel(cancellation_reason=reject_reason)
            )
            report(5, "Requested appointment rejected by dentist", resp2.status == "cancelled" and resp2.cancellation_reason == reject_reason, f"Status: {resp2.status}, Reason: {resp2.cancellation_reason}")

            # -------------------------------------------------------------
            # TEST 6: Rejection persists
            # -------------------------------------------------------------
            res2 = await db.execute(select(Appointment).where(Appointment.id == appt2.id))
            persisted2 = res2.scalar_one()
            report(6, "Rejection persists in database", persisted2.status == "cancelled" and persisted2.cancelled_by_id == u_dentist1.id, f"Cancelled by: {persisted2.cancelled_by_id}")

            # -------------------------------------------------------------
            # TEST 7: Patient sees CANCELLED after refresh
            # -------------------------------------------------------------
            patient_view2 = await AppointmentService.get_appointment_by_id(db, appt2.id, u_patient)
            report(7, "Patient sees CANCELLED status", patient_view2.status == "cancelled", f"Patient viewed status: {patient_view2.status}")

            # -------------------------------------------------------------
            # TEST 8: Cancellation/rejection notification is created
            # -------------------------------------------------------------
            stmt_notif2 = select(Notification).where(
                Notification.user_id == u_patient.id,
                Notification.notification_type == "appointment_cancelled"
            )
            res_notif2 = await db.execute(stmt_notif2)
            notif2 = res_notif2.scalars().first()
            report(8, "Cancellation notification created for patient", notif2 is not None and reject_reason in notif2.message, f"Message: {notif2.message if notif2 else None}")

            # -------------------------------------------------------------
            # TEST 9: Patient cannot call dentist confirmation endpoint
            # -------------------------------------------------------------
            t3_start = base_time + timedelta(hours=2)
            appt3 = await make_appt(d1.id, t3_start, t3_start + timedelta(minutes=30), "requested")
            t9_passed = False
            try:
                await AppointmentService.confirm_appointment(db, appt3.id, u_patient)
            except HTTPException as e:
                t9_passed = (e.status_code == 403)
            report(9, "Patient cannot call dentist confirmation endpoint (HTTP 403)", t9_passed)

            # -------------------------------------------------------------
            # TEST 10: Dentist cannot confirm another dentist's appointment
            # -------------------------------------------------------------
            t10_passed = False
            try:
                await AppointmentService.confirm_appointment(db, appt3.id, u_dentist2)
            except HTTPException as e:
                t10_passed = (e.status_code == 403)
            report(10, "Dentist cannot confirm another dentist's appointment (HTTP 403)", t10_passed)

            # -------------------------------------------------------------
            # TEST 11: Already confirmed appointment cannot be confirmed again
            # -------------------------------------------------------------
            t11_passed = False
            try:
                await AppointmentService.confirm_appointment(db, appt1.id, u_dentist1)
            except HTTPException as e:
                t11_passed = (e.status_code == 409)
            report(11, "Already confirmed appointment rejected with HTTP 409", t11_passed)

            # -------------------------------------------------------------
            # TEST 12: Cancelled appointment cannot be confirmed
            # -------------------------------------------------------------
            t12_passed = False
            try:
                await AppointmentService.confirm_appointment(db, appt2.id, u_dentist1)
            except HTTPException as e:
                t12_passed = (e.status_code == 409)
            report(12, "Cancelled appointment cannot be confirmed (HTTP 409)", t12_passed)

            # -------------------------------------------------------------
            # TEST 13: Completed appointment cannot be confirmed
            # -------------------------------------------------------------
            appt_completed = await make_appt(d1.id, base_time + timedelta(hours=3), base_time + timedelta(hours=3, minutes=30), "completed")
            t13_passed = False
            try:
                await AppointmentService.confirm_appointment(db, appt_completed.id, u_dentist1)
            except HTTPException as e:
                t13_passed = (e.status_code == 409)
            report(13, "Completed appointment cannot be confirmed (HTTP 409)", t13_passed)

            # -------------------------------------------------------------
            # TEST 14: Conflicting confirmed appointment returns 409
            # -------------------------------------------------------------
            # appt1 is confirmed for 10:00 - 10:30. Create overlapping appointment 10:15 - 10:45
            appt_overlap = await make_appt(d1.id, base_time + timedelta(minutes=15), base_time + timedelta(minutes=45), "requested")
            t14_passed = False
            t14_detail = ""
            try:
                await AppointmentService.confirm_appointment(db, appt_overlap.id, u_dentist1)
            except HTTPException as e:
                t14_passed = (e.status_code == 409)
                t14_detail = e.detail
            report(14, "Conflicting overlapping appointment returns HTTP 409", t14_passed, f"Error detail: '{t14_detail}'")

            # -------------------------------------------------------------
            # TEST 15: Non-overlapping adjacent appointments are allowed
            # -------------------------------------------------------------
            # appt1 is 10:00 - 10:30. Directly adjacent slot is 10:30 - 11:00
            appt_adjacent = await make_appt(d1.id, base_time + timedelta(minutes=30), base_time + timedelta(hours=1), "requested")
            resp_adj = await AppointmentService.confirm_appointment(db, appt_adjacent.id, u_dentist1)
            report(15, "Non-overlapping adjacent appointment confirmed successfully", resp_adj.status == "confirmed", f"Adjacent slot confirmed: {resp_adj.scheduled_start.strftime('%H:%M')} - {resp_adj.scheduled_end.strftime('%H:%M')}")

            # -------------------------------------------------------------
            # TEST 16: Existing messaging still works
            # -------------------------------------------------------------
            conv_resp, _ = await ConversationService.create_or_reactivate_for_patient(
                db=db,
                dentist_id=d1.id,
                user=u_patient,
                data=ConversationCreate(),
            )
            msg_resp = await ConversationService.send_message(
                db=db,
                conversation_id=conv_resp.id,
                user=u_patient,
                data=MessageCreate(content="Hello doctor, looking forward to our appointment!"),
            )
            report(16, "Existing direct messaging workflow functional", msg_resp.content == "Hello doctor, looking forward to our appointment!", f"Message ID: {msg_resp.id}")

            # -------------------------------------------------------------
            # TEST 17: Existing appointment cancellation still works
            # -------------------------------------------------------------
            appt_cancel_generic = await make_appt(d1.id, base_time + timedelta(hours=5), base_time + timedelta(hours=5, minutes=30), "confirmed")
            cancel_resp = await AppointmentService.cancel_appointment(
                db=db,
                appointment_id=appt_cancel_generic.id,
                user=u_patient,
                data=AppointmentCancel(cancellation_reason="Patient unexpected conflict"),
            )
            report(17, "Existing appointment cancellation by patient functional", cancel_resp.status == "cancelled" and cancel_resp.cancellation_reason == "Patient unexpected conflict")

            # -------------------------------------------------------------
            # TEST 18: UTC date/time remains unchanged
            # -------------------------------------------------------------
            t18_pass = (
                resp_adj.scheduled_start == base_time + timedelta(minutes=30)
                and resp_adj.scheduled_start.tzinfo == timezone.utc
                and resp_adj.scheduled_end.tzinfo == timezone.utc
            )
            report(18, "UTC timezone preservation and zero drift verified", t18_pass, f"Start: {resp_adj.scheduled_start.isoformat()}, End: {resp_adj.scheduled_end.isoformat()}")

        finally:
            print("\n[CLEANUP] Cleaning up test data...")
            if created_appts:
                await db.execute(delete(Appointment).where(Appointment.id.in_(created_appts)))
            if pat and d1:
                await db.execute(delete(PatientDentistRelationship).where(PatientDentistRelationship.patient_id == pat.id))
            if u_patient:
                await db.execute(delete(Notification).where(Notification.user_id == u_patient.id))
            if u_dentist1:
                await db.execute(delete(Notification).where(Notification.user_id == u_dentist1.id))
            if pat:
                await db.execute(delete(Conversation).where(Conversation.patient_id == pat.id))
            if pat:
                await db.execute(delete(Patient).where(Patient.id == pat.id))
            if d1:
                await db.execute(delete(Dentist).where(Dentist.id.in_([d1.id, d2.id])))
            if u_patient:
                await db.execute(delete(User).where(User.id.in_([u_dentist1.id, u_dentist2.id, u_patient.id])))
            await db.commit()
            print("Cleanup completed.")

    print("\n" + "=" * 75)
    print(f"LIFECYCLE VERIFICATION RESULT: {passed} / {total} PASSED")
    print("=" * 75)
    if passed == total:
        print("ALL 18 APPOINTMENT LIFECYCLE TESTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print(f"FAILURE: {total - passed} test(s) failed.")
        return 1


if __name__ == "__main__":
    code = asyncio.run(run_suite())
    sys.exit(code)
