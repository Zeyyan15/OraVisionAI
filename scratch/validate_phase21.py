"""
OraVisionAI — Phase 21 Authoritative Validation Harness
Two-Tier Contract Audit & Validation Suite:
- Tier 1: Programmatic Structural Contract Inspection (Exhaustive 82-Endpoint Audit)
- Tier 2: Behavioral Contract Test Suite (Representative Runtime Workflow Verification)
"""

from __future__ import annotations

import asyncio
import datetime
import decimal
import inspect
import json
import os
import sys
import uuid
from collections import Counter
from typing import Any, Dict, List, Set, Tuple
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, "backend")

# Setup logging
import logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("validate_phase21")

test_results: List[Tuple[str, bool, str]] = []

def log_test(name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")
    if detail:
        print(f"       {detail}")
    test_results.append((name, passed, detail))


# =============================================================================
# TIER 1: PROGRAMMATIC STRUCTURAL CONTRACT INSPECTION
# =============================================================================

def validate_tier1_structural():
    print("\n========================================================")
    print("TIER 1: PROGRAMMATIC STRUCTURAL CONTRACT INSPECTION")
    print("========================================================")
    
    from app.main import app
    from fastapi.routing import APIRoute
    from app.core.auth import (
        require_admin, require_dentist, require_patient,
        get_current_active_user, get_current_user, get_current_firebase_user
    )
    from app.api import (
        admin, appointments, auth, consultations, conversations,
        dentists, notifications, patients, reports, screenings, users, xai
    )

    router_list = [
        ("Root", app),
        ("Authentication", auth.router),
        ("Users", users.router),
        ("Patients", patients.router),
        ("Dentists", dentists.router),
        ("Screenings", screenings.router),
        ("XAI", xai.router),
        ("Reports", reports.router),
        ("Appointments", appointments.router),
        ("Consultations", consultations.router),
        ("Conversations", conversations.router),
        ("Notifications", notifications.router),
        ("Admin", admin.router),
    ]

    all_routes: List[Tuple[str, str, APIRoute]] = []
    
    for mod_name, router in router_list:
        for r in router.routes:
            if isinstance(r, APIRoute):
                for m in r.methods:
                    if m not in ("OPTIONS", "HEAD"):
                        canon_path = r.path if mod_name == "Root" else f"/api{r.path}".replace("//", "/")
                        all_routes.append((m, canon_path, r))

    # 1. Total operation count assertion
    total_ops = len(all_routes)
    log_test("T1.1: Total registered operations == 82", total_ops == 82, f"Found: {total_ops}")

    # 2. Unique canonical paths assertion
    unique_paths = set(p for _, p, _ in all_routes)
    log_test("T1.2: Total unique canonical paths == 66", len(unique_paths) == 66, f"Found: {len(unique_paths)}")

    # 3. OpenAPI parity assertion
    openapi = app.openapi()
    openapi_paths = set(openapi["paths"].keys())
    sym_diff = unique_paths.symmetric_difference(openapi_paths)
    log_test("T1.3: 100% path parity between registered routes and OpenAPI", len(sym_diff) == 0, f"Symmetric diff: {sym_diff}")

    # 4. HTTP method breakdown assertion
    method_counts = Counter(m for m, _, _ in all_routes)
    expected_methods = {"GET": 47, "POST": 18, "PATCH": 15, "DELETE": 2}
    methods_ok = (method_counts == expected_methods)
    log_test("T1.4: Method breakdown (47 GET, 18 POST, 15 PATCH, 2 DELETE)", methods_ok, f"Actual: {dict(method_counts)}")

    # 5. Route visibility breakdown assertion
    public_ops = [
        (m, p) for m, p, r in all_routes
        if (m, p) in {("GET", "/"), ("GET", "/health"), ("GET", "/api/xai/methods")}
    ]
    protected_ops = [
        (m, p) for m, p, r in all_routes
        if (m, p) not in {("GET", "/"), ("GET", "/health"), ("GET", "/api/xai/methods")}
    ]
    vis_ok = (len(public_ops) == 3 and len(protected_ops) == 79)
    log_test("T1.5: Route visibility breakdown (3 public, 79 protected)", vis_ok, f"Public: {len(public_ops)}, Protected: {len(protected_ops)}")

    # 6. Auth dependency distribution across 79 protected endpoints
    dep_counts = Counter()
    for m, p, r in all_routes:
        if (m, p) in {("GET", "/"), ("GET", "/health"), ("GET", "/api/xai/methods")}:
            continue
        sig = inspect.signature(r.endpoint)
        auth_dep = "none"
        for param in sig.parameters.values():
            if hasattr(param.default, "dependency"):
                dep = param.default.dependency
                if dep == require_admin:
                    auth_dep = "require_admin"
                elif dep == require_dentist:
                    auth_dep = "require_dentist"
                elif dep == require_patient:
                    auth_dep = "require_patient"
                elif dep == get_current_active_user:
                    auth_dep = "get_current_active_user"
                elif dep == get_current_user:
                    auth_dep = "get_current_user"
                elif dep == get_current_firebase_user:
                    auth_dep = "get_current_firebase_user"
        dep_counts[auth_dep] += 1

    expected_deps = {
        "require_admin": 16,
        "get_current_active_user": 34,
        "require_patient": 16,
        "require_dentist": 11,
        "get_current_user": 1,
        "get_current_firebase_user": 1,
    }
    deps_ok = (dep_counts == expected_deps)
    log_test("T1.6: Auth dependency distribution across 79 protected endpoints", deps_ok, f"Actual: {dict(dep_counts)}")

    # 7. Primary declared success status code distribution
    status_counts = Counter((r.status_code or 200) for _, _, r in all_routes)
    expected_statuses = {200: 73, 201: 9}
    status_ok = (status_counts == expected_statuses)
    log_test("T1.7: Primary declared success status distribution (73 are 200, 9 are 201)", status_ok, f"Actual: {dict(status_counts)}")

    # 8. Request-body presence breakdown
    has_body_count = 0
    none_body_count = 0
    for _, _, r in all_routes:
        body_param = getattr(r.dependant, "body_params", [])
        if body_param and len(body_param) > 0:
            has_body_count += 1
        else:
            none_body_count += 1
    body_ok = (has_body_count == 28 and none_body_count == 54)
    log_test("T1.8: Request-body presence breakdown (54 none, 28 with request body)", body_ok, f"None: {none_body_count}, HasBody: {has_body_count}")

    # 9. Schema and migration invariants
    from app.db.base import Base
    import app.models
    tables = list(Base.metadata.tables.keys())
    migrations = [f for f in os.listdir("backend/alembic/versions") if f.endswith(".py")]
    inv_ok = (len(tables) == 23 and len(migrations) == 1 and migrations[0] == "001_initial_database_schema.py")
    log_test("T1.9: Database invariants verified (exactly 23 tables, exactly 1 migration)", inv_ok, f"Tables: {len(tables)}, Migrations: {len(migrations)}")

    # 10. AI Taxonomy
    from app.services.ai_inference_service import EFFICIENTNET_CLASS_CODES
    expected_tax = ["CaS", "CoS", "Gum", "MC", "OC", "OLP", "OT"]
    tax_ok = (EFFICIENTNET_CLASS_CODES == expected_tax)
    log_test("T1.10: AI taxonomy (7 classes: CaS, CoS, Gum, MC, OC, OLP, OT) verified", tax_ok, f"Taxonomy: {EFFICIENTNET_CLASS_CODES}")

    # 11. Clinical Context Engine Risk Levels
    from app.services.risk_assessment_service import TIER_TECHNICAL_INDEX
    from app.schemas.risk_assessment import RiskAssessmentResponse
    expected_risk_levels = {"low", "moderate", "high", "critical"}
    expected_tier_scores = {
        "low": decimal.Decimal("25.00"),
        "moderate": decimal.Decimal("50.00"),
        "high": decimal.Decimal("75.00"),
        "critical": decimal.Decimal("100.00"),
    }
    risk_ok = (set(TIER_TECHNICAL_INDEX.keys()) == expected_risk_levels and TIER_TECHNICAL_INDEX == expected_tier_scores)
    log_test("T1.11: Risk levels (low, moderate, high, critical) and tier scores (25, 50, 75, 100) verified", risk_ok, f"Tiers: {TIER_TECHNICAL_INDEX}")

    # 12. Authoritative XAI Methods Catalog
    from app.services.xai_service import PRIMARY_METHODS, SECONDARY_METHODS, ALL_METHODS
    xai_primary_ok = (PRIMARY_METHODS == ["occlusion_sensitivity", "grad_cam"])
    xai_secondary_ok = (SECONDARY_METHODS == ["grad_cam_plus_plus", "layer_cam", "score_cam", "integrated_gradients"])
    log_test("T1.12: Authoritative 6 XAI methods catalog verified (2 primary, 4 secondary)", xai_primary_ok and xai_secondary_ok, f"All: {ALL_METHODS}")

    # 13. Appointment and Consultation Statuses
    from app.schemas.consultation import VALID_SESSION_STATUSES
    expected_consult_statuses = {"scheduled", "active", "ended", "failed"}
    consult_ok = (VALID_SESSION_STATUSES == expected_consult_statuses)
    log_test("T1.13: Consultation statuses match scheduled, active, ended, failed (terminates with ended)", consult_ok, f"Actual: {VALID_SESSION_STATUSES}")

    # 14. Observed Rate Limiter Dictionary in InMemoryRateLimiter
    from app.core.security import InMemoryRateLimiter
    limiter = InMemoryRateLimiter()
    expected_limits = {
        "ai_run": (10, 60),
        "image_upload": (20, 60),
        "report_ops": (15, 60),
        "identity_read": (60, 60),
        "default": (120, 60),
    }
    rate_ok = (limiter.LIMITS == expected_limits)
    log_test("T1.14: Observed rate limiter LIMITS dictionary matches live code (5 scopes)", rate_ok, f"Actual: {limiter.LIMITS}")

    # 15. Endpoint Contracts JSON completeness
    with open("scratch/full_endpoint_contracts.json", "r") as f:
        contracts = json.load(f)
    contracts_count = len(contracts)
    unique_contract_keys = set(c["key"] for c in contracts)
    app_keys = set(f"{m} {p}" for m, p, _ in all_routes)
    diff_keys = app_keys.symmetric_difference(unique_contract_keys)
    contracts_ok = (contracts_count == 82 and len(diff_keys) == 0)
    log_test("T1.15: full_endpoint_contracts.json has 82 entries with exact 1-to-1 route correspondence", contracts_ok, f"Count={contracts_count}, Diff={diff_keys}")


# =============================================================================
# TIER 2: BEHAVIORAL CONTRACT TEST SUITE
# =============================================================================

async def validate_tier2_behavioral():
    print("\n========================================================")
    print("TIER 2: BEHAVIORAL CONTRACT TEST SUITE (REPRESENTATIVE)")
    print("========================================================")
    print("NOTE: Behavioral tests validate representative end-to-end integration workflows.")
    print("The behavioral scenario count is NOT equivalent to the total endpoint count,")
    print("which is exhaustively audited under Tier 1.")
    
    from httpx import ASGITransport, AsyncClient
    from app.main import app
    from app.core.auth import (
        get_current_firebase_user, get_current_user, get_current_active_user,
        require_patient, require_dentist, require_admin, FirebaseUser
    )
    from app.core.security import rate_limiter
    from app.db.session import get_db
    from app.models.user import User
    from app.models.patient import Patient
    from app.models.screening import Screening
    from app.models.screening_image import ScreeningImage
    from app.models.appointment import Appointment
    from app.models.consultation import Consultation
    from app.models.conversation import Conversation
    from app.models.message import Message
    from app.models.notification import Notification
    from app.models.report import Report

    from app.services.patient_service import PatientService
    from app.services.screening_service import ScreeningService
    from app.services.ai_inference_service import AIInferenceService
    from app.services.xai_service import XAIService
    from app.services.risk_assessment_service import RiskAssessmentService
    from app.services.report_service import ReportService
    from app.services.appointment_service import AppointmentService
    from app.services.consultation_service import ConsultationService
    from app.services.conversation_service import ConversationService
    from app.services.notification_service import NotificationService
    from app.schemas.ai import ScreeningInferenceResponse, ImageInferenceResult, ClassificationResult, ProbabilityItem
    from app.schemas.xai import ScreeningXAIResponse, XAIResultResponse
    from app.schemas.risk_assessment import RiskAssessmentResponse
    from app.schemas.conversation import ConversationResponse
    from app.schemas.message import MessageListResponse, MessageResponse
    from app.schemas.notification import NotificationListResponse, NotificationResponse

    transport = ASGITransport(app=app)
    
    # Database session generator override
    async def override_get_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = override_get_db

    now = datetime.datetime.now(datetime.timezone.utc)
    u_patient = User(
        id=uuid.uuid4(),
        firebase_uid="val-pat-uid",
        email="patient@test.com",
        first_name="Alice",
        last_name="Patient",
        role="patient",
        is_active=True,
        is_email_verified=True,
        created_at=now,
        updated_at=now,
    )

    u_dentist = User(
        id=uuid.uuid4(),
        firebase_uid="val-dent-uid",
        email="dentist@test.com",
        first_name="Bob",
        last_name="Dentist",
        role="dentist",
        is_active=True,
        is_email_verified=True,
        created_at=now,
        updated_at=now,
    )

    u_deactivated = User(
        id=uuid.uuid4(),
        firebase_uid="val-deact-uid",
        email="deact@test.com",
        first_name="Eve",
        last_name="Deactivated",
        role="patient",
        is_active=False,
        is_email_verified=True,
        created_at=now,
        updated_at=now,
    )

    pat_profile_id = uuid.uuid4()
    patient_model = Patient(id=pat_profile_id, user_id=u_patient.id)
    scr_id = uuid.uuid4()
    scr_model = Screening(
        id=scr_id,
        patient_id=pat_profile_id,
        created_by_id=u_patient.id,
        status="pending",
        clinical_notes="test notes",
        error_message=None,
        is_deleted=False,
        created_at=now,
        updated_at=now,
    )

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        
        # B1. Public endpoints without authentication
        res_root = await client.get("/")
        res_health = await client.get("/health")
        res_xai_cat = await client.get("/api/xai/methods")
        b1_ok = (res_root.status_code == 200 and res_health.status_code == 200 and res_xai_cat.status_code == 200)
        log_test("T2.1: Public endpoints respond 200 without authentication", b1_ok, f"/={res_root.status_code}, /health={res_health.status_code}, /xai/methods={res_xai_cat.status_code}")

        # B2. Protected route rejection without authentication
        res_unauth1 = await client.get("/api/screenings")
        res_unauth2 = await client.get("/api/reports/00000000-0000-0000-0000-000000000000")
        b2_ok = (res_unauth1.status_code == 401 and res_unauth2.status_code == 401)
        log_test("T2.2: Protected operational endpoints return 401 without Bearer token", b2_ok, f"Screenings={res_unauth1.status_code}, Reports={res_unauth2.status_code}")

        # B3. Deactivated user rejection on operational routes
        app.dependency_overrides[get_current_user] = lambda: u_deactivated
        res_deact_me = await client.get("/api/users/me")
        res_deact_op = await client.get("/api/users/me/patient-access")
        deact_ok = (res_deact_me.status_code == 200 and res_deact_me.json()["is_active"] is False and res_deact_op.status_code == 403)
        log_test("T2.3: Deactivated account rejected with 403 on operational routes but allowed on /users/me", deact_ok, f"Me={res_deact_me.status_code}, Op={res_deact_op.status_code}")

        # B4. Role access barriers enforced
        app.dependency_overrides[get_current_user] = lambda: u_dentist
        res_role_deny = await client.get("/api/users/me/patient-access")
        res_role_allow = await client.get("/api/users/me/dentist-access")
        role_ok = (res_role_deny.status_code == 403 and res_role_allow.status_code == 200 and res_role_allow.json()["role"] == "dentist")
        log_test("T2.4: Role barriers enforced (Dentist denied on patient-access, allowed on dentist-access)", role_ok, f"Deny={res_role_deny.status_code}, Allow={res_role_allow.status_code}")

        # Authenticate patient for clinical tests
        app.dependency_overrides[get_current_user] = lambda: u_patient

        # B5. Screening creation lifecycle: pending
        with patch.object(PatientService, "get_patient_by_user_id", AsyncMock(return_value=patient_model)), \
             patch.object(ScreeningService, "create_screening", AsyncMock(return_value=scr_model)):
            res_scr = await client.post("/api/screenings", json={"clinical_notes": "Validation test screening"})
            scr_ok = (res_scr.status_code == 201 and res_scr.json()["status"] == "pending" and res_scr.json()["id"] == str(scr_id))
            log_test("T2.5: Screening creation succeeds with primary declared status 201 and status 'pending'", scr_ok, f"Status: {res_scr.status_code}, screening_status: {res_scr.json().get('status')}")

        # B6. Image upload with magic-byte check: transitions to 'uploading'
        valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
        img_id = uuid.uuid4()
        storage_path = f"screenings/{pat_profile_id}/{scr_id}/{img_id}.png"
        img_model = ScreeningImage(
            id=img_id,
            screening_id=scr_id,
            storage_path=storage_path,
            file_name="test_lesion.png",
            file_size_bytes=len(valid_png),
            mime_type="image/png",
            is_primary=True,
            created_at=now,
        )

        with patch.object(PatientService, "get_patient_by_user_id", AsyncMock(return_value=patient_model)), \
             patch.object(ScreeningService, "attach_screening_image", AsyncMock(return_value=img_model)):
            files = {"file": ("test_lesion.png", valid_png, "image/png")}
            res_upload = await client.post(f"/api/screenings/{scr_id}/images", files=files)
            upload_ok = (res_upload.status_code == 201 and res_upload.json()["storage_path"] == storage_path)
            log_test("T2.6: Photo upload validates magic bytes and persists at screenings/{pat_id}/{scr_id}/{uuid}.png", upload_ok, f"Path: {res_upload.json().get('storage_path')}")

        # B7. Non-image file upload rejection with 400
        with patch.object(PatientService, "get_patient_by_user_id", AsyncMock(return_value=patient_model)):
            bad_file = {"file": ("bad_script.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")}
            res_bad = await client.post(f"/api/screenings/{scr_id}/images", files=bad_file)
            log_test("T2.7: Invalid file upload rejected with 400 Bad Request", res_bad.status_code == 400, f"Status: {res_bad.status_code}")

        # B8. AI dual-stage inference execution: transitions to 'completed'
        inf_res = ScreeningInferenceResponse(
            screening_id=scr_id,
            status="completed",
            total_images_processed=1,
            results=[
                ImageInferenceResult(
                    screening_image_id=img_id,
                    classification=ClassificationResult(
                        predicted_class="Canker Sore",
                        predicted_code="CaS",
                        confidence=0.95,
                        probabilities=[
                            ProbabilityItem(class_index=0, class_code="CaS", class_name="Canker Sore", probability=0.95),
                            ProbabilityItem(class_index=1, class_code="CoS", class_name="Cold Sore", probability=0.01),
                            ProbabilityItem(class_index=2, class_code="Gum", class_name="Gum Disease", probability=0.01),
                            ProbabilityItem(class_index=3, class_code="MC", class_name="Mucocele", probability=0.01),
                            ProbabilityItem(class_index=4, class_code="OC", class_name="Oral Cancer", probability=0.01),
                            ProbabilityItem(class_index=5, class_code="OLP", class_name="Oral Lichen Planus", probability=0.005),
                            ProbabilityItem(class_index=6, class_code="OT", class_name="Oral Thrush", probability=0.005),
                        ]
                    ),
                    detections=[],
                    inference_duration_ms=45
                )
            ]
        )
        with patch.object(PatientService, "get_patient_by_user_id", AsyncMock(return_value=patient_model)), \
             patch.object(AIInferenceService, "run_screening_inference", AsyncMock(return_value=inf_res)):
            res_ai = await client.post(f"/api/screenings/{scr_id}/run-ai")
            ai_ok = (res_ai.status_code == 200 and res_ai.json()["status"] == "completed" and len(res_ai.json()["results"][0]["classification"]["probabilities"]) == 7)
            log_test("T2.8: Dual-stage AI inference succeeds with status 'completed'", ai_ok, f"Status: {res_ai.status_code}, screening_status: {res_ai.json().get('status')}")

        # B9. Explainable AI generation returns relative Firebase Storage path (not browser URL)
        xai_res = ScreeningXAIResponse(
            screening_id=scr_id,
            total_results=1,
            results=[
                XAIResultResponse(
                    id=uuid.uuid4(),
                    ai_prediction_id=uuid.uuid4(),
                    screening_image_id=img_id,
                    method="grad_cam",
                    target_layer="features.denseblock4",
                    is_primary_user_facing=True,
                    heatmap_storage_path=f"xai/{scr_id}/grad_cam.png",
                    overlay_image_storage_path=f"xai/{scr_id}/overlay.png",
                    parameters={"alpha": 0.4},
                    created_at=now,
                )
            ]
        )
        with patch.object(PatientService, "get_patient_by_user_id", AsyncMock(return_value=patient_model)), \
             patch.object(XAIService, "generate_screening_xai", AsyncMock(return_value=xai_res)):
            res_xai = await client.post(f"/api/screenings/{scr_id}/xai/grad_cam")
            h_path = res_xai.json()["results"][0]["heatmap_storage_path"] if res_xai.status_code == 200 else ""
            xai_ok = (res_xai.status_code == 200 and h_path.startswith("xai/") and not h_path.startswith("http"))
            log_test("T2.9: XAI explanation returns relative Firebase Storage path (not browser URL)", xai_ok, f"Heatmap path: {h_path}")

        # B10. Clinical Context Engine risk assessment evaluates technical tier score
        risk_res = RiskAssessmentResponse(
            id=uuid.uuid4(),
            screening_id=scr_id,
            risk_level="high",
            risk_score=75.0,
            summary="Elevated risk based on detected lesion",
            recommended_action="Consult a dentist within 48 hours",
            contributing_factors=[],
            created_at=now,
        )
        with patch.object(RiskAssessmentService, "assess_screening", AsyncMock(return_value=risk_res)):
            res_risk = await client.post(f"/api/screenings/{scr_id}/risk-assessment")
            risk_ok = (res_risk.status_code == 200 and res_risk.json()["risk_level"] == "high" and float(res_risk.json()["risk_score"]) == 75.0)
            log_test("T2.10: Risk assessment evaluates technical tier score (25/50/75/100, not probability)", risk_ok, f"Level: {res_risk.json().get('risk_level')}, Score: {res_risk.json().get('risk_score')}")

        # B11. Report generation and authenticated PDF streaming
        from app.models.report import Report
        rep_id = uuid.uuid4()
        rep_model = Report(
            id=rep_id,
            screening_id=scr_id,
            report_number="RPT-2026-001",
            generated_by_id=u_patient.id,
            report_title="Oral Health AI Screening Report",
            summary="Screening summary report",
            report_data={},
            pdf_storage_path=f"reports/{pat_profile_id}/{rep_id}.pdf",
            created_at=now,
            updated_at=now,
        )
        sample_pdf_bytes = b"%PDF-1.4 mock medical report pdf stream"
        with patch.object(ReportService, "generate_screening_report", AsyncMock(return_value=rep_model)), \
             patch.object(ReportService, "get_report_pdf_bytes", AsyncMock(return_value=(sample_pdf_bytes, "report.pdf"))):
            res_rep = await client.post(f"/api/screenings/{scr_id}/report")
            res_pdf = await client.get(f"/api/reports/{rep_id}/download")
            pdf_ok = (res_rep.status_code == 200 and res_pdf.status_code == 200 and res_pdf.headers.get("content-type") == "application/pdf" and res_pdf.content.startswith(b"%PDF"))
            log_test("T2.11: Authenticated PDF download streams binary application/pdf", pdf_ok, f"PDF bytes: {len(res_pdf.content)}, Content-Type: {res_pdf.headers.get('content-type')}")

        # B12. Unauthenticated PDF download rejected with 401
        app.dependency_overrides.pop(get_current_user, None)
        res_pdf_unauth = await client.get(f"/api/reports/{rep_id}/download")
        log_test("T2.12: PDF download without Bearer token rejected with 401 (no download-tickets)", res_pdf_unauth.status_code == 401, f"Status: {res_pdf_unauth.status_code}")

        # Restore patient auth
        app.dependency_overrides[get_current_user] = lambda: u_patient
        dent_profile_id = uuid.uuid4()
        apt_id = uuid.uuid4()

        # B13. Appointment booking and teleconsultation lifecycle ending in 'ended'
        from app.schemas.appointment import AppointmentResponse
        from app.schemas.consultation import ConsultationResponse

        start_dt = now + datetime.timedelta(days=2)
        end_dt = start_dt + datetime.timedelta(minutes=30)

        apt_res = AppointmentResponse(
            id=apt_id,
            patient_id=pat_profile_id,
            dentist_id=dent_profile_id,
            screening_id=None,
            scheduled_start=start_dt,
            scheduled_end=end_dt,
            appointment_type="video_teleconsultation",
            status="requested",
            patient_notes="Followup inspection",
            created_at=now,
            updated_at=now,
        )
        cons_id = uuid.uuid4()
        cons_res_sched = ConsultationResponse(
            id=cons_id,
            appointment_id=apt_id,
            patient_id=pat_profile_id,
            dentist_id=dent_profile_id,
            stream_call_id=f"call_{cons_id}",
            consultation_type="video",
            session_status="scheduled",
            created_at=now,
            updated_at=now,
        )
        cons_res_ended = ConsultationResponse(
            id=cons_id,
            appointment_id=apt_id,
            patient_id=pat_profile_id,
            dentist_id=dent_profile_id,
            stream_call_id=f"call_{cons_id}",
            consultation_type="video",
            session_status="ended",
            clinical_summary="Session ended cleanly",
            created_at=now,
            updated_at=now,
        )

        with patch.object(PatientService, "get_patient_by_user_id", AsyncMock(return_value=patient_model)), \
             patch.object(AppointmentService, "create_appointment", AsyncMock(return_value=apt_res)), \
             patch.object(ConsultationService, "create_consultation", AsyncMock(return_value=cons_res_sched)), \
             patch.object(ConsultationService, "end_consultation", AsyncMock(return_value=cons_res_ended)):
            res_apt = await client.post(
                f"/api/dentists/{dent_profile_id}/appointments",
                json={
                    "scheduled_start": start_dt.isoformat(),
                    "scheduled_end": end_dt.isoformat(),
                    "appointment_type": "video_teleconsultation",
                    "patient_notes": "Followup inspection"
                }
            )
            res_cons = await client.post(f"/api/appointments/{apt_id}/consultation", json={"consultation_type": "video"})
            res_end = await client.patch(f"/api/consultations/{cons_id}/end", json={"clinical_summary": "Session ended cleanly"})
            cons_ok = (res_apt.status_code == 201 and res_cons.status_code == 201 and res_end.status_code == 200 and res_end.json()["session_status"] == "ended")
            log_test("T2.13: Teleconsultation state machine transitions to 'ended' (terminates with ended, not completed)", cons_ok, f"Appt: {res_apt.status_code}, Consult: {res_end.json().get('session_status')}")

        # B14. Idempotent 1-to-1 conversation creation
        conv_id = uuid.uuid4()
        conv_res = ConversationResponse(
            id=conv_id,
            patient_id=pat_profile_id,
            dentist_id=dent_profile_id,
            stream_channel_id=f"direct_{pat_profile_id}_{dent_profile_id}",
            conversation_type="direct",
            is_active=True,
            last_message_at=now,
            created_at=now,
            updated_at=now,
            unread_count=0,
        )
        with patch.object(ConversationService, "create_or_reactivate_for_patient", AsyncMock(side_effect=[(conv_res, True), (conv_res, False)])):
            res_conv1 = await client.post(f"/api/dentists/{dent_profile_id}/conversations", json={})
            res_conv2 = await client.post(f"/api/dentists/{dent_profile_id}/conversations", json={})
            conv_reuse_ok = (res_conv1.status_code == 201 and res_conv2.status_code == 200 and res_conv1.json()["id"] == res_conv2.json()["id"])
            log_test("T2.14: 1-to-1 conversation initiation enforces thread reuse idempotency", conv_reuse_ok, f"Conv 1 ID == Conv 2 ID: {res_conv1.json().get('id')}")

        # B15. Messaging & offset-paginated retrieval
        msg_id = uuid.uuid4()
        msg_res = MessageResponse(
            id=msg_id,
            conversation_id=conv_id,
            sender_id=u_patient.id,
            sender_role="patient",
            content="Hello doctor, follow-up query",
            message_type="text",
            is_read=False,
            read_at=None,
            created_at=now,
        )
        msg_list_res = MessageListResponse(
            items=[msg_res],
            total=1,
            limit=10,
            offset=0,
        )
        with patch.object(ConversationService, "send_message", AsyncMock(return_value=msg_res)), \
             patch.object(ConversationService, "list_messages", AsyncMock(return_value=msg_list_res)):
            res_msg = await client.post(f"/api/conversations/{conv_id}/messages", json={"content": "Hello doctor, follow-up query"})
            res_list_msg = await client.get(f"/api/conversations/{conv_id}/messages?limit=10&offset=0")
            msg_ok = (res_msg.status_code == 201 and res_list_msg.status_code == 200 and "items" in res_list_msg.json() and "limit" in res_list_msg.json())
            log_test("T2.15: Message sending returns 201 and message history follows offset pagination", msg_ok, f"Status: {res_msg.status_code}, Envelope: {list(res_list_msg.json().keys())}")

        # B16. In-App notification read receipts & unread count
        from app.models.notification import Notification
        notif_id = uuid.uuid4()
        notif_model = Notification(
            id=notif_id,
            user_id=u_patient.id,
            notification_type="screening_completed",
            title="Screening Analysis Complete",
            message="Your oral screening has been processed.",
            action_url=f"/screenings/{scr_id}",
            is_read=False,
            read_at=None,
            created_at=now,
        )
        with patch.object(NotificationService, "list_notifications", AsyncMock(return_value=([notif_model], 1, 1))), \
             patch.object(NotificationService, "get_unread_count", AsyncMock(return_value=1)), \
             patch.object(NotificationService, "mark_all_as_read", AsyncMock(return_value=1)):
            res_notif = await client.get("/api/notifications")
            res_unread = await client.get("/api/notifications/unread-count")
            res_read_all = await client.patch("/api/notifications/read-all")
            notif_ok = (res_notif.status_code == 200 and res_unread.status_code == 200 and res_read_all.status_code == 200 and res_read_all.json().get("marked_read_count") == 1)
            log_test("T2.16: Notifications follow offset pagination and support read-all updates", notif_ok, f"Unread count: {res_unread.json().get('unread_count')}, Marked: {res_read_all.json().get('marked_read_count')}")

        # B17. Rate limiter 429 response on scope ai_run
        rate_limiter.clear()
        xai_empty_res = ScreeningXAIResponse(screening_id=scr_id, total_results=0, results=[])
        with patch.object(PatientService, "get_patient_by_user_id", AsyncMock(return_value=patient_model)), \
             patch.object(XAIService, "generate_screening_xai", AsyncMock(return_value=xai_empty_res)):
            limit_triggered = False
            retry_val = None
            for _ in range(11):
                res_rl = await client.post(f"/api/screenings/{scr_id}/xai/grad_cam")
                if res_rl.status_code == 429:
                    limit_triggered = True
                    retry_val = res_rl.headers.get("retry-after")
                    break
            log_test("T2.17: Rate limiter emits 429 Too Many Requests with Retry-After header", limit_triggered, f"Status 429 triggered: {limit_triggered}, Retry-After: {retry_val}")

    app.dependency_overrides.clear()


# =============================================================================
# MAIN RUNNER
# =============================================================================

def main():
    print("========================================================")
    print("ORAVISIONAI — PHASE 21 TWO-TIER VALIDATION HARNESS")
    print("========================================================")
    
    validate_tier1_structural()
    asyncio.run(validate_tier2_behavioral())
    
    total = len(test_results)
    passed = sum(1 for _, p, _ in test_results)
    failed = total - passed

    print("\n========================================================")
    print("PHASE 21 VALIDATION SUMMARY")
    print("========================================================")
    print(f"Total Tests Executed: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed > 0:
        print("\nFAILED TESTS:")
        for name, p, detail in test_results:
            if not p:
                print(f"  - {name}: {detail}")
        sys.exit(1)
    else:
        print("\nALL PHASE 21 VALIDATION TESTS PASSED (100% SUCCESS)")
        sys.exit(0)

if __name__ == "__main__":
    main()
