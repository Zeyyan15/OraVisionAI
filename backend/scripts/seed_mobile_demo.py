r"""Add repeatable, clearly labelled demo records to an existing LOCAL patient account.

Run from backend/: venv\Scripts\python.exe scripts/seed_mobile_demo.py --email YOUR_EMAIL
Does not create Firebase accounts, send messages externally, or change existing records.
"""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import os
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Avoid logging SQL parameters (account information) during the seed.
os.environ["DEBUG"] = "false"

from sqlalchemy import select
from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.db.session import dispose_engine, get_session_factory
from app.models import (
    Appointment, Conversation, Dentist, DentistAvailability, Message,
    Notification, Patient, PatientDentistRelationship, User,
)

NAMESPACE = uuid.UUID("684d575f-a7a9-4334-908e-8cf8b18f5e65")


def record_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, key)


async def seed(email: str) -> None:
    settings = get_settings()
    url = make_url(settings.database_url)
    if settings.environment != "development" or url.host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Demo seeds require a development environment and a local database.")
    data = json.loads((Path(__file__).parent / "seed_data/mobile_demo.json").read_text())
    created: dict[str, int] = {}
    now = dt.datetime.now(dt.timezone.utc)
    async with get_session_factory()() as db:
        async with db.begin():
            user = await db.scalar(select(User).where(User.email == email.strip().lower()))
            if user is None or user.role != "patient" or not user.is_active:
                raise ValueError("Sign in first using an active patient account, then supply its email.")
            patient = await db.scalar(select(Patient).where(Patient.user_id == user.id))
            if patient is None:
                raise ValueError("The selected account has no patient profile.")

            async def add(model, key, **values):
                identity = record_id(key)
                existing = await db.get(model, identity)
                if existing is not None:
                    return existing
                obj = model(id=identity, **values)
                db.add(obj)
                await db.flush()
                created[model.__name__] = created.get(model.__name__, 0) + 1
                return obj

            for index, info in enumerate(data["doctors"]):
                key = info["key"]
                doctor_user = await add(
                    User, f"doctor-user:{key}", firebase_uid=f"local-demo-{key}",
                    email=f"{key}@mobile-demo.example.test", role="dentist",
                    first_name=info["first_name"], last_name=info["last_name"],
                    is_active=True, is_email_verified=False,
                )
                dentist = await add(
                    Dentist, f"dentist:{key}", user_id=doctor_user.id,
                    license_number=f"LOCAL-DEMO-{key.upper()}",
                    specialization=info["specialization"], clinic_name=info["clinic_name"],
                    years_of_experience=info["years_of_experience"], bio=info["bio"],
                    verification_status="approved", verified_at=now,
                )
                for weekday in range(7):
                    await add(
                        DentistAvailability, f"availability:{key}:{weekday}", dentist_id=dentist.id,
                        day_of_week=weekday, start_time=dt.time(9), end_time=dt.time(12),
                        slot_duration_minutes=30, is_active=True,
                    )
                scope = f"patient:{patient.id}:{key}"
                # Respect an existing relationship or conversation for this pair.
                relationship = await db.scalar(select(PatientDentistRelationship).where(
                    PatientDentistRelationship.patient_id == patient.id,
                    PatientDentistRelationship.dentist_id == dentist.id,
                ))
                if relationship is None:
                    await add(
                        PatientDentistRelationship, f"relationship:{scope}",
                        patient_id=patient.id, dentist_id=dentist.id,
                        status="active", established_via="appointment",
                    )
                for label, day_offset, status, kind in [
                    ("upcoming", index + 1, "confirmed", "in_person_consultation"),
                    ("requested", index + 5, "requested", "follow_up"),
                ]:
                    start = (now + dt.timedelta(days=day_offset)).replace(hour=10, minute=0, second=0, microsecond=0)
                    await add(
                        Appointment, f"appointment:{scope}:{label}",
                        patient_id=patient.id, dentist_id=dentist.id,
                        scheduled_start=start, scheduled_end=start + dt.timedelta(minutes=30),
                        appointment_type=kind, status=status,
                        patient_notes="[Demo] Sample appointment for exploring the app. No real booking.",
                    )
                conversation = await db.scalar(select(Conversation).where(
                    Conversation.patient_id == patient.id, Conversation.dentist_id == dentist.id,
                    Conversation.conversation_type == "direct",
                ))
                if conversation is None:
                    conversation = await add(
                        Conversation, f"conversation:{scope}", patient_id=patient.id,
                        dentist_id=dentist.id, stream_channel_id=f"local-demo-{record_id(scope)}",
                        conversation_type="direct", is_active=True, last_message_at=now,
                    )
                for number, content in enumerate([
                    info["welcome"],
                    "[Demo] You can open your schedule or explore this chat. No real clinician is connected to this demo profile.",
                ]):
                    await add(
                        Message, f"message:{scope}:{number}", conversation_id=conversation.id,
                        sender_id=doctor_user.id, content=content, message_type="text", is_read=False,
                        created_at=now - dt.timedelta(minutes=2 - number),
                    )
                await add(
                    Notification, f"notification:{scope}", user_id=user.id,
                    notification_type="new_message", title=f"Demo message from {info['first_name']}",
                    message="Sample messages and appointments are ready to explore.",
                    action_url=f"/conversation/{conversation.id}", is_read=False,
                )
    print("Demo seed complete. Added: " + (", ".join(f"{count} {name}" for name, count in created.items()) or "0 records (already seeded)"))


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True, help="Existing local patient account email")
    args = parser.parse_args()
    try:
        await seed(args.email)
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
