import asyncio
import os
import sys
from sqlalchemy import select

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.session import get_session_factory
from app.models.user import User
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.appointment import Appointment
from app.api.dentists import list_my_practitioners

async def check():
    factory = get_session_factory()
    async with factory() as db:
        users = (await db.execute(select(User))).scalars().all()
        print(f"Total Users: {len(users)}")
        for u in users:
            print(f"  User id={u.id}, email={u.email}, role={u.role}, active={u.is_active}")

        patients = (await db.execute(select(Patient))).scalars().all()
        print(f"\nTotal Patients: {len(patients)}")
        for p in patients:
            print(f"  Patient id={p.id}, user_id={p.user_id}")

        dentists = (await db.execute(select(Dentist))).scalars().all()
        print(f"\nTotal Dentists: {len(dentists)}")
        for d in dentists:
            print(f"  Dentist id={d.id}, user_id={d.user_id}, clinic={d.clinic_name}, status={d.verification_status}")

        relationships = (await db.execute(select(PatientDentistRelationship))).scalars().all()
        print(f"\nTotal PatientDentistRelationships: {len(relationships)}")
        for r in relationships:
            print(f"  Rel id={r.id}, patient_id={r.patient_id}, dentist_id={r.dentist_id}, status={r.status}, via={r.established_via}")

        appointments = (await db.execute(select(Appointment))).scalars().all()
        print(f"\nTotal Appointments: {len(appointments)}")
        for a in appointments:
            print(f"  Appt id={a.id}, patient_id={a.patient_id}, dentist_id={a.dentist_id}, status={a.status}, start={a.scheduled_start}")

        # Check list_my_practitioners for each patient user
        for u in users:
            if u.role == "patient":
                practitioners = await list_my_practitioners(current_user=u, db=db)
                print(f"\nlist_my_practitioners for patient {u.email} ({u.id}): found {len(practitioners)}")
                for pr in practitioners:
                    print(f"    Dentist id={pr.id}, name={pr.first_name} {pr.last_name}, clinic={pr.clinic_name}")

if __name__ == "__main__":
    asyncio.run(check())

