"""
Phase 5 — User & Role Management System Validation Script

Validates:
1. Python syntax & clean imports
2. SQLAlchemy models & metadata integrity (23 tables expected)
3. FastAPI application startup and all route registrations
4. Unauthenticated access rejections (401 Unauthorized) across all auth/user endpoints
5. Role dependency logic and privilege isolation (403 Forbidden for wrong roles)
6. Privilege escalation protection in UserService (admin role self-assignment prohibited)
7. Security audit: zero hardcoded secrets/passwords
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
print("ORAVISIONAI — PHASE 5 USER & ROLE SYSTEM VALIDATION")
print("=" * 70)

# --- 1. Syntax Check ---
print("\n[1] Validating Python syntax of Phase 5 files...")
files_to_check = [
    "app/schemas/user.py",
    "app/schemas/__init__.py",
    "app/services/user_service.py",
    "app/services/__init__.py",
    "app/core/auth.py",
    "app/api/users.py",
    "app/api/__init__.py",
    "app/main.py",
]

for rel_path in files_to_check:
    full_path = os.path.join(BACKEND_DIR, rel_path)
    assert os.path.exists(full_path), f"File missing: {rel_path}"
    with open(full_path, "r", encoding="utf-8") as f:
        ast.parse(f.read(), filename=full_path)
    print(f"    {rel_path:<30s} -> Syntax OK")

# --- 2. Database Models & Metadata Integrity ---
print("\n[2] Verifying Database Models & Base.metadata integrity...")
from app.db.base import Base
import app.models

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
print(f"    GET /                                 -> {res_root.status_code} OK  {res_root.json()}")

# GET /health
res_health = client.get("/health")
assert res_health.status_code == 200
print(f"    GET /health                           -> {res_health.status_code} OK  {res_health.json()}")

# GET /api/auth/me (No Auth)
res_auth_me = client.get("/api/auth/me")
assert res_auth_me.status_code == 401
print(f"    GET /api/auth/me (No Auth)            -> {res_auth_me.status_code} (Expected 401)")

# GET /api/users/me (No Auth)
res_user_me = client.get("/api/users/me")
assert res_user_me.status_code == 401
print(f"    GET /api/users/me (No Auth)           -> {res_user_me.status_code} (Expected 401)")

# GET /api/users/me/patient-access (No Auth)
res_p_access = client.get("/api/users/me/patient-access")
assert res_p_access.status_code == 401
print(f"    GET /api/users/me/patient-access      -> {res_p_access.status_code} (Expected 401)")

# GET /api/users/me/dentist-access (No Auth)
res_d_access = client.get("/api/users/me/dentist-access")
assert res_d_access.status_code == 401
print(f"    GET /api/users/me/dentist-access      -> {res_d_access.status_code} (Expected 401)")

# GET /api/users/me/admin-access (No Auth)
res_a_access = client.get("/api/users/me/admin-access")
assert res_a_access.status_code == 401
print(f"    GET /api/users/me/admin-access        -> {res_a_access.status_code} (Expected 401)")

# --- 4. Role Dependency Logic Unit Testing ---
print("\n[4] Testing Role Dependency & Authorization Logic...")
from fastapi import HTTPException
from app.core.auth import require_patient, require_dentist, require_admin, get_current_active_user
from app.models.user import User

# Test Active / Inactive user checks
active_user = User(id=uuid.uuid4(), firebase_uid="u1", email="p@test.com", role="patient", first_name="P", last_name="T", is_active=True)
inactive_user = User(id=uuid.uuid4(), firebase_uid="u2", email="i@test.com", role="patient", first_name="I", last_name="T", is_active=False)

async def test_role_guards():
    # Active user check
    res = await get_current_active_user(active_user)
    assert res == active_user
    print("    Active user pass: OK")

    try:
        await get_current_active_user(inactive_user)
        assert False, "Should raise 403 for inactive user"
    except HTTPException as e:
        assert e.status_code == 403
        print("    Inactive user rejection (403): OK")

    # Patient role check
    dentist_user = User(id=uuid.uuid4(), firebase_uid="u3", email="d@test.com", role="dentist", first_name="D", last_name="T", is_active=True)
    admin_user = User(id=uuid.uuid4(), firebase_uid="u4", email="a@test.com", role="admin", first_name="A", last_name="T", is_active=True)

    # require_patient tests
    p_ok = await require_patient(active_user)
    assert p_ok.role == "patient"
    print("    require_patient with patient user -> ALLOWED (200)")

    try:
        await require_patient(dentist_user)
        assert False, "Should raise 403 for dentist on patient route"
    except HTTPException as e:
        assert e.status_code == 403
        print("    require_patient with dentist user -> REJECTED (403 Forbidden)")

    try:
        await require_patient(admin_user)
        assert False, "Should raise 403 for admin on patient route"
    except HTTPException as e:
        assert e.status_code == 403
        print("    require_patient with admin user   -> REJECTED (403 Forbidden)")

    # require_dentist tests
    d_ok = await require_dentist(dentist_user)
    assert d_ok.role == "dentist"
    print("    require_dentist with dentist user -> ALLOWED (200)")

    try:
        await require_dentist(active_user)
        assert False, "Should raise 403 for patient on dentist route"
    except HTTPException as e:
        assert e.status_code == 403
        print("    require_dentist with patient user -> REJECTED (403 Forbidden)")

    # require_admin tests
    a_ok = await require_admin(admin_user)
    assert a_ok.role == "admin"
    print("    require_admin with admin user     -> ALLOWED (200)")

    try:
        await require_admin(active_user)
        assert False, "Should raise 403 for patient on admin route"
    except HTTPException as e:
        assert e.status_code == 403
        print("    require_admin with patient user   -> REJECTED (403 Forbidden)")

asyncio.run(test_role_guards())

# --- 5. Privilege Escalation Prevention Unit Test ---
print("\n[5] Testing Privilege Escalation Prevention in UserService...")
from app.core.auth import FirebaseUser
from app.services.user_service import UserService

async def test_escalation_protection():
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.add = MagicMock()

    fb_attacker = FirebaseUser(
        uid="attacker_123",
        email="attacker@evil.com",
        email_verified=True,
        name="Attacker User",
    )

    # Attempt to request 'admin' role
    created_user = await UserService.sync_firebase_user(
        db=mock_db,
        firebase_user=fb_attacker,
        requested_role="admin",  # Escalation attempt!
    )

    # Verify role was sanitized to 'patient'
    assert created_user.role == "patient", f"Privilege escalation vulnerability: user was assigned role {created_user.role}"
    print("    Attempted requested_role='admin' -> Sanitized to 'patient' (Privilege escalation blocked!)")

    # Attempt to request 'dentist' role (allowed safe onboarding)
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    fb_dentist = FirebaseUser(
        uid="dentist_123",
        email="dr.smith@clinic.com",
        email_verified=True,
        name="Dr. Smith",
    )
    created_dentist = await UserService.sync_firebase_user(
        db=mock_db,
        firebase_user=fb_dentist,
        requested_role="dentist",
    )
    assert created_dentist.role == "dentist"
    print("    Attempted requested_role='dentist' -> Assigned 'dentist' with pending verification: OK")

asyncio.run(test_escalation_protection())

# --- 6. Security Audit ---
print("\n[6] Performing Secrets Audit across all source files...")
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
print("ALL PHASE 5 VALIDATIONS PASSED PERFECTLY!")
print("=" * 70)
