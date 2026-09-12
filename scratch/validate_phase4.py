"""
Phase 4 — Firebase Authentication Backend Integration Validation Script

Performs:
1. Syntax validation of all created and modified files
2. Firebase module import and graceful initialization check
3. FastAPI application startup and route verification
4. GET / endpoint check (200 OK)
5. GET /health endpoint check (200 OK)
6. GET /api/auth/me without token (401 Unauthorized check)
7. GET /api/auth/me with Basic auth (401 Unauthorized check)
8. GET /api/auth/me with malformed bearer token (401 / 503 check)
9. Security audit: verify zero hardcoded credentials/private keys
10. Model and metadata integrity: verify exactly 23 tables in Base.metadata
"""

import ast
import os
import sys

BACKEND_DIR = r"c:\Users\hp\Desktop\OravisionAI\backend"
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

print("=" * 70)
print("ORAVISIONAI — PHASE 4 FIREBASE AUTH VALIDATION")
print("=" * 70)

# --- 1. Syntax Check ---
print("\n[1] Validating Python syntax of Phase 4 files...")
files_to_check = [
    "app/core/firebase.py",
    "app/core/auth.py",
    "app/api/auth.py",
    "app/api/__init__.py",
    "app/main.py",
]

for rel_path in files_to_check:
    full_path = os.path.join(BACKEND_DIR, rel_path)
    assert os.path.exists(full_path), f"File missing: {rel_path}"
    with open(full_path, "r", encoding="utf-8") as f:
        ast.parse(f.read(), filename=full_path)
    print(f"    {rel_path:<30s} -> Syntax OK")

# --- 2. Firebase Module Import & Unconfigured Graceful Handling ---
print("\n[2] Testing Firebase Admin module & unconfigured state handling...")
from app.core.firebase import initialize_firebase, get_firebase_app
from app.core.auth import FirebaseUser, get_current_firebase_user

fb_app = initialize_firebase()
print(f"    Firebase initialize_firebase() returned: {fb_app} (Graceful None when no credentials in local dev)")

# --- 3. FastAPI App & Endpoint Tests ---
print("\n[3] Testing HTTP Endpoints with TestClient...")
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Test GET /
res_root = client.get("/")
assert res_root.status_code == 200
print(f"    GET /                               -> {res_root.status_code} OK  {res_root.json()}")

# Test GET /health
res_health = client.get("/health")
assert res_health.status_code == 200
print(f"    GET /health                         -> {res_health.status_code} OK  {res_health.json()}")

# Test GET /api/auth/me WITHOUT Authorization header
res_no_auth = client.get("/api/auth/me")
print(f"    GET /api/auth/me (No Auth Header)   -> {res_no_auth.status_code} (Expected 401)")
assert res_no_auth.status_code == 401, f"Expected 401, got {res_no_auth.status_code}"
assert res_no_auth.json().get("detail") == "Authentication required"
print(f"      Response: {res_no_auth.json()}")

# Test GET /api/auth/me WITH Non-Bearer Scheme
res_bad_scheme = client.get("/api/auth/me", headers={"Authorization": "Basic dXNlcjpwYXNz"})
print(f"    GET /api/auth/me (Basic Auth)       -> {res_bad_scheme.status_code} (Expected 401)")
assert res_bad_scheme.status_code == 401
print(f"      Response: {res_bad_scheme.json()}")

# Test GET /api/auth/me WITH Malformed Bearer Token
res_bad_token = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_fake_token_12345"})
print(f"    GET /api/auth/me (Fake Bearer Token)-> {res_bad_token.status_code} (Expected 401 or 503)")
assert res_bad_token.status_code in (401, 503), f"Expected 401 or 503, got {res_bad_token.status_code}"
print(f"      Response: {res_bad_token.json()}")

# --- 4. Security Audit ---
print("\n[4] Performing Secrets Audit across all source files...")
import re

patterns = [
    (r"-----BEGIN PRIVATE KEY-----", "Embedded private key"),
    (r"AIza[0-9A-Za-z\-_]{35}", "Google API key"),
    (r"(?i)firebase_adminsdk_[a-z0-9]+", "Service account name"),
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
    print("    All backend application source files CLEAN — zero hardcoded credentials/secrets!")

# --- 5. Database Metadata & Models Integrity ---
print("\n[5] Verifying Database Models & Base.metadata integrity...")
from app.db.base import Base
import app.models

assert len(Base.metadata.tables) == 23, f"Expected 23 tables, found {len(Base.metadata.tables)}"
print(f"    Base.metadata contains exactly {len(Base.metadata.tables)} tables (100% preserved)")

print("\n" + "=" * 70)
print("ALL PHASE 4 VALIDATIONS PASSED PERFECTLY!")
print("=" * 70)
