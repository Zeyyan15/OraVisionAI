"""Create Firebase logins for the existing local seeded demo doctors.

Run from backend/: venv/Scripts/python.exe scripts/provision_demo_doctors.py
Passwords are generated once and printed, never written to a file.
Existing Firebase logins are preserved; no password resets or emails are sent.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
import secrets
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DEBUG"] = "false"

from firebase_admin import auth
from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.core.firebase import get_firebase_app
from app.db.session import dispose_engine, get_session_factory
from app.models import Dentist, User
from seed_mobile_demo import record_id


async def provision() -> None:
    settings = get_settings()
    if settings.environment != "development" or make_url(settings.database_url).host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("This script requires the local development database.")
    app = get_firebase_app()
    if app is None:
        raise RuntimeError("Firebase Admin credentials are not configured.")
    data = json.loads((Path(__file__).parent / "seed_data/mobile_demo.json").read_text())
    async with get_session_factory()() as db:
        # Check all profiles before creating any remote accounts.
        users = []
        for doctor in data["doctors"]:
            key = doctor["key"]
            user = await db.get(User, record_id(f"doctor-user:{key}"))
            dentist = await db.get(Dentist, record_id(f"dentist:{key}"))
            if (user is None or dentist is None or user.role != "dentist"
                    or not user.is_active or dentist.user_id != user.id
                    or user.email != f"{key}@mobile-demo.example.test"
                    or user.firebase_uid != f"local-demo-{key}"):
                raise ValueError(f"Missing or changed seed profile for {key}; run the demo seed first.")
            users.append(user)
        for user in users:
            try:
                remote = auth.get_user(user.firebase_uid, app=app)
            except auth.UserNotFoundError:
                # Refuse to take over an existing account with the same email.
                try:
                    remote = auth.get_user_by_email(user.email, app=app)
                except auth.UserNotFoundError:
                    password = secrets.token_urlsafe(15) + "Aa9!"
                    remote = auth.create_user(
                        uid=user.firebase_uid, email=user.email, password=password,
                        display_name=f"{user.first_name} {user.last_name}",
                        email_verified=False, disabled=False, app=app,
                    )
                    # Print immediately so credentials remain available if later work fails.
                    print(f"CREATED {user.email} | Password: {password}", flush=True)
                else:
                    raise ValueError(f"Email already belongs to a different Firebase account: {user.email}")
            if remote.uid != user.firebase_uid or remote.email != user.email or remote.disabled:
                raise ValueError(f"Firebase identity mismatch or disabled account: {user.email}")
            print(f"LINKED {user.email} to existing doctor profile", flush=True)
        print("All three demo doctors can sign in using their existing approved local profiles.")


async def main() -> None:
    try:
        await provision()
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
