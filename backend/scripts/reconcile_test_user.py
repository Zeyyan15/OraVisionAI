"""
OraVisionAI — Test Account Reconciliation CLI Script

Utility for developers and platform operators to safely reconcile test user accounts in PostgreSQL.
Does NOT execute automatically. Run explicitly to adjust test account roles and profiles.

Usage:
    .venv/Scripts/python scripts/reconcile_test_user.py --email ali@gmail.com --target-role dentist --status pending
    .venv/Scripts/python scripts/reconcile_test_user.py --email ali@gmail.com --target-role dentist --status approved
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import os
import sys
import uuid

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_session_factory
from app.models.user import User
from app.models.dentist import Dentist
from app.models.patient import Patient


async def reconcile_user(
    email: str,
    target_role: str = "dentist",
    status: str = "pending",
    license_number: str | None = None,
) -> None:
    factory = get_session_factory()
    async with factory() as db:
        stmt = (
            select(User)
            .where(User.email == email.strip().lower())
            .options(
                selectinload(User.dentist),
                selectinload(User.patient),
            )
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            print(f"[ERROR] User with email '{email}' not found in database.")
            sys.exit(1)

        print(f"Current State -> User: {user.email} | Role: {user.role} | Dentist: {user.dentist.verification_status if user.dentist else None} | Patient: {user.patient is not None}")

        now = datetime.datetime.now(datetime.timezone.utc)
        user.role = target_role

        if target_role == "dentist":
            if user.dentist is None:
                lic = license_number or f"DENT-{uuid.uuid4().hex[:8].upper()}"
                dentist = Dentist(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    license_number=lic,
                    specialization="General Dentistry",
                    verification_status=status,
                    verified_at=now if status == "approved" else None,
                )
                db.add(dentist)
                print(f"Created Dentist profile with status='{status}' and license='{lic}'.")
            else:
                user.dentist.verification_status = status
                if status == "approved":
                    user.dentist.verified_at = now
                print(f"Updated existing Dentist profile to status='{status}'.")

        elif target_role == "patient":
            if user.patient is None:
                patient = Patient(
                    id=uuid.uuid4(),
                    user_id=user.id,
                )
                db.add(patient)
                print("Created Patient profile.")

        await db.commit()
        await db.refresh(user)
        print(f"[SUCCESS] Reconciled User '{user.email}' -> Role: {user.role}")


def main():
    parser = argparse.ArgumentParser(description="Reconcile a test user account in OraVisionAI.")
    parser.add_argument("--email", required=True, help="Email address of the account to reconcile.")
    parser.add_argument("--target-role", choices=["dentist", "patient", "admin"], default="dentist", help="Target role.")
    parser.add_argument("--status", choices=["pending", "approved", "rejected"], default="pending", help="Dentist verification status (if target-role is dentist).")
    parser.add_argument("--license", default=None, help="Dentist license number override.")

    args = parser.parse_args()
    asyncio.run(reconcile_user(
        email=args.email,
        target_role=args.target_role,
        status=args.status,
        license_number=args.license,
    ))


if __name__ == "__main__":
    main()

