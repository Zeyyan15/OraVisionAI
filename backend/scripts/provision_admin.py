"""
OraVisionAI — Administrator Account Provisioning CLI Script

Safe, standalone utility for platform operators to provision or promote administrator accounts in PostgreSQL.
Does NOT execute automatically. Run manually when admin access is required.

Usage:
    .venv/Scripts/python scripts/provision_admin.py --email admin@oravision.ai
    .venv/Scripts/python scripts/provision_admin.py --email admin@oravision.ai --first-name Super --last-name Admin
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from sqlalchemy import select
from app.db.session import get_session_factory
from app.models.user import User


async def provision_admin(
    email: str,
    first_name: str = "Admin",
    last_name: str = "Oversight",
    firebase_uid: str | None = None,
) -> None:
    factory = get_session_factory()
    async with factory() as db:
        stmt = select(User).where(User.email == email.strip().lower())
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is not None:
            old_role = user.role
            user.role = "admin"
            if first_name and user.first_name in ("User", ""):
                user.first_name = first_name
            if last_name and user.last_name in ("User", ""):
                user.last_name = last_name
            if firebase_uid and not user.firebase_uid:
                user.firebase_uid = firebase_uid
            user.is_active = True
            await db.commit()
            print(f"[SUCCESS] User '{user.email}' (ID: {user.id}) updated from role='{old_role}' to role='admin'.")
        else:
            uid = firebase_uid or f"admin_{uuid.uuid4().hex[:12]}"
            new_admin = User(
                id=uuid.uuid4(),
                firebase_uid=uid,
                email=email.strip().lower(),
                role="admin",
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_email_verified=True,
            )
            db.add(new_admin)
            await db.commit()
            print(f"[SUCCESS] New administrator created: '{new_admin.email}' (ID: {new_admin.id}, role='admin').")


def main():
    parser = argparse.ArgumentParser(description="Provision or promote an administrator account in OraVisionAI.")
    parser.add_argument("--email", required=True, help="Email address of the administrator.")
    parser.add_argument("--first-name", default="Admin", help="First name of the administrator.")
    parser.add_argument("--last-name", default="Oversight", help="Last name of the administrator.")
    parser.add_argument("--firebase-uid", default=None, help="Optional existing Firebase UID.")

    args = parser.parse_args()
    asyncio.run(provision_admin(
        email=args.email,
        first_name=args.first_name,
        last_name=args.last_name,
        firebase_uid=args.firebase_uid,
    ))


if __name__ == "__main__":
    main()

