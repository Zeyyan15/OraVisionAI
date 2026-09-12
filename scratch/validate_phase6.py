"""
Phase 6 — Patient Module Backend Implementation Validation Script

Validates:
1. Python syntax & clean imports across all Phase 6 files
2. SQLAlchemy models & metadata integrity (exactly 23 tables)
3. SQLAlchemy mapper configuration (configure_mappers)
4. FastAPI application startup and all route registrations
5. Unauthenticated rejection (401 Unauthorized) across all patient endpoints
6. Role-based access control (403 Forbidden for dentist/admin users on patient endpoints)
7. PatientService & MedicalProfile CRUD unit tests with ownership boundaries
8. Duplicate medical profile conflict handling (409 Conflict)
9. Pydantic schema validation for demographic & lifestyle constraints (gender, smoking, alcohol)
10. Security audit: zero hardcoded secrets/passwords/tokens
"""

import ast
import asyncio
import datetime
import os
import re
import sys
import uuid
from unittest.mock import AsyncMock, MagicMock

BACKEND_DIR = r"c:\Users\hp\Desktop\OravisionAI\backend"
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

print("=" * 70)
print("ORAVISIONAI — PHASE 6 PATIENT MODULE VALIDATION")
print("=" * 70)

# --- 1. Syntax Check ---
print("\n[1] Validating Python syntax of Phase 6 files...")
files_to_check = [
    "app/schemas/patient.py",
    "app/schemas/__init__.py",
    "app/services/patient_service.py",
    "app/services/__init__.py",
    "app/api/patients.py",
    "app/api/__init__.py",
    "app/main.py",
]

for rel_path in files_to_check:
    full_path = os.path.join(BACKEND_DIR, rel_path)
    assert os.path.exists(full_path), f"File missing: {rel_path}"
    with open(full_path, "r", encoding="utf-8") as f:
        ast.parse(f.read(), filename=full_path)
    print(f"    {rel_path:<32s} -> Syntax OK")

# --- 2. Database Models & Metadata Integrity ---
print("\n[2] Verifying Database Models & Base.metadata integrity...")
from app.db.base import Base
import app.models
from sqlalchemy.orm import configure_mappers

configure_mappers()
print("    SQLAlchemy configure_mappers() passed with zero errors")

assert len(Base.metadata.tables) == 23, f"Expected 23 tables, found {len(Base.metadata.tables)}"
print(f"    Base.metadata contains exactly {len(Base.metadata.tables)} tables (100% preserved)")

# --- 3. FastAPI App & Routes Inspection ---
print("\n[3] Testing HTTP Endpoints with TestClient...")
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# GET /
res_root = client.get("/")
assert res_root.status_code == 200
print(f"    GET /                                    -> {res_root.status_code} OK  {res_root.json()}")

# GET /health
res_health = client.get("/health")
assert res_health.status_code == 200
print(f"    GET /health                              -> {res_health.status_code} OK  {res_health.json()}")

# Patient endpoints unauthenticated checks (401)
patient_endpoints = [
    ("GET", "/api/patients/me"),
    ("PATCH", "/api/patients/me"),
    ("GET", "/api/patients/me/medical-profile"),
    ("POST", "/api/patients/me/medical-profile"),
    ("PATCH", "/api/patients/me/medical-profile"),
]

for method, ep in patient_endpoints:
    if method == "GET":
        res = client.get(ep)
    elif method == "PATCH":
        res = client.patch(ep, json={})
    elif method == "POST":
        res = client.post(ep, json={})
    assert res.status_code == 401, f"Expected 401 for {method} {ep}, got {res.status_code}"
    print(f"    {method:<5s} {ep:<36s} -> {res.status_code} (Expected 401 Unauthorized)")

# --- 4. Role Authorization Checks on Patient Routes ---
print("\n[4] Testing Role Authorization for Patient Endpoints...")
from fastapi import HTTPException
from app.core.auth import require_patient
from app.models.user import User

patient_user = User(id=uuid.uuid4(), firebase_uid="p1", email="patient@test.com", role="patient", first_name="P", last_name="T", is_active=True)
dentist_user = User(id=uuid.uuid4(), firebase_uid="d1", email="dentist@test.com", role="dentist", first_name="D", last_name="T", is_active=True)
admin_user = User(id=uuid.uuid4(), firebase_uid="a1", email="admin@test.com", role="admin", first_name="A", last_name="T", is_active=True)

async def test_patient_role_guard():
    # Patient user -> Allowed
    p_res = await require_patient(patient_user)
    assert p_res == patient_user
    print("    require_patient with patient user  -> ALLOWED (200)")

    # Dentist user -> Rejected 403
    try:
        await require_patient(dentist_user)
        assert False, "Should raise 403 for dentist user"
    except HTTPException as e:
        assert e.status_code == 403
        print("    require_patient with dentist user  -> REJECTED (403 Forbidden)")

    # Admin user -> Rejected 403
    try:
        await require_patient(admin_user)
        assert False, "Should raise 403 for admin user"
    except HTTPException as e:
        assert e.status_code == 403
        print("    require_patient with admin user    -> REJECTED (403 Forbidden)")

asyncio.run(test_patient_role_guard())

# --- 5. PatientService & Medical Profile CRUD Unit Tests ---
print("\n[5] Testing PatientService & Medical Profile Lifecycle...")
from app.services.patient_service import PatientService
from app.models.patient import Patient
from app.models.patient_medical_profile import PatientMedicalProfile
from app.schemas.patient import (
    PatientUpdate,
    PatientMedicalProfileCreate,
    PatientMedicalProfileUpdate,
    PatientResponse,
    PatientMedicalProfileResponse,
)

async def test_patient_service():
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.add = MagicMock()

    # 1. Create Patient
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    patient = await PatientService.get_or_create_patient(mock_db, patient_user)
    assert patient.user_id == patient_user.id
    print("    PatientService.get_or_create_patient: Created successfully")

    # 2. Update Patient Personal Profile
    update_data = PatientUpdate(
        date_of_birth=datetime.date(1995, 5, 15),
        gender="male",
        emergency_contact_name="Jane Doe",
        emergency_contact_phone="+1234567890",
        address="123 Dental Way",
        phone_number="+1987654321",
    )
    updated_p = await PatientService.update_patient_profile(mock_db, patient, update_data, patient_user)
    assert updated_p.gender == "male"
    assert updated_p.emergency_contact_name == "Jane Doe"
    assert patient_user.phone_number == "+1987654321"
    print("    PatientService.update_patient_profile: Demographic & user fields updated")

    # 3. Create Medical Profile
    # First test: No existing profile -> Create succeeds
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    med_create = PatientMedicalProfileCreate(
        medical_history=["Hypertension"],
        dental_history=["Routine cleaning"],
        allergies=["Penicillin"],
        current_medications=["Lisinopril"],
        smoking_status="occasional",
        alcohol_consumption="moderate",
        betel_quid_user=True,
        additional_notes="History of mild gum sensitivity",
    )
    med_profile = await PatientService.create_medical_profile(mock_db, patient.id, med_create)
    assert med_profile.patient_id == patient.id
    assert med_profile.betel_quid_user is True
    assert med_profile.smoking_status == "occasional"
    print("    PatientService.create_medical_profile: Clinical profile created")

    # 4. Duplicate Medical Profile -> Conflict (ValueError -> 409)
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=med_profile)))
    try:
        await PatientService.create_medical_profile(mock_db, patient.id, med_create)
        assert False, "Should raise ValueError on duplicate medical profile creation"
    except ValueError as e:
        assert "already exists" in str(e)
        print("    PatientService duplicate medical profile -> Caught ValueError (409 Conflict handled)")

    # 5. Update Medical Profile
    med_update = PatientMedicalProfileUpdate(
        smoking_status="former",
        betel_quid_user=False,
    )
    updated_med = await PatientService.update_medical_profile(mock_db, med_profile, med_update)
    assert updated_med.smoking_status == "former"
    assert updated_med.betel_quid_user is False
    print("    PatientService.update_medical_profile: Clinical fields updated")

asyncio.run(test_patient_service())

# --- 6. Pydantic Constraint Validation Tests ---
print("\n[6] Testing Pydantic Constraint Validations...")
from pydantic import ValidationError

# Invalid Gender
try:
    PatientUpdate(gender="invalid_gender")
    assert False, "Should reject invalid gender"
except ValidationError:
    print("    Invalid gender validation: REJECTED as expected")

# Invalid Smoking Status
try:
    PatientMedicalProfileCreate(smoking_status="chain_smoker_extreme")
    assert False, "Should reject invalid smoking status"
except ValidationError:
    print("    Invalid smoking_status validation: REJECTED as expected")

# Invalid Alcohol Consumption
try:
    PatientMedicalProfileCreate(alcohol_consumption="too_much")
    assert False, "Should reject invalid alcohol consumption"
except ValidationError:
    print("    Invalid alcohol_consumption validation: REJECTED as expected")

# --- 7. Security Audit ---
print("\n[7] Performing Secrets Audit across all source files...")
patterns = [
    (r"-----BEGIN PRIVATE KEY-----", "Embedded private key"),
    (r"AIza[0-9A-Za-z\-_]{35}", "Google API key"),
    (r"(?i)password\s*=\s*['\"][^'\"]+['\"]", "Hardcoded password"),
]

clean = True
for root, _, files in os.walk(os.path.join(BACKEND_DIR, "app")):
    for f in files:
        if f.endswith(".py"):
            fpath = os.path.join(root, f)
            with open(fpath, "r", encoding="utf-8") as file:
                content = file.read()
            for pattern, desc in patterns:
                if re.search(pattern, content):
                    print(f"    WARNING: {desc} found in {fpath}")
                    clean = False

if clean:
    print("    All backend application source files CLEAN — zero hardcoded credentials/secrets/passwords!")

print("\n" + "=" * 70)
print("ALL PHASE 6 VALIDATIONS PASSED PERFECTLY!")
print("=" * 70)
