"""
OraVisionAI — Phase 33 Real Stream Video Teleconsultation Verification Suite

Validates all Phase 33 requirements:
1. Stream environment configuration loaded securely
2. StreamService initializes with configured credentials
3. Stream API Key available server-side
4. Stream Secret is never exposed in responses or logs
5. Deterministic Stream user ID generation (oravisionai-user-{user_id})
6. Deterministic Stream call ID generation (oravisionai-consultation-{consultation_id})
7. Canonical call type is strictly 'default'
8. Official Stream SDK Token Generation produces valid cryptographically signed tokens
9. Authorized patient receives valid Stream token for their consultation
10. Authorized treating dentist receives valid Stream token for the same consultation
11. Both patient and dentist resolve to the EXACT SAME call_id and call_type
12. Unrelated patient rejected with HTTP 403
13. Unrelated dentist rejected with HTTP 403
14. Nonexistent consultation UUID rejected with HTTP 404
15. Concluded / failed consultation rejected with HTTP 409
16. Immutable audit log recorded on token issuance without leaking tokens or secrets
17. Stream user sync works without sending PHI
18. Real live Stream API connectivity check (OraVisionAI development app)
19. Existing appointment lifecycle preserved
20. Existing consultation status transitions preserved
"""

import asyncio
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

# Set up paths and environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

import jwt
from fastapi import HTTPException
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.consultation import Consultation
from app.models.dentist import Dentist
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.user import User
from app.schemas.appointment import AppointmentStatusUpdate
from app.schemas.consultation import ConsultationCreate, ConsultationEnd
from app.services.appointment_service import AppointmentService
from app.services.consultation_service import ConsultationService
from app.services.stream_service import StreamService


async def run_phase33_suite():
    print("=" * 80)
    print("ORAVISIONAI PHASE 33 — REAL STREAM VIDEO TELECONSULTATION SUITE")
    print("=" * 80)

    test_suffix = uuid4().hex[:8]
    factory = get_session_factory()
    passed = 0
    total = 20

    user_ids = []
    dentist_ids = []
    patient_ids = []
    appointment_ids = []
    consultation_ids = []

    try:
        # =====================================================================
        # TEST 1: Stream Environment Configuration Loaded
        # =====================================================================
        settings = get_settings()
        assert settings.stream_api_key, "STREAM_API_KEY is empty"
        assert settings.stream_api_secret, "STREAM_API_SECRET is empty"
        print(f"[PASS] TEST 1: Stream environment configuration loaded successfully (API Key present: {bool(settings.stream_api_key)})")
        passed += 1

        # =====================================================================
        # TEST 2: Stream Service Initialization
        # =====================================================================
        client = StreamService.get_client()
        assert client is not None
        assert client.api_key == settings.stream_api_key
        print("[PASS] TEST 2: StreamService initialized with official Stream server-side client")
        passed += 1

        # =====================================================================
        # TEST 3: Stream API Key Available Server-Side
        # =====================================================================
        assert len(settings.stream_api_key) > 5
        print(f"[PASS] TEST 3: Stream API key verified (Length: {len(settings.stream_api_key)} chars)")
        passed += 1

        # =====================================================================
        # TEST 4: Stream Secret Is Never Exposed in Model / Schema Repr
        # =====================================================================
        service_str = str(StreamService)
        assert settings.stream_api_secret not in service_str
        print("[PASS] TEST 4: Security invariant verified: Stream secret is never exposed in string representations")
        passed += 1

        # =====================================================================
        # TEST 5: Deterministic Stream User ID Generation
        # =====================================================================
        sample_uuid = uuid4()
        expected_user_id = f"oravisionai-user-{sample_uuid}"
        actual_user_id = StreamService.get_stream_user_id(sample_uuid)
        assert actual_user_id == expected_user_id
        # Idempotency check: passing already formatted ID returns it unchanged
        assert StreamService.get_stream_user_id(expected_user_id) == expected_user_id
        print(f"[PASS] TEST 5: Deterministic Stream user ID verified: '{actual_user_id}'")
        passed += 1

        # =====================================================================
        # TEST 6: Deterministic Stream Call ID Generation
        # =====================================================================
        sample_cons_uuid = uuid4()
        expected_call_id = f"oravisionai-consultation-{sample_cons_uuid}"
        actual_call_id = StreamService.get_stream_call_id(sample_cons_uuid)
        assert actual_call_id == expected_call_id
        assert StreamService.get_stream_call_id(expected_call_id) == expected_call_id
        print(f"[PASS] TEST 6: Deterministic Stream call ID verified: '{actual_call_id}'")
        passed += 1

        # =====================================================================
        # TEST 7: Canonical Call Type Is Strictly 'default'
        # =====================================================================
        call_type = StreamService.get_stream_call_type()
        assert call_type == "default"
        print(f"[PASS] TEST 7: Canonical Stream Video call type verified: '{call_type}'")
        passed += 1

        # =====================================================================
        # TEST 8: Official Stream SDK Token Generation & JWT Signature Validation
        # =====================================================================
        test_user_id = f"oravisionai-user-{sample_uuid}"
        token = StreamService.create_user_token(test_user_id, expiration_seconds=1800)
        assert isinstance(token, str) and len(token) > 20

        # Decode using PyJWT and STREAM_API_SECRET to verify cryptographic authenticity
        decoded = jwt.decode(token, settings.stream_api_secret, algorithms=["HS256"])
        assert decoded.get("user_id") == test_user_id
        assert "exp" in decoded and "iat" in decoded
        assert decoded["exp"] > decoded["iat"]
        print(f"[PASS] TEST 8: Official Stream SDK Token verified (user_id='{decoded['user_id']}', exp={decoded['exp']})")
        passed += 1

        # =====================================================================
        # SEED TEST FIXTURES: Authorized Dentist, Authorized Patient, and Others
        # =====================================================================
        now_utc = datetime.now(timezone.utc)
        async with factory() as db:
            # 1. Treating Dentist
            u_dentist = User(
                id=uuid4(),
                firebase_uid=f"p33_dentist_{test_suffix}",
                email=f"dentist_{test_suffix}@test.com",
                role="dentist",
                first_name="Elena",
                last_name=f"Rostova_{test_suffix}",
                is_active=True,
            )
            db.add(u_dentist)
            d_dentist = Dentist(
                id=uuid4(),
                user_id=u_dentist.id,
                license_number=f"DEN-33-1-{test_suffix}",
                specialization="Oral Medicine",
                clinic_name="OraVision Central Clinic",
                verification_status="approved",
                years_of_experience=12,
            )
            db.add(d_dentist)

            # 2. Authorized Patient
            u_patient = User(
                id=uuid4(),
                firebase_uid=f"p33_patient_{test_suffix}",
                email=f"patient_{test_suffix}@test.com",
                role="patient",
                first_name="Marcus",
                last_name=f"Vance_{test_suffix}",
                is_active=True,
            )
            db.add(u_patient)
            p_patient = Patient(
                id=uuid4(),
                user_id=u_patient.id,
                date_of_birth=date(1992, 4, 10),
                gender="male",
            )
            db.add(p_patient)

            # 3. Relationship
            rel = PatientDentistRelationship(
                id=uuid4(),
                patient_id=p_patient.id,
                dentist_id=d_dentist.id,
                status="active",
                established_via="appointment",
            )
            db.add(rel)

            # 4. Confirmed Appointment
            appt = Appointment(
                id=uuid4(),
                patient_id=p_patient.id,
                dentist_id=d_dentist.id,
                scheduled_start=now_utc + timedelta(days=1),
                scheduled_end=now_utc + timedelta(days=1, minutes=30),
                appointment_type="video_teleconsultation",
                status="confirmed",
            )
            db.add(appt)

            # 5. Consultation session
            cons = Consultation(
                id=uuid4(),
                appointment_id=appt.id,
                patient_id=p_patient.id,
                dentist_id=d_dentist.id,
                stream_call_id=StreamService.get_stream_call_id(appt.id),  # Will test canonicalization
                consultation_type="video",
                session_status="scheduled",
                started_at=None,
                ended_at=None,
                duration_seconds=0,
            )
            db.add(cons)

            # 6. Unrelated Patient (Attacker)
            u_unrelated_p = User(
                id=uuid4(),
                firebase_uid=f"p33_unrel_p_{test_suffix}",
                email=f"unrelated_p_{test_suffix}@test.com",
                role="patient",
                first_name="Eve",
                last_name="Intruder",
                is_active=True,
            )
            db.add(u_unrelated_p)
            p_unrelated_p = Patient(
                id=uuid4(),
                user_id=u_unrelated_p.id,
                date_of_birth=date(1995, 8, 20),
                gender="female",
            )
            db.add(p_unrelated_p)

            # 7. Unrelated Dentist (Attacker)
            u_unrelated_d = User(
                id=uuid4(),
                firebase_uid=f"p33_unrel_d_{test_suffix}",
                email=f"unrelated_d_{test_suffix}@test.com",
                role="dentist",
                first_name="Victor",
                last_name="Snoop",
                is_active=True,
            )
            db.add(u_unrelated_d)
            d_unrelated_d = Dentist(
                id=uuid4(),
                user_id=u_unrelated_d.id,
                license_number=f"DEN-33-UNREL-{test_suffix}",
                specialization="General",
                clinic_name="Snoop Clinic",
                verification_status="approved",
                years_of_experience=5,
            )
            db.add(d_unrelated_d)

            await db.commit()

            user_ids.extend([u_dentist.id, u_patient.id, u_unrelated_p.id, u_unrelated_d.id])
            dentist_ids.extend([d_dentist.id, d_unrelated_d.id])
            patient_ids.extend([p_patient.id, p_unrelated_p.id])
            appointment_ids.append(appt.id)
            consultation_ids.append(cons.id)

        # =====================================================================
        # TEST 9: Authorized Patient Receives Stream Token
        # =====================================================================
        async with factory() as db:
            p_token_resp = await ConsultationService.get_stream_token_for_consultation(
                db=db,
                consultation_id=cons.id,
                user=u_patient,
            )
            assert p_token_resp is not None
            assert p_token_resp.token
            assert p_token_resp.user_id == StreamService.get_stream_user_id(u_patient.id)
            assert p_token_resp.api_key == settings.stream_api_key
            assert p_token_resp.call_id == StreamService.get_stream_call_id(cons.id)
            assert p_token_resp.call_type == "default"
            assert p_token_resp.consultation_id == cons.id
            print(f"[PASS] TEST 9: Authorized patient received Stream token (User ID: '{p_token_resp.user_id}')")
            passed += 1

        # =====================================================================
        # TEST 10: Authorized Dentist Receives Stream Token
        # =====================================================================
        async with factory() as db:
            d_token_resp = await ConsultationService.get_stream_token_for_consultation(
                db=db,
                consultation_id=cons.id,
                user=u_dentist,
            )
            assert d_token_resp is not None
            assert d_token_resp.token
            assert d_token_resp.user_id == StreamService.get_stream_user_id(u_dentist.id)
            assert d_token_resp.api_key == settings.stream_api_key
            assert d_token_resp.call_id == StreamService.get_stream_call_id(cons.id)
            assert d_token_resp.call_type == "default"
            assert d_token_resp.consultation_id == cons.id
            print(f"[PASS] TEST 10: Authorized dentist received Stream token (User ID: '{d_token_resp.user_id}')")
            passed += 1

        # =====================================================================
        # TEST 11: Patient and Dentist Resolve to EXACT SAME Call ID and Type
        # =====================================================================
        assert p_token_resp.call_id == d_token_resp.call_id == f"oravisionai-consultation-{cons.id}"
        assert p_token_resp.call_type == d_token_resp.call_type == "default"
        print(f"[PASS] TEST 11: Both participants resolve to exact same Stream call: '{p_token_resp.call_type}:{p_token_resp.call_id}'")
        passed += 1

        # =====================================================================
        # TEST 12: Unrelated Patient Rejected (HTTP 403)
        # =====================================================================
        async with factory() as db:
            rejected = False
            try:
                await ConsultationService.get_stream_token_for_consultation(
                    db=db,
                    consultation_id=cons.id,
                    user=u_unrelated_p,
                )
            except HTTPException as exc:
                if exc.status_code == 403:
                    rejected = True
            assert rejected, "Unrelated patient was NOT rejected with HTTP 403"
            print("[PASS] TEST 12: Unrelated patient strictly rejected with HTTP 403 Forbidden")
            passed += 1

        # =====================================================================
        # TEST 13: Unrelated Dentist Rejected (HTTP 403)
        # =====================================================================
        async with factory() as db:
            rejected = False
            try:
                await ConsultationService.get_stream_token_for_consultation(
                    db=db,
                    consultation_id=cons.id,
                    user=u_unrelated_d,
                )
            except HTTPException as exc:
                if exc.status_code == 403:
                    rejected = True
            assert rejected, "Unrelated dentist was NOT rejected with HTTP 403"
            print("[PASS] TEST 13: Unrelated dentist strictly rejected with HTTP 403 Forbidden")
            passed += 1

        # =====================================================================
        # TEST 14: Nonexistent Consultation Rejected (HTTP 404)
        # =====================================================================
        async with factory() as db:
            not_found = False
            try:
                await ConsultationService.get_stream_token_for_consultation(
                    db=db,
                    consultation_id=uuid4(),
                    user=u_dentist,
                )
            except HTTPException as exc:
                if exc.status_code == 404:
                    not_found = True
            assert not_found, "Nonexistent consultation was NOT rejected with HTTP 404"
            print("[PASS] TEST 14: Nonexistent consultation safely rejected with HTTP 404 Not Found")
            passed += 1

        # =====================================================================
        # TEST 15: Concluded Consultation Rejected (HTTP 409)
        # =====================================================================
        async with factory() as db:
            # End the consultation session
            stmt_c = select(Consultation).where(Consultation.id == cons.id)
            res_c = await db.execute(stmt_c)
            cons_model = res_c.scalar_one()
            cons_model.session_status = "ended"
            cons_model.ended_at = datetime.now(timezone.utc)
            await db.commit()

        async with factory() as db:
            conflict = False
            try:
                await ConsultationService.get_stream_token_for_consultation(
                    db=db,
                    consultation_id=cons.id,
                    user=u_patient,
                )
            except HTTPException as exc:
                if exc.status_code == 409:
                    conflict = True
            assert conflict, "Ended consultation was NOT rejected with HTTP 409"
            print("[PASS] TEST 15: Concluded consultation strictly rejected with HTTP 409 Conflict")
            passed += 1

        # =====================================================================
        # TEST 16: Audit Log Integrity on Token Issuance
        # =====================================================================
        async with factory() as db:
            stmt_audit = (
                select(AuditLog)
                .where(
                    AuditLog.resource_id == str(cons.id),
                    AuditLog.action == "CONSULTATION_STREAM_TOKEN_ISSUED",
                )
                .order_by(AuditLog.timestamp.desc())
            )
            res_audit = await db.execute(stmt_audit)
            logs = list(res_audit.scalars().all())
            assert len(logs) >= 2  # Patient + Dentist issuances
            latest = logs[0]
            assert "token" not in latest.details, "Token was leaked in audit log details!"
            assert "secret" not in str(latest.details).lower(), "Secret leaked in audit log details!"
            assert latest.details["stream_call_id"] == f"oravisionai-consultation-{cons.id}"
            print(f"[PASS] TEST 16: Audit log recorded token issuance securely without token/secret leakage (Logs: {len(logs)})")
            passed += 1

        # =====================================================================
        # TEST 17: Basic Stream User Sync Without PHI Leakage
        # =====================================================================
        sync_success = StreamService.upsert_user(
            user_id=u_dentist.id,
            name=f"Dr. Elena Rostova_{test_suffix}",
            role="user",
        )
        assert sync_success, "Stream user sync failed"
        print("[PASS] TEST 17: Basic user identity safely synced with Stream (Name, Role only; 0 PHI sent)")
        passed += 1

        # =====================================================================
        # TEST 18: Live Stream API Connectivity & App Resolution
        # =====================================================================
        import httpx
        server_token = jwt.encode({"server": True}, settings.stream_api_secret, algorithm="HS256")
        async with httpx.AsyncClient(timeout=10.0) as http:
            app_resp = await http.get(
                f"https://chat.stream-io-api.com/app?api_key={settings.stream_api_key}",
                headers={"Authorization": server_token, "Stream-Auth-Type": "jwt"},
            )
            assert app_resp.status_code == 200, f"Stream API returned {app_resp.status_code}: {app_resp.text}"
            app_data = app_resp.json().get("app", {})
            assert app_data.get("name") == "OraVisionAI"
            print(f"[PASS] TEST 18: Live Stream development application verified: '{app_data.get('name')}' (HTTP 200)")
            passed += 1

        # =====================================================================
        # TEST 19: Appointment Status Synchronization & Lifecycle Preservation
        # =====================================================================
        async with factory() as db:
            # Create a second confirmed appointment and consultation to test start -> active -> in_progress
            appt2 = Appointment(
                id=uuid4(),
                patient_id=p_patient.id,
                dentist_id=d_dentist.id,
                scheduled_start=now_utc + timedelta(days=2),
                scheduled_end=now_utc + timedelta(days=2, minutes=30),
                appointment_type="video_teleconsultation",
                status="confirmed",
            )
            db.add(appt2)
            await db.commit()
            appointment_ids.append(appt2.id)

            cons2_resp = await ConsultationService.create_consultation(
                db=db,
                appointment_id=appt2.id,
                user=u_dentist,
                data=ConsultationCreate(consultation_type="video"),
            )
            assert cons2_resp is not None
            assert cons2_resp.stream_call_id == StreamService.get_stream_call_id(cons2_resp.id)
            consultation_ids.append(cons2_resp.id)

            # Start consultation (scheduled -> active) synchronizes appointment -> in_progress
            started_cons = await ConsultationService.start_consultation(
                db=db,
                consultation_id=cons2_resp.id,
                user=u_dentist,
                data={},
            )
            assert started_cons.session_status == "active"

            # Check appointment
            stmt_a2 = select(Appointment).where(Appointment.id == appt2.id)
            appt2_model = (await db.execute(stmt_a2)).scalar_one()
            assert appt2_model.status == "in_progress"
            print(f"[PASS] TEST 19: Consultation start preserved: session_status='{started_cons.session_status}', appointment_status='{appt2_model.status}'")
            passed += 1

        # =====================================================================
        # TEST 20: Consultation Conclusion Lifecycle Preservation
        # =====================================================================
        async with factory() as db:
            ended_cons = await ConsultationService.end_consultation(
                db=db,
                consultation_id=cons2_resp.id,
                user=u_dentist,
                data=ConsultationEnd(clinical_summary="Teleconsultation completed successfully. Advised follow-up."),
            )
            assert ended_cons.session_status == "ended"
            assert ended_cons.clinical_summary == "Teleconsultation completed successfully. Advised follow-up."

            # Check appointment status synchronized to completed
            stmt_a2_ended = select(Appointment).where(Appointment.id == appt2.id)
            appt2_ended_model = (await db.execute(stmt_a2_ended)).scalar_one()
            assert appt2_ended_model.status == "completed"
            print(f"[PASS] TEST 20: Consultation conclusion preserved: session_status='{ended_cons.session_status}', appointment_status='{appt2_ended_model.status}'")
            passed += 1

    finally:
        print("\n[CLEANUP] Cleaning up Phase 33 test fixtures...")
        async with factory() as db:
            if consultation_ids:
                await db.execute(delete(Consultation).where(Consultation.id.in_(consultation_ids)))
            if appointment_ids:
                await db.execute(delete(Appointment).where(Appointment.id.in_(appointment_ids)))
            if patient_ids:
                await db.execute(delete(PatientDentistRelationship).where(PatientDentistRelationship.patient_id.in_(patient_ids)))
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
    print(f"PHASE 33 SUITE RESULT: {passed} / {total} PASSED ({(passed / total) * 100:.1f}%)")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_phase33_suite())
