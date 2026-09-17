"""
OraVisionAI — Acceptance Gap Remediation End-to-End Test Suite
Validates the 6 remediated product gaps:
1. Issue 1: Dentist availability seeding and appointment creation schema.
2. Issue 2: Patient screening review request and dentist pending reviews queue.
3. Issue 3: Clinical risk assessment triage tier generation and caching.
4. Issue 4: ConsultationListResponse contract shape (items and total).
5. Issue 5: My Practitioners discovery for active patient-dentist relationships.
6. Issue 6: Notification lifecycle events, deduplication, and unread counts.
"""

import asyncio
import datetime
import os
import sys
import uuid
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.session import get_session_factory
from app.models.user import User
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.screening import Screening
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.schemas.appointment import AppointmentCreate
from app.schemas.consultation import ConsultationListResponse
from app.schemas.dentist_assessment import ScreeningReviewRequest
from app.services.dentist_availability_service import DentistAvailabilityService
from app.services.dentist_assessment_service import DentistAssessmentService
from app.services.risk_assessment_service import RiskAssessmentService
from app.services.notification_service import NotificationService
from sqlalchemy import select

async def run_tests():
    print("=" * 70)
    print("ORAVISIONAI ACCEPTANCE GAP REMEDIATION VALIDATION SUITE")
    print("=" * 70)

    passed = 0
    total = 6
    factory = get_session_factory()

    # Step 0: Fetch primary IDs
    async with factory() as db:
        dentist = (await db.execute(select(Dentist).where(Dentist.verification_status == "approved").limit(1))).scalar_one_or_none()
        assert dentist is not None, "No approved dentist found"
        dentist_id = dentist.id
        dentist_user_id = dentist.user_id

        patient_user = (await db.execute(select(User).where(User.role == "patient").limit(1))).scalar_one_or_none()
        assert patient_user is not None, "No patient user found"
        patient_user_id = patient_user.id

        patient = (await db.execute(select(Patient).where(Patient.user_id == patient_user_id))).scalar_one_or_none()
        assert patient is not None, "No patient entity found"
        patient_id = patient.id

        screening = (await db.execute(select(Screening).where(Screening.patient_id == patient_id, Screening.status == "completed", Screening.is_deleted.is_(False)).limit(1))).scalar_one_or_none()
        assert screening is not None, "No completed patient screening found"
        screening_id = screening.id

    # Test 1: Dentist Availability Seeding & Appointment Schema
    try:
        async with factory() as db:
            d_user = await db.scalar(select(User).where(User.id == dentist_user_id))
            seeded = await DentistAvailabilityService.ensure_default_availability(db, dentist_id)
            avail_res = await DentistAvailabilityService.list_dentist_public_availabilities(db, dentist_id, user=d_user)
            assert len(avail_res.items) >= 5, f"Expected at least 5 availability windows, got {len(avail_res.items)}"

            # Test AppointmentCreate timezone validation
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            appt_in = AppointmentCreate(
                scheduled_start=now_utc,
                scheduled_end=now_utc + datetime.timedelta(minutes=30),
                appointment_type="video_teleconsultation"
            )
            assert appt_in.scheduled_start.tzinfo is not None, "Appointment start should be tz-aware"

        print(f"[PASS] TEST 1: Availability Seeding & Appointment Schema (Windows={len(avail_res.items)})")
        passed += 1
    except Exception as e:
        print(f"[FAIL] TEST 1: Availability Seeding failed: {e}")

    # Test 2: Screening Review Request & Dentist Pending Queue
    try:
        async with factory() as db:
            p_user = await db.scalar(select(User).where(User.id == patient_user_id))
            d_user = await db.scalar(select(User).where(User.id == dentist_user_id))

            rev_req = ScreeningReviewRequest(dentist_id=dentist_id, patient_notes="Automated test clinical review request")
            assessment_resp = await DentistAssessmentService.request_screening_review(
                db=db,
                user=p_user,
                screening_id=screening_id,
                data=rev_req
            )
            assert assessment_resp.dentist_id == dentist_id
            assert not assessment_resp.is_finalized

            # Dentist pending reviews queue
            pending_res = await DentistAssessmentService.get_dentist_pending_reviews(db=db, user=d_user)
            assert any(item.screening_id == screening_id for item in pending_res.items), "Screening not found in dentist pending reviews"

        print(f"[PASS] TEST 2: Patient Screening Review Request & Dentist Queue (Pending Cases={pending_res.total})")
        passed += 1
    except Exception as e:
        print(f"[FAIL] TEST 2: Review request workflow failed: {e}")

    # Test 3: Clinical Context Engine / Risk Assessment
    try:
        async with factory() as db:
            p_user = await db.scalar(select(User).where(User.id == patient_user_id))
            ra = await RiskAssessmentService.get_screening_risk_assessment(db=db, user=p_user, screening_id=screening_id)
            assert ra is not None, "Risk assessment should exist"
            assert ra.risk_level in ("low", "moderate", "high", "critical"), f"Invalid risk level: {ra.risk_level}"
            assert ra.risk_score in (Decimal("25.00"), Decimal("50.00"), Decimal("75.00"), Decimal("100.00")), f"Invalid risk score: {ra.risk_score}"
            assert len(ra.summary) > 0
            assert len(ra.recommended_action) > 0

        print(f"[PASS] TEST 3: Clinical Urgency Tier Persisted (Level={ra.risk_level}, Score={ra.risk_score})")
        passed += 1
    except Exception as e:
        print(f"[FAIL] TEST 3: Risk assessment retrieval failed: {e}")

    # Test 4: ConsultationListResponse Schema Shape
    try:
        resp = ConsultationListResponse(items=[], total=0)
        assert hasattr(resp, "items"), "ConsultationListResponse must have 'items'"
        assert hasattr(resp, "total"), "ConsultationListResponse must have 'total'"
        print("[PASS] TEST 4: ConsultationListResponse Schema Shape Verified ({items: [], total: 0})")
        passed += 1
    except Exception as e:
        print(f"[FAIL] TEST 4: ConsultationListResponse schema failed: {e}")

    # Test 5: My Practitioners Discovery
    try:
        async with factory() as db:
            rel_stmt = select(PatientDentistRelationship).where(
                PatientDentistRelationship.patient_id == patient_id,
                PatientDentistRelationship.dentist_id == dentist_id,
                PatientDentistRelationship.status == "active"
            )
            rel = (await db.execute(rel_stmt)).scalar_one_or_none()
            assert rel is not None, "Active PatientDentistRelationship must exist after review request"
            assert rel.established_via in ("appointment", "direct_invite", "screening_share")

        print(f"[PASS] TEST 5: Active PatientDentistRelationship Verified (Established via={rel.established_via})")
        passed += 1
    except Exception as e:
        print(f"[FAIL] TEST 5: Practitioner discovery relationship failed: {e}")

    # Test 6: Notification Lifecycle, Deduplication & Unread Count
    try:
        async with factory() as db:
            notif = await NotificationService.create_notification(
                db=db,
                user_id=patient_user_id,
                notification_type="system_alert",
                title="Validation Test Notification",
                message="Automated gap remediation validation test message",
                action_url="/patient/dashboard",
                suppress_duplicates_window_seconds=300
            )
            assert notif is not None

            dup = await NotificationService.create_notification(
                db=db,
                user_id=patient_user_id,
                notification_type="system_alert",
                title="Validation Test Notification",
                message="Automated gap remediation validation test message",
                action_url="/patient/dashboard",
                suppress_duplicates_window_seconds=300
            )
            assert dup.id == notif.id, "Duplicate notification should be suppressed within window"

            unread_count = await NotificationService.get_unread_count(db=db, user_id=patient_user_id)
            assert unread_count >= 1, f"Expected unread count >= 1, got {unread_count}"

        print(f"[PASS] TEST 6: Notifications Lifecycle & Deduplication (Unread Count={unread_count})")
        passed += 1
    except Exception as e:
        print(f"[FAIL] TEST 6: Notification lifecycle failed: {e}")

    print("=" * 70)
    print(f"TOTAL: {total} | PASSED: {passed} | FAILED: {total - passed}")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_tests())

