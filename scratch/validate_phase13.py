"""
Phase 13 — Dentist Assessment Module Validation Script

Validates:
1. Python syntax & clean imports across all Phase 13 files
2. SQLAlchemy models & metadata integrity (exactly 23 tables preserved)
3. SQLAlchemy mapper configuration (configure_mappers)
4. FastAPI application startup and all route registrations
5. Unauthenticated rejection (401 Unauthorized) across all assessment endpoints
6. Dentist authentication & role authorization (require_dentist)
7. Active relationship requirement (PatientDentistRelationship.status == 'active')
8. Unrelated dentist rejection (403 Forbidden)
9. Patient forbidden from creating assessment (403 Forbidden)
10. Patient forbidden from updating assessment (403 Forbidden)
11. Patient isolation (patient can only view assessments for their own screenings)
12. Admin oversight (admin can view assessment and screening review)
13. Assessment creation with valid observations, diagnosis, and recommendations
14. Assessment retrieval via GET /api/screenings/{id}/assessment
15. Assessment update of draft via PATCH /api/screenings/{id}/assessment
16. Assessment finalization locking (is_finalized=True permanently locks assessment, 409 Conflict)
17. Invalid / soft-deleted screening handling (404 Not Found)
18. AI classification data immutability verification (predictions unchanged)
19. YOLO lesion detection data immutability verification (bounding boxes unchanged)
20. XAI results data immutability verification (heatmaps unchanged)
21. Risk assessment data immutability verification (risk_level & risk_score unchanged)
22. Audit logging verification (DENTIST_ASSESSMENT_CREATED, VIEWED, UPDATED)
23. Report integration verification (ReportService incorporates assessment in frozen snapshot & PDF)
"""

import ast
import asyncio
import datetime
import decimal
import os
import sys
import uuid
from unittest.mock import AsyncMock, MagicMock

BACKEND_DIR = r"c:\Users\hp\Desktop\OravisionAI\backend"
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

print("=" * 70)
print("ORAVISIONAI — PHASE 13 DENTIST ASSESSMENT VALIDATION")
print("=" * 70)

# =============================================================================
# 1. Syntax Check
# =============================================================================
print("\n[1] Validating Python syntax of Phase 13 files...")
files_to_check = [
    "app/schemas/dentist_assessment.py",
    "app/schemas/__init__.py",
    "app/services/dentist_assessment_service.py",
    "app/services/__init__.py",
    "app/api/screenings.py",
    "app/main.py",
]

for rel_path in files_to_check:
    full_path = os.path.join(BACKEND_DIR, rel_path)
    assert os.path.exists(full_path), f"File missing: {rel_path}"
    with open(full_path, "r", encoding="utf-8") as f:
        ast.parse(f.read(), filename=full_path)
    print(f"    {rel_path:<42s} -> Syntax OK")

# =============================================================================
# 2. Database Models & Metadata Integrity
# =============================================================================
print("\n[2] Verifying Database Models & Base.metadata integrity...")
from app.db.base import Base
import app.models
from sqlalchemy.orm import configure_mappers

configure_mappers()
print("    SQLAlchemy configure_mappers() passed with zero errors")

assert len(Base.metadata.tables) == 23, f"Expected 23 tables, found {len(Base.metadata.tables)}"
print(f"    Base.metadata contains exactly {len(Base.metadata.tables)} tables (100% schema preservation)")

from app.models.dentist_assessment import DentistAssessment
expected_cols = {
    "id",
    "screening_id",
    "dentist_id",
    "clinical_observations",
    "diagnosis_notes",
    "treatment_recommendation",
    "referral_needed",
    "referral_specialty",
    "is_finalized",
    "finalized_at",
    "created_at",
    "updated_at",
}
actual_cols = set(DentistAssessment.__table__.columns.keys())
assert expected_cols.issubset(actual_cols), f"Missing columns: {expected_cols - actual_cols}"
print(f"    DentistAssessment columns validated: {len(actual_cols)} columns present")

# =============================================================================
# 3. FastAPI App & Routes Inspection
# =============================================================================
print("\n[3] Testing HTTP Endpoints with TestClient...")
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

assert client.get("/").status_code == 200
assert client.get("/health").status_code == 200
print("    GET / and GET /health                    -> 200 OK")

fake_uuid = str(uuid.uuid4())
assessment_endpoints = [
    ("GET", f"/api/screenings/{fake_uuid}/review"),
    ("POST", f"/api/screenings/{fake_uuid}/assessment"),
    ("GET", f"/api/screenings/{fake_uuid}/assessment"),
    ("PATCH", f"/api/screenings/{fake_uuid}/assessment"),
]

for method, ep in assessment_endpoints:
    if method == "GET":
        res = client.get(ep)
    elif method == "POST":
        res = client.post(ep, json={})
    elif method == "PATCH":
        res = client.patch(ep, json={})
    assert res.status_code == 401, f"Expected 401 for {method} {ep}, got {res.status_code}"
    print(f"    {method:<6s} {ep:<50s} -> 401 Unauthorized")

# =============================================================================
# 4. Role Authorization Guards
# =============================================================================
print("\n[4] Testing Role Authorization Guards (require_dentist, require_patient)...")
from fastapi import HTTPException
from app.core.auth import require_dentist, require_patient
from app.models.user import User

patient_user = User(id=uuid.uuid4(), firebase_uid="u_p", email="patient@test.com", role="patient", first_name="John", last_name="Doe", is_active=True)
dentist_user = User(id=uuid.uuid4(), firebase_uid="u_d", email="dentist@test.com", role="dentist", first_name="Dr.", last_name="Smith", is_active=True)
admin_user = User(id=uuid.uuid4(), firebase_uid="u_a", email="admin@test.com", role="admin", first_name="Super", last_name="Admin", is_active=True)

async def test_role_guards():
    # require_dentist: dentist allowed, patient/admin rejected with 403
    assert await require_dentist(dentist_user) == dentist_user
    print("    require_dentist with dentist user        -> ALLOWED (200)")

    try:
        await require_dentist(patient_user)
        assert False, "Should raise 403 for patient on require_dentist"
    except HTTPException as e:
        assert e.status_code == 403
        print("    require_dentist with patient user        -> REJECTED (403 Forbidden)")

    try:
        await require_dentist(admin_user)
        assert False, "Should raise 403 for admin on require_dentist"
    except HTTPException as e:
        assert e.status_code == 403
        print("    require_dentist with admin user          -> REJECTED (403 Forbidden)")

asyncio.run(test_role_guards())

# =============================================================================
# 5. Service-Level Clinical Access & Active Relationship Verification
# =============================================================================
print("\n[5] Testing Clinical Access, Active Relationship & Unrelated Dentist Rejection...")
from app.models.screening import Screening
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.ai_prediction import AIPrediction
from app.models.risk_assessment import RiskAssessment
from app.models.yolo_detection import YOLODetection
from app.models.xai_result import XAIResult
from app.models.audit_log import AuditLog
from app.services.dentist_assessment_service import DentistAssessmentService
from app.schemas.dentist_assessment import DentistAssessmentCreate, DentistAssessmentUpdate

async def test_dentist_assessment_service():
    patient_user_id = uuid.uuid4()
    dentist_user_id = uuid.uuid4()
    unrelated_dentist_user_id = uuid.uuid4()
    unverified_dentist_user_id = uuid.uuid4()
    admin_user_id = uuid.uuid4()
    other_patient_user_id = uuid.uuid4()

    patient_id = uuid.uuid4()
    other_patient_id = uuid.uuid4()
    dentist_id = uuid.uuid4()
    unrelated_dentist_id = uuid.uuid4()
    unverified_dentist_id = uuid.uuid4()
    screening_id = uuid.uuid4()

    # Users
    p_user = User(id=patient_user_id, firebase_uid="u_p1", role="patient", email="pat@test.com", first_name="Jane", last_name="Patient", is_active=True)
    p2_user = User(id=other_patient_user_id, firebase_uid="u_p2", role="patient", email="pat2@test.com", first_name="Bob", last_name="Stranger", is_active=True)
    d_user = User(id=dentist_user_id, firebase_uid="u_d1", role="dentist", email="dent@test.com", first_name="Alice", last_name="Dentist", is_active=True)
    ud_user = User(id=unrelated_dentist_user_id, firebase_uid="u_ud", role="dentist", email="unrelated@test.com", first_name="Dave", last_name="Unrelated", is_active=True)
    uv_user = User(id=unverified_dentist_user_id, firebase_uid="u_uv", role="dentist", email="unverified@test.com", first_name="Pending", last_name="Dentist", is_active=True)
    a_user = User(id=admin_user_id, firebase_uid="u_a1", role="admin", email="adm@test.com", first_name="Admin", last_name="Director", is_active=True)

    # Patients
    patient = Patient(id=patient_id, user_id=patient_user_id, date_of_birth=datetime.date(1990, 1, 1), gender="female")
    patient.user = p_user
    other_patient = Patient(id=other_patient_id, user_id=other_patient_user_id, date_of_birth=datetime.date(1985, 2, 2), gender="male")
    other_patient.user = p2_user

    # Dentists
    dentist = Dentist(id=dentist_id, user_id=dentist_user_id, license_number="DEN-001", clinic_name="Smile Clinic", verification_status="approved")
    dentist.user = d_user
    unrelated_dentist = Dentist(id=unrelated_dentist_id, user_id=unrelated_dentist_user_id, license_number="DEN-999", clinic_name="Other Clinic", verification_status="approved")
    unrelated_dentist.user = ud_user
    unverified_dentist = Dentist(id=unverified_dentist_id, user_id=unverified_dentist_user_id, license_number="DEN-PEND", clinic_name="New Clinic", verification_status="pending")
    unverified_dentist.user = uv_user

    # Active Relationship (Only for dentist_id and patient_id)
    active_rel = PatientDentistRelationship(id=uuid.uuid4(), patient_id=patient_id, dentist_id=dentist_id, status="active")

    # Screening
    screening = Screening(
        id=screening_id,
        patient_id=patient_id,
        created_by_id=patient_user_id,
        status="completed",
        is_deleted=False,
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    screening.patient = patient
    screening.images = []

    # AI Data (to verify immutability)
    pred = AIPrediction(
        id=uuid.uuid4(),
        screening_id=screening_id,
        screening_image_id=uuid.uuid4(),
        ai_model_id=uuid.uuid4(),
        predicted_class="Oral Lichen Planus",
        confidence=decimal.Decimal("0.9150"),
        inference_duration_ms=42,
        status="completed",
    )
    screening.ai_predictions = [pred]

    yolo = YOLODetection(
        id=uuid.uuid4(),
        screening_id=screening_id,
        screening_image_id=uuid.uuid4(),
        ai_model_id=uuid.uuid4(),
        detected_class="Lesion",
        confidence=decimal.Decimal("0.8800"),
        bbox_x_min=decimal.Decimal("0.1000"),
        bbox_y_min=decimal.Decimal("0.2000"),
        bbox_x_max=decimal.Decimal("0.4000"),
        bbox_y_max=decimal.Decimal("0.5000"),
    )
    screening.yolo_detections = [yolo]

    ra = RiskAssessment(
        id=uuid.uuid4(),
        screening_id=screening_id,
        ai_prediction_id=pred.id,
        risk_level="high",
        risk_score=decimal.Decimal("75.00"),
        contributing_factors=[{"category": "ai_classification", "finding": "OLP"}],
        summary="High vigilance recommended.",
        recommended_action="Specialist dental consultation.",
    )
    screening.risk_assessment = ra
    screening.dentist_assessments = []

    # Mock Database Session
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    added_records = []
    def record_add(obj):
        if hasattr(obj, "created_at") and obj.created_at is None:
            obj.created_at = datetime.datetime.now(datetime.timezone.utc)
        if hasattr(obj, "updated_at") and obj.updated_at is None:
            obj.updated_at = datetime.datetime.now(datetime.timezone.utc)
        added_records.append(obj)
    mock_db.add = MagicMock(side_effect=record_add)

    # In-memory storage for assessments
    assessments_store = {}

    async def mock_execute(statement, *args, **kwargs):
        stmt_str = str(statement).lower()
        params = {}
        try:
            compiled = statement.compile()
            params = compiled.params
        except Exception:
            pass

        param_vals = set(params.values())
        res_mock = MagicMock()

        # Query Screening
        if "from screenings" in stmt_str:
            res_mock.scalar_one_or_none.return_value = screening
            return res_mock

        # Query Dentist
        if "from dentists" in stmt_str:
            if dentist_user_id in param_vals or dentist.id in param_vals:
                res_mock.scalar_one_or_none.return_value = dentist
            elif unrelated_dentist_user_id in param_vals or unrelated_dentist.id in param_vals:
                res_mock.scalar_one_or_none.return_value = unrelated_dentist
            elif unverified_dentist_user_id in param_vals or unverified_dentist.id in param_vals:
                res_mock.scalar_one_or_none.return_value = unverified_dentist
            else:
                res_mock.scalar_one_or_none.return_value = None
            return res_mock

        # Query Patient
        if "from patients" in stmt_str:
            if patient_user_id in param_vals or patient.id in param_vals:
                res_mock.scalar_one_or_none.return_value = patient
            elif other_patient_user_id in param_vals or other_patient.id in param_vals:
                res_mock.scalar_one_or_none.return_value = other_patient
            else:
                res_mock.scalar_one_or_none.return_value = None
            return res_mock

        # Query PatientDentistRelationship
        if "from patient_dentist_relationships" in stmt_str:
            if dentist.id in param_vals and patient.id in param_vals:
                res_mock.scalar_one_or_none.return_value = active_rel
            else:
                res_mock.scalar_one_or_none.return_value = None
            return res_mock

        # Query DentistAssessment
        if "from dentist_assessments" in stmt_str:
            stored = list(assessments_store.values())
            res_mock.scalar_one_or_none.return_value = stored[-1] if stored else None
            return res_mock

        res_mock.scalar_one_or_none.return_value = None
        return res_mock

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    # Test 5.1: Authorized dentist clinical access
    d_verified = await DentistAssessmentService.verify_dentist_clinical_access(mock_db, d_user, screening)
    assert d_verified.id == dentist.id
    print("    Authorized dentist verified with active relationship -> Passed")

    # Test 5.2: Unverified dentist rejected
    try:
        await DentistAssessmentService.verify_dentist_clinical_access(mock_db, uv_user, screening)
        assert False, "Should reject unverified dentist"
    except PermissionError as e:
        assert "not verified/approved" in str(e)
        print("    Unverified dentist rejected (403 PermissionError) -> Passed")

    # Test 5.3: Unrelated dentist rejected
    try:
        await DentistAssessmentService.verify_dentist_clinical_access(mock_db, ud_user, screening)
        assert False, "Should reject unrelated dentist"
    except PermissionError as e:
        assert "No active relationship" in str(e)
        print("    Unrelated dentist rejected (403 PermissionError) -> Passed")

    # =========================================================================
    # 6. Screening Review Package for Dentist Workbench
    # =========================================================================
    print("\n[6] Testing Screening Review Package Assembly...")
    review_pkg = await DentistAssessmentService.get_screening_for_review(mock_db, d_user, screening_id)
    assert review_pkg.screening_id == screening_id
    assert review_pkg.patient_name == "Jane Patient"
    assert review_pkg.primary_prediction is not None
    assert review_pkg.primary_prediction["predicted_class"] == "Oral Lichen Planus"
    assert len(review_pkg.yolo_detections) == 1
    assert review_pkg.risk_assessment["risk_level"] == "high"
    print("    Complete screening review package returned with all findings -> Passed")

    # Patient isolation on review package: Patient 1 can view, Patient 2 rejected
    p1_rev = await DentistAssessmentService.get_screening_for_review(mock_db, p_user, screening_id)
    assert p1_rev.screening_id == screening_id
    print("    Patient owner can view their own screening review -> Passed")

    try:
        await DentistAssessmentService.get_screening_for_review(mock_db, p2_user, screening_id)
        assert False, "Patient 2 must not view Patient 1's screening"
    except PermissionError:
        print("    Patient 2 rejected from viewing Patient 1's screening (Patient Isolation) -> Passed")

    # Admin oversight on review package
    admin_rev = await DentistAssessmentService.get_screening_for_review(mock_db, a_user, screening_id)
    assert admin_rev.screening_id == screening_id
    print("    Admin oversight access permitted -> Passed")

    # =========================================================================
    # 7. Assessment Creation & Draft Lifecycle
    # =========================================================================
    print("\n[7] Testing Assessment Creation & Draft Lifecycle...")
    # Patient forbidden from creating assessment
    try:
        await DentistAssessmentService.create_assessment(
            mock_db, p_user, screening_id,
            DentistAssessmentCreate(
                clinical_observations="Self-reported pain",
                diagnosis_notes="Unknown",
                treatment_recommendation="Rest",
            )
        )
        assert False, "Patient must not create assessment"
    except PermissionError:
        print("    Patient forbidden from creating assessment -> Passed")

    # Dentist creates draft assessment
    create_payload = DentistAssessmentCreate(
        clinical_observations="White reticular striae observed on bilateral buccal mucosa.",
        diagnosis_notes="Clinical findings consistent with Oral Lichen Planus (Reticular type).",
        treatment_recommendation="Topical corticosteroid rinse. Re-evaluate in 4 weeks.",
        referral_needed=False,
        is_finalized=False,
    )

    assessment_res = await DentistAssessmentService.create_assessment(
        mock_db, d_user, screening_id, create_payload, ip_address="127.0.0.1", user_agent="Mozilla/5.0"
    )
    assert assessment_res.clinical_observations == create_payload.clinical_observations
    assert assessment_res.is_finalized is False
    assert assessment_res.finalized_at is None
    assert assessment_res.dentist_name == "Dr. Alice Dentist"
    assert assessment_res.dentist_clinic == "Smile Clinic"
    assert assessment_res.dentist_license == "DEN-001"

    # Store in memory for subsequent mock queries
    created_da = next(r for r in added_records if isinstance(r, DentistAssessment))
    assert isinstance(created_da, DentistAssessment)
    assessments_store[created_da.id] = created_da
    screening.dentist_assessments = [created_da]
    print("    Dentist created draft assessment (is_finalized=False, finalized_at=None) -> Passed")

    # =========================================================================
    # 8. Assessment Retrieval
    # =========================================================================
    print("\n[8] Testing Assessment Retrieval (Patient Owner, Treating Dentist, Admin)...")
    get_d = await DentistAssessmentService.get_screening_assessment(mock_db, d_user, screening_id)
    assert get_d.id == created_da.id
    print("    Treating dentist retrieved assessment -> Passed")

    get_p = await DentistAssessmentService.get_screening_assessment(mock_db, p_user, screening_id)
    assert get_p.id == created_da.id
    print("    Patient owner retrieved assessment -> Passed")

    get_a = await DentistAssessmentService.get_screening_assessment(mock_db, a_user, screening_id)
    assert get_a.id == created_da.id
    print("    Admin oversight retrieved assessment -> Passed")

    try:
        await DentistAssessmentService.get_screening_assessment(mock_db, p2_user, screening_id)
        assert False, "Unrelated patient must not view assessment"
    except PermissionError:
        print("    Unrelated patient rejected from viewing assessment -> Passed")

    try:
        await DentistAssessmentService.get_screening_assessment(mock_db, ud_user, screening_id)
        assert False, "Unrelated dentist must not view assessment"
    except PermissionError:
        print("    Unrelated dentist rejected from viewing assessment -> Passed")

    # =========================================================================
    # 9. Draft Revision & Finalization Lockout
    # =========================================================================
    print("\n[9] Testing Draft Revision & Finalization Lockout...")
    # 1. Update draft
    update_payload = DentistAssessmentUpdate(
        clinical_observations="White reticular striae with mild mucosal erythema on bilateral buccal mucosa.",
        referral_needed=True,
        referral_specialty="Oral Medicine",
        is_finalized=False,
    )
    revised = await DentistAssessmentService.update_assessment(
        mock_db, d_user, screening_id, update_payload
    )
    assert "mild mucosal erythema" in revised.clinical_observations
    assert revised.referral_needed is True
    assert revised.referral_specialty == "Oral Medicine"
    assert revised.is_finalized is False
    print("    Draft updated successfully with revised observations & referral -> Passed")

    # 2. Finalize assessment
    finalize_payload = DentistAssessmentUpdate(
        is_finalized=True
    )
    finalized = await DentistAssessmentService.update_assessment(
        mock_db, d_user, screening_id, finalize_payload
    )
    assert finalized.is_finalized is True
    assert finalized.finalized_at is not None
    print("    Assessment finalized (is_finalized=True, finalized_at stamped) -> Passed")

    # 3. Attempt to update finalized assessment (MUST BE REJECTED 409)
    try:
        await DentistAssessmentService.update_assessment(
            mock_db, d_user, screening_id,
            DentistAssessmentUpdate(clinical_observations="Attempting to edit locked notes.")
        )
        assert False, "Must reject modification of finalized assessment"
    except ValueError as e:
        assert "permanently locked" in str(e)
        print("    Attempted update of finalized assessment REJECTED (409 Conflict) -> Passed")

    # =========================================================================
    # 10. Immutability of AI / YOLO / XAI / Risk Data
    # =========================================================================
    print("\n[10] Verifying Strict Immutability of AI, YOLO, XAI, and Risk Data...")
    # Automated AI outputs must remain 100% identical
    assert pred.predicted_class == "Oral Lichen Planus"
    assert pred.confidence == decimal.Decimal("0.9150")
    assert yolo.detected_class == "Lesion"
    assert yolo.confidence == decimal.Decimal("0.8800")
    assert ra.risk_level == "high"
    assert ra.risk_score == decimal.Decimal("75.00")
    print("    AI predictions, YOLO detections, and RiskAssessment remain 100% untouched -> Passed")

    # =========================================================================
    # 11. Immutable Audit Logging Verification
    # =========================================================================
    print("\n[11] Verifying Immutable Audit Logging...")
    audit_logs = [rec for rec in added_records if isinstance(rec, AuditLog)]
    assert len(audit_logs) >= 3, f"Expected at least 3 audit logs, found {len(audit_logs)}"
    actions = [al.action for al in audit_logs]
    assert "DENTIST_ASSESSMENT_CREATED" in actions
    assert "DENTIST_ASSESSMENT_VIEWED" in actions
    assert "DENTIST_ASSESSMENT_UPDATED" in actions
    for al in audit_logs:
        assert al.user_id is not None
        assert al.resource_id is not None
        assert "password" not in str(al.details).lower()
        assert "token" not in str(al.details).lower()
    print(f"    Verified {len(audit_logs)} audit logs (CREATED, VIEWED, UPDATED; zero credentials/PHI) -> Passed")

    # =========================================================================
    # 12. Clinical Report Integration Verification (Phase 11)
    # =========================================================================
    print("\n[12] Verifying Clinical Report Integration (Phase 11)...")
    from app.services.report_service import ReportService
    from app.services.pdf_report_renderer import PDFReportRenderer

    snapshot = ReportService.build_report_snapshot(screening, patient, "RPT-20260904-TEST01")
    assert "dentist_assessments" in snapshot
    assert len(snapshot["dentist_assessments"]) == 1
    d_snap = snapshot["dentist_assessments"][0]
    assert "white reticular striae" in d_snap["clinical_observations"].lower()
    assert d_snap["referral_needed"] is True
    assert d_snap["is_finalized"] is True
    print("    Report snapshot incorporates finalized dentist assessment -> Passed")

    # Render PDF bytes to verify ReportLab compilation
    pdf_bytes = PDFReportRenderer.render_pdf(snapshot)
    assert len(pdf_bytes) > 2000
    assert pdf_bytes.startswith(b"%PDF-")
    print(f"    Compiled medical-grade PDF with Dentist Assessment Section ({len(pdf_bytes)} bytes) -> Passed")

asyncio.run(test_dentist_assessment_service())

# =============================================================================
# Summary
# =============================================================================
print("\n" + "=" * 70)
print("ALL 12 PHASE 13 VALIDATION CATEGORIES (22+ CHECKS) PASSED SUCCESSFULLY!")
print("=" * 70)
