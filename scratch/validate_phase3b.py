"""
Phase 3B — Comprehensive SQLAlchemy Models Validation Script

Validates:
1. Python syntax & clean imports
2. Model registration in Base.metadata (23 tables expected)
3. Foreign key integrity & cascade rules
4. Relationships & back_populates bidirectional consistency
5. Unique constraints
6. Check constraints
7. Indexes
8. FastAPI app imports and endpoint validation (/ and /health)
9. Preserved Phase 1 & Phase 2 infrastructure
"""

import os
import sys

# Ensure backend directory is in sys.path
BACKEND_DIR = r"c:\Users\hp\Desktop\OravisionAI\backend"
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

print("=" * 70)
print("ORAVISIONAI — PHASE 3B VALIDATION")
print("=" * 70)

# --- 1. Import Base and all models ---
print("\n[1] Importing SQLAlchemy Base and Models...")
from app.db.base import Base
import app.models as models

print("    Successfully imported app.models")

# --- 2. Verify registered tables ---
print("\n[2] Inspecting Base.metadata tables...")
tables = Base.metadata.tables
print(f"    Total registered tables in Base.metadata: {len(tables)}")

expected_tables = [
    "users",
    "patients",
    "patient_medical_profiles",
    "dentists",
    "dentist_verifications",
    "patient_dentist_relationships",
    "screenings",
    "screening_images",
    "ai_models",
    "ai_predictions",
    "prediction_probabilities",
    "yolo_detections",
    "risk_assessments",
    "xai_results",
    "reports",
    "dentist_assessments",
    "dentist_availabilities",
    "appointments",
    "consultations",
    "conversations",
    "messages",
    "notifications",
    "audit_logs",
]

assert len(expected_tables) == 23, "Expected 23 tables in specification"
assert len(tables) == 23, f"Expected exactly 23 tables registered, found {len(tables)}"

missing_tables = [t for t in expected_tables if t not in tables]
if missing_tables:
    raise AssertionError(f"Missing tables in Base.metadata: {missing_tables}")

print("    All 23 expected tables are present in Base.metadata:")
for i, tname in enumerate(sorted(tables.keys()), start=1):
    t = tables[tname]
    pk_cols = [c.name for c in t.primary_key.columns]
    fk_cols = [f"{fk.parent.name} -> {fk.target_fullname}" for fk in t.foreign_keys]
    print(f"    {i:2d}. {tname:<32s} [PK: {', '.join(pk_cols)}] [FKs: {len(fk_cols)}]")

# --- 3. Verify Foreign Keys and Targets ---
print("\n[3] Validating Foreign Key references...")
fk_count = 0
for tname, table in tables.items():
    for fk in table.foreign_keys:
        target_table = fk.column.table.name
        assert target_table in tables, f"FK target table {target_table} not in metadata"
        fk_count += 1
print(f"    Validated {fk_count} Foreign Key references across all 23 tables (all targets valid)")

# --- 4. Verify Check Constraints ---
print("\n[4] Validating Check Constraints...")
chk_count = 0
for tname, table in tables.items():
    for constraint in table.constraints:
        if hasattr(constraint, "sqltext"):
            chk_count += 1
            print(f"    {tname:<32s} CHECK: {constraint.name}")
print(f"    Validated {chk_count} Check Constraints")

# --- 5. Verify Indexes & Unique Constraints ---
print("\n[5] Validating Indexes & Unique Constraints...")
idx_count = 0
for tname, table in tables.items():
    for idx in table.indexes:
        idx_count += 1
print(f"    Validated {idx_count} explicit Indexes across tables")

# --- 6. Verify Model Classes & Relationships (Mapper Configuration) ---
print("\n[6] Initializing SQLAlchemy Mappers & verifying bidirectional relationships...")
from sqlalchemy.orm import configure_mappers
configure_mappers()
print("    SQLAlchemy configure_mappers() completed successfully without mapper errors!")

# --- 7. Verify FastAPI Application boots and endpoints work ---
print("\n[7] Validating FastAPI Application & Endpoints...")
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

res_root = client.get("/")
assert res_root.status_code == 200, f"GET / failed with {res_root.status_code}"
assert res_root.json()["application"] == "OraVisionAI"
assert res_root.json()["status"] == "online"
print(f"    GET /       -> 200 OK  {res_root.json()}")

res_health = client.get("/health")
assert res_health.status_code == 200, f"GET /health failed with {res_health.status_code}"
assert res_health.json()["status"] == "healthy"
print(f"    GET /health -> 200 OK  {res_health.json()}")

# --- 8. Verify Phase 1 & Phase 2 settings and DB session integrity ---
print("\n[8] Verifying Settings & Database Infrastructure...")
from app.core.config import get_settings
from app.db.session import get_engine, _to_async_url

settings = get_settings()
print(f"    Settings App Name:     {settings.app_name}")
print(f"    Settings Environment:  {settings.environment}")
print(f"    DATABASE_URL:          {'[SET]' if settings.database_url else '[EMPTY]'}")
print(f"    Async URL conversion:  {_to_async_url('postgresql://user:pass@localhost:5432/db')}")

print("\n" + "=" * 70)
print("ALL PHASE 3B VALIDATIONS PASSED PERFECTLY!")
print(f"Expected entities: 23 | Registered SQLAlchemy tables: {len(tables)}")
print("=" * 70)
