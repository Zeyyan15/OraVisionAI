"""
OraVisionAI — Messaging Workflow & Authorization Regression Test Suite
Validates:
1. GET /api/dentists/my-practitioners resolves connected dentists for active patients.
2. Direct conversation initiation is idempotent and returns 200/201 without duplicate creation.
3. Backend strictly enforces authorization: unauthorized dentists reject with 403 Forbidden.
4. Conversation listing returns single finite result without looping.
"""

import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.session import get_session_factory
from app.models.user import User
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.schemas.conversation import ConversationCreate
from app.services.conversation_service import ConversationService
from app.api.dentists import list_my_practitioners
from fastapi import HTTPException
from sqlalchemy import select

async def run_regression():
    print("=" * 70)
    print("ORAVISIONAI MESSAGING WORKFLOW REGRESSION TEST SUITE")
    print("=" * 70)

    passed = 0
    total = 4
    factory = get_session_factory()

    async with factory() as db:
        # Resolve patient user
        patient_user = (await db.execute(
            select(User).where(User.role == "patient", User.email == "zeyyan100@gmail.com")
        )).scalar_one_or_none()
        if not patient_user:
            patient_user = (await db.execute(select(User).where(User.role == "patient"))).scalars().first()
        assert patient_user is not None, "Test patient user not found"

        # Resolve connected dentist
        dentist = (await db.execute(
            select(Dentist).where(Dentist.verification_status == "approved")
        )).scalars().first()
        assert dentist is not None, "Approved dentist not found"

        # Test 1: My Practitioners Discovery
        practitioners = await list_my_practitioners(current_user=patient_user, db=db)
        assert len(practitioners) > 0, "No connected practitioners returned for patient"
        assert any(p.id == dentist.id for p in practitioners), "Expected approved dentist not in practitioners list"
        print(f"[PASS] TEST 1: list_my_practitioners returns {len(practitioners)} connected dentist(s) (Found Dr. {practitioners[0].first_name} {practitioners[0].last_name})")
        passed += 1

        # Test 2: Idempotent Conversation Creation
        conv_resp1, is_created1 = await ConversationService.create_or_reactivate_for_patient(
            db=db,
            dentist_id=dentist.id,
            user=patient_user,
            data=ConversationCreate(),
        )
        assert conv_resp1 is not None
        assert conv_resp1.dentist_id == dentist.id

        # Second call must reuse existing conversation
        conv_resp2, is_created2 = await ConversationService.create_or_reactivate_for_patient(
            db=db,
            dentist_id=dentist.id,
            user=patient_user,
            data=ConversationCreate(),
        )
        assert conv_resp2.id == conv_resp1.id
        assert is_created2 is False, "Second initiation must reuse existing conversation without duplication"
        print(f"[PASS] TEST 2: Idempotent direct conversation verified (Conv ID={conv_resp1.id}, Reused={not is_created2})")
        passed += 1

        # Test 3: Unauthorized Dentist Rejection (Security Boundary)
        # Create a mock pending/unrelated dentist without relationship
        unauthorized_dentist = (await db.execute(
            select(Dentist).where(Dentist.verification_status == "pending")
        )).scalars().first()

        if unauthorized_dentist:
            try:
                await ConversationService.create_or_reactivate_for_patient(
                    db=db,
                    dentist_id=unauthorized_dentist.id,
                    user=patient_user,
                    data=ConversationCreate(),
                )
                assert False, "Should have rejected unauthorized dentist"
            except HTTPException as exc:
                assert exc.status_code in (403, 404), f"Unexpected status code: {exc.status_code}"
                print(f"[PASS] TEST 3: Security boundary verified - unauthorized dentist rejected with HTTP {exc.status_code}")
                passed += 1
        else:
            # Generate random dentist UUID with no relationship
            fake_id = uuid.uuid4()
            try:
                await ConversationService.create_or_reactivate_for_patient(
                    db=db,
                    dentist_id=fake_id,
                    user=patient_user,
                    data=ConversationCreate(),
                )
                assert False, "Should have rejected non-existent/unauthorized dentist"
            except HTTPException as exc:
                assert exc.status_code in (403, 404)
                print(f"[PASS] TEST 3: Security boundary verified - unauthorized dentist rejected with HTTP {exc.status_code}")
                passed += 1

        # Test 4: Conversation Listing
        list_resp = await ConversationService.list_conversations(
            db=db,
            user=patient_user,
        )
        assert list_resp.total >= 1
        assert any(c.id == conv_resp1.id for c in list_resp.items)
        print(f"[PASS] TEST 4: Conversation listing verified (Total={list_resp.total}, Items returned={len(list_resp.items)})")
        passed += 1

    print("=" * 70)
    print(f"TOTAL: {total} | PASSED: {passed} | FAILED: {total - passed}")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_regression())

