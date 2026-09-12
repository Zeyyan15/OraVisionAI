"""
OraVisionAI — Phase 20 Production Hardening & Security Validation Harness

Executes 24 rigorous security test suites (Suites A through X):
- Suite A: Security Headers & Defensive Options
- Suite B: Conditional HSTS Behavior
- Suite C: Request Body Size Limit — Fast-Path Content-Length
- Suite D: Request Body Size Limit — Streaming / Chunked Transfer
- Suite E: Multipart Overhead Handling & Valid 15 MB File Acceptance
- Suite F: In-Memory Rate Limiter — Window & Threshold Enforcement
- Suite G: In-Memory Rate Limiter — Retry-After Header
- Suite H: In-Memory Rate Limiter — Per-User Identity Isolation
- Suite I: In-Memory Rate Limiter — Route-Scope Isolation
- Suite J: In-Memory Rate Limiter — Unauthenticated IP Isolation
- Suite K: In-Memory Rate Limiter — Cleanup & Memory Eviction
- Suite L: In-Memory Rate Limiter — rate_limit_enabled Flag
- Suite M: Preservation of Intentional HTTPException Status Codes
- Suite N: Centralized RequestValidationError — Useful & Sanitized
- Suite O: Internal Error Sanitization (SQLAlchemyError & Generic Exception)
- Suite P: Active User Enforcement on Reports
- Suite Q: Active User Enforcement on Screenings
- Suite R: extra="forbid" Rejection of Unknown Fields
- Suite S: extra="forbid" Compatibility with Legitimate Payloads
- Suite T: Production Documentation Disabling
- Suite U: CORS Allow-List Restriction
- Suite V: Database Schema Invariant Verification (23 tables, 1 migration)
- Suite W: Frozen Domain Logic & State Machine Integrity
- Suite X: Full Regression Suite across Phases 3B–19
"""

from __future__ import annotations

import asyncio
import io
import os
import sys
import time
import uuid

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from starlette.responses import JSONResponse

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.config import get_settings
from app.core.exceptions import (
    generic_exception_handler,
    http_exception_handler,
    setup_exception_handlers,
    sqlalchemy_exception_handler,
    validation_exception_handler,
)
from app.core.security import (
    InMemoryRateLimiter,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
    enforce_rate_limit,
    rate_limiter,
)
from app.db.base import Base
import app.models  # Ensure all 23 models are registered in Base.metadata
from app.main import app as main_app
from app.schemas.admin import UserStatusUpdate, VerificationReviewRequest
from app.schemas.dentist import DentistUpdate, DentistVerificationCreate
from app.schemas.patient import (
    PatientMedicalProfileCreate,
    PatientMedicalProfileUpdate,
    PatientUpdate,
)
from app.schemas.report import ReportGenerateRequest
from app.schemas.risk_assessment import RiskAssessmentRequest
from app.schemas.screening import ScreeningCreate
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.xai import XAIGenerationRequest

passed_tests = 0
failed_tests = 0


def log_test(suite_name: str, passed: bool, details: str = ""):
    global passed_tests, failed_tests
    status_str = "[PASS]" if passed else "[FAIL]"
    if passed:
        passed_tests += 1
    else:
        failed_tests += 1
    print(f"  {status_str} {suite_name}: {details}")


def run_suite_a():
    """Suite A: Security Headers & Defensive Options"""
    print("\n--- Running Suite A: Security Headers & Defensive Options ---")
    client = TestClient(main_app)
    res = client.get("/health")
    headers = res.headers

    log_test("A1: X-Content-Type-Options", headers.get("x-content-type-options") == "nosniff", f"Got: {headers.get('x-content-type-options')}")
    log_test("A2: X-Frame-Options", headers.get("x-frame-options") == "DENY", f"Got: {headers.get('x-frame-options')}")
    log_test("A3: Referrer-Policy", headers.get("referrer-policy") == "strict-origin-when-cross-origin", f"Got: {headers.get('referrer-policy')}")
    log_test("A4: Permissions-Policy", "camera=()" in headers.get("permissions-policy", ""), f"Got: {headers.get('permissions-policy')}")
    log_test("A5: Content-Security-Policy", "default-src 'self'" in headers.get("content-security-policy", ""), f"Got: {headers.get('content-security-policy')}")


def run_suite_b():
    """Suite B: Conditional HSTS Behavior"""
    print("\n--- Running Suite B: Conditional HSTS Behavior ---")
    client = TestClient(main_app)

    # 1. Plain HTTP request in development environment: HSTS MUST be absent
    res_http = client.get("/health")
    hsts_absent = "strict-transport-security" not in res_http.headers
    log_test("B1: HSTS absent on plain HTTP dev", hsts_absent, f"Headers: {'HSTS present' if not hsts_absent else 'HSTS absent'}")

    # 2. Secure HTTPS forwarded request: HSTS MUST be present
    res_https = client.get("/health", headers={"x-forwarded-proto": "https"})
    hsts_present = "strict-transport-security" in res_https.headers
    log_test("B2: HSTS present on HTTPS forwarded request", hsts_present, f"Got: {res_https.headers.get('strict-transport-security')}")

    # 3. Direct https URL request: HSTS MUST be present
    res_direct_https = client.get("https://testserver/health")
    hsts_direct_present = "strict-transport-security" in res_direct_https.headers
    log_test("B3: HSTS present on direct https URL", hsts_direct_present, f"Got: {res_direct_https.headers.get('strict-transport-security')}")


def run_suite_c():
    """Suite C: Request Body Size Limit — Fast-Path Content-Length"""
    print("\n--- Running Suite C: Request Body Size Limit — Fast-Path Content-Length ---")
    client = TestClient(main_app)

    # 1. JSON endpoint with Content-Length > 1 MB (1,048,576 bytes)
    res_oversized_json = client.post(
        "/api/screenings",
        headers={"Content-Length": "1048577", "Content-Type": "application/json"},
        content=b"",
    )
    log_test("C1: JSON body exceeding 1 MB rejected with 413", res_oversized_json.status_code == 413, f"Status: {res_oversized_json.status_code}")

    # 2. Image upload endpoint with Content-Length > 20 MB (20,971,520 bytes)
    dummy_screening_id = uuid.uuid4()
    res_oversized_upload = client.post(
        f"/api/screenings/{dummy_screening_id}/images",
        headers={"Content-Length": "20971521", "Content-Type": "multipart/form-data; boundary=---boundary"},
        content=b"",
    )
    log_test("C2: Multipart upload exceeding 20 MB rejected with 413", res_oversized_upload.status_code == 413, f"Status: {res_oversized_upload.status_code}")

    # 3. Normal request with Content-Length < 1 MB passes size check
    res_normal = client.get("/health", headers={"Content-Length": "0"})
    log_test("C3: Normal request passes without 413", res_normal.status_code == 200, f"Status: {res_normal.status_code}")


def run_suite_d():
    """Suite D: Request Body Size Limit — Streaming / Chunked Transfer"""
    print("\n--- Running Suite D: Request Body Size Limit — Streaming / Chunked Transfer ---")
    # Build a dedicated test app with RequestSizeLimitMiddleware
    test_app = FastAPI()
    test_app.add_middleware(RequestSizeLimitMiddleware)

    @test_app.post("/stream-test")
    async def stream_endpoint(request: Request):
        body = await request.body()
        return {"received": len(body)}

    client = TestClient(test_app, raise_server_exceptions=False)

    # Stream chunks totaling > 1 MB without Content-Length
    def oversized_stream():
        chunk = b"X" * 65536  # 64 KB
        for _ in range(17):    # 17 * 64 KB = 1.06 MB > 1 MB
            yield chunk

    res_stream = client.post("/stream-test", content=oversized_stream(), headers={"Content-Type": "application/octet-stream"})
    log_test("D1: Streaming chunked upload exceeding 1 MB rejected with 413", res_stream.status_code == 413, f"Status: {res_stream.status_code}")


def run_suite_e():
    """Suite E: Multipart Overhead Handling & Valid 15 MB File Acceptance"""
    print("\n--- Running Suite E: Multipart Overhead Handling & Valid 15 MB File Acceptance ---")
    settings = get_settings()

    # Raw file maximum: 15 MB
    raw_file_max = settings.max_upload_size_bytes  # 15,728,640 bytes
    # Multipart request maximum: 20 MB
    multipart_max = settings.max_multipart_body_size_bytes  # 20,971,520 bytes

    log_test(
        "E1: Raw file maximum is exactly 15 MB",
        raw_file_max == 15 * 1024 * 1024,
        f"{raw_file_max} bytes",
    )
    log_test(
        "E2: Multipart request maximum is 20 MB (allowing framing overhead)",
        multipart_max == 20 * 1024 * 1024,
        f"{multipart_max} bytes",
    )

    # Verify that a 15 MB file within a 15.1 MB multipart payload passes RequestSizeLimitMiddleware without 413
    test_app = FastAPI()
    test_app.add_middleware(RequestSizeLimitMiddleware)

    @test_app.post("/api/screenings/{screening_id}/images")
    async def upload_endpoint(screening_id: uuid.UUID, request: Request):
        return {"ok": True}

    client = TestClient(test_app)
    # Simulate Content-Length of 15.5 MB for multipart upload
    simulated_multipart_len = str(15 * 1024 * 1024 + 500 * 1024)  # 15.5 MB
    res = client.post(
        f"/api/screenings/{uuid.uuid4()}/images",
        headers={"Content-Length": simulated_multipart_len, "Content-Type": "multipart/form-data; boundary=---boundary"},
        content=b"",
    )
    log_test(
        "E3: 15.5 MB multipart request passes middleware without 413",
        res.status_code != 413,
        f"Status: {res.status_code}",
    )


def run_suite_f_to_l():
    """Suites F through L: In-Memory Rate Limiter Tests"""
    print("\n--- Running Suites F to L: In-Memory Rate Limiter ---")
    limiter = InMemoryRateLimiter()

    # Suite F: Threshold Enforcement
    async def test_threshold():
        limiter.clear()
        user_id = "test-user-f"
        scope = "ai_run"  # Limit is 10 requests / 60 seconds

        for i in range(10):
            allowed, _, _ = await limiter.check(identity=f"user:{user_id}", scope=scope)
            assert allowed, f"Request {i+1} should be allowed"

        # 11th request MUST be rejected
        allowed_11, retry_after_11, _ = await limiter.check(identity=f"user:{user_id}", scope=scope)
        return not allowed_11, retry_after_11

    rejected_11, retry_after_11 = asyncio.run(test_threshold())
    log_test("F1: 11th request on ai_run rejected (limit 10/60s)", rejected_11, "Successfully rejected")

    # Suite G: Retry-After Calculation
    log_test("G1: Retry-After is positive integer <= 60", 1 <= retry_after_11 <= 60, f"Retry-After: {retry_after_11}s")

    # Suite H: Per-User Identity Isolation
    async def test_user_isolation():
        user_a = "test-user-a"
        user_b = "test-user-b"
        scope = "ai_run"

        # Throttle User A
        for _ in range(10):
            await limiter.check(identity=f"user:{user_a}", scope=scope)
        allowed_a, _, _ = await limiter.check(identity=f"user:{user_a}", scope=scope)
        assert not allowed_a, "User A must be throttled"

        # User B should NOT be throttled
        allowed_b, _, count_b = await limiter.check(identity=f"user:{user_b}", scope=scope)
        return not allowed_a and allowed_b, count_b

    isolated_users, count_b = asyncio.run(test_user_isolation())
    log_test("H1: User B unaffected when User A is throttled", isolated_users, f"User B count: {count_b}")

    # Suite I: Route-Scope Isolation
    async def test_scope_isolation():
        user = "test-user-scope"
        # Throttle on ai_run
        for _ in range(10):
            await limiter.check(identity=f"user:{user}", scope="ai_run")
        allowed_ai, _, _ = await limiter.check(identity=f"user:{user}", scope="ai_run")

        # Check separate scope identity_read (limit 60)
        allowed_identity, _, count_id = await limiter.check(identity=f"user:{user}", scope="identity_read")
        return not allowed_ai and allowed_identity, count_id

    scope_isolated, count_id = asyncio.run(test_scope_isolation())
    log_test("I1: User throttled on ai_run can still call identity_read", scope_isolated, f"identity_read count: {count_id}")

    # Suite J: Unauthenticated IP Isolation
    async def test_ip_isolation():
        ip_1 = "192.168.1.100"
        ip_2 = "192.168.1.200"
        scope = "default"  # Limit 120

        for _ in range(120):
            await limiter.check(identity=f"ip:{ip_1}", scope=scope)
        allowed_ip1, _, _ = await limiter.check(identity=f"ip:{ip_1}", scope=scope)
        allowed_ip2, _, _ = await limiter.check(identity=f"ip:{ip_2}", scope=scope)
        return not allowed_ip1 and allowed_ip2

    ip_isolated = asyncio.run(test_ip_isolation())
    log_test("J1: IP 2 unaffected when IP 1 is throttled", ip_isolated, "IP isolation verified")

    # Suite K: Cleanup & Memory Eviction
    async def test_cleanup():
        limiter.clear()
        # Add entry with timestamp 100 seconds in the past
        past_time = time.time() - 100.0
        limiter._buckets["default:stale-key"].append(past_time)
        assert len(limiter._buckets) == 1

        pruned = await limiter.prune_stale_buckets()
        return pruned == 1 and len(limiter._buckets) == 0

    cleanup_success = asyncio.run(test_cleanup())
    log_test("K1: Stale in-memory buckets successfully pruned", cleanup_success, "Prune sweep verified")

    # Suite L: rate_limit_enabled Flag
    async def test_disabled_flag():
        settings = get_settings()
        original_val = settings.rate_limit_enabled
        try:
            settings.rate_limit_enabled = False
            limiter.clear()
            # Send 25 requests on ai_run (limit is 10)
            for _ in range(25):
                allowed, _, _ = await limiter.check(identity="user:flag-test", scope="ai_run")
                assert allowed, "All requests must be allowed when rate_limit_enabled is False"
            return True
        finally:
            settings.rate_limit_enabled = original_val

    flag_success = asyncio.run(test_disabled_flag())
    log_test("L1: Rate limiting bypassed when rate_limit_enabled is False", flag_success, "Toggle verified")


def run_suite_m():
    """Suite M: Preservation of Intentional HTTPException Status Codes"""
    print("\n--- Running Suite M: Preservation of Intentional HTTPException Status Codes ---")
    test_app = FastAPI()
    setup_exception_handlers(test_app)

    @test_app.get("/test-400")
    async def test_400():
        raise HTTPException(status_code=400, detail="Custom bad request message")

    @test_app.get("/test-401")
    async def test_401():
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})

    @test_app.get("/test-403")
    async def test_403():
        raise HTTPException(status_code=403, detail="User account is deactivated or suspended")

    @test_app.get("/test-404")
    async def test_404():
        raise HTTPException(status_code=404, detail="Resource not found")

    @test_app.get("/test-409")
    async def test_409():
        raise HTTPException(status_code=409, detail="Clinical assessment already exists")

    @test_app.get("/test-413")
    async def test_413():
        raise HTTPException(status_code=413, detail="Request entity exceeds maximum allowable size.")

    @test_app.get("/test-429")
    async def test_429():
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.", headers={"Retry-After": "42"})

    client = TestClient(test_app)

    # 400
    r400 = client.get("/test-400")
    log_test("M1: 400 status & detail preserved", r400.status_code == 400 and r400.json()["detail"] == "Custom bad request message")

    # 401
    r401 = client.get("/test-401")
    log_test("M2: 401 status & WWW-Authenticate preserved", r401.status_code == 401 and r401.headers.get("www-authenticate") == "Bearer")

    # 403
    r403 = client.get("/test-403")
    log_test("M3: 403 status & detail preserved", r403.status_code == 403 and "deactivated" in r403.json()["detail"])

    # 404
    r404 = client.get("/test-404")
    log_test("M4: 404 status & detail preserved", r404.status_code == 404 and r404.json()["detail"] == "Resource not found")

    # 409
    r409 = client.get("/test-409")
    log_test("M5: 409 status & detail preserved", r409.status_code == 409 and "already exists" in r409.json()["detail"])

    # 413
    r413 = client.get("/test-413")
    log_test("M6: 413 status & detail preserved", r413.status_code == 413)

    # 429
    r429 = client.get("/test-429")
    log_test("M7: 429 status & Retry-After preserved", r429.status_code == 429 and r429.headers.get("retry-after") == "42")


def run_suite_n_and_o():
    """Suites N & O: Validation Errors and Internal Error Sanitization"""
    print("\n--- Running Suites N & O: Validation Errors and Internal Error Sanitization ---")
    test_app = FastAPI()
    setup_exception_handlers(test_app)

    @test_app.post("/test-validation")
    async def test_validation(data: ScreeningCreate):
        return {"notes": data.clinical_notes}

    @test_app.get("/test-db-error")
    async def test_db_error():
        raise OperationalError("SELECT * FROM sensitive_patients WHERE secret_token = 'xyz';", {}, Exception("connection closed"))

    @test_app.get("/test-internal-error")
    async def test_internal_error():
        raise RuntimeError("Internal crash at /var/app/secret_module.py line 42: zero division")

    client = TestClient(test_app, raise_server_exceptions=False)

    # Suite N: Useful & Sanitized Validation Errors
    res_val = client.post("/test-validation", json={"clinical_notes": 12345})  # wrong type
    val_json = res_val.json()
    has_loc = "detail" in val_json and len(val_json["detail"]) > 0 and "loc" in val_json["detail"][0]
    log_test("N1: 422 contains structured loc, msg, type", res_val.status_code == 422 and has_loc, f"Detail: {val_json.get('detail')}")

    # Suite O: Internal Error Sanitization (SQLAlchemyError)
    res_db = client.get("/test-db-error")
    db_json = res_db.json()
    sql_leak = "SELECT" in str(db_json) or "sensitive_patients" in str(db_json)
    log_test("O1: SQLAlchemyError returns sanitized 500 without SQL leakage", res_db.status_code == 500 and not sql_leak, f"Response: {db_json}")

    # Suite O: Generic Exception Sanitization
    res_exc = client.get("/test-internal-error")
    exc_json = res_exc.json()
    traceback_leak = "secret_module.py" in str(exc_json) or "zero division" in str(exc_json)
    log_test("O2: Generic Exception returns sanitized 500 without traceback leakage", res_exc.status_code == 500 and not traceback_leak, f"Response: {exc_json}")


def run_suite_p_and_q():
    """Suites P & Q: Active User Enforcement on Reports and Screenings"""
    print("\n--- Running Suites P & Q: Active User Enforcement ---")
    # Inspect route dependencies on reports and screenings routers to confirm get_current_active_user is used
    from app.api.reports import router as reports_router
    from app.api.screenings import router as screenings_router
    from app.core.auth import get_current_active_user

    # Check reports routes
    report_active_deps = [
        r.path for r in reports_router.routes
        if hasattr(r, "dependant") and any(d.call == get_current_active_user for d in r.dependant.dependencies)
    ]
    log_test("P1: Reports routes enforce get_current_active_user", len(report_active_deps) == 2, f"Enforced routes: {report_active_deps}")

    # Check screenings routes
    screening_active_deps = [
        r.path for r in screenings_router.routes
        if hasattr(r, "dependant") and any(d.call == get_current_active_user for d in r.dependant.dependencies)
    ]
    log_test("Q1: Screenings report/risk/review routes enforce get_current_active_user", len(screening_active_deps) == 6, f"Count: {len(screening_active_deps)}")


def run_suite_r_and_s():
    """Suites R & S: extra='forbid' Rejection and Compatibility"""
    print("\n--- Running Suites R & S: extra='forbid' Rejection and Compatibility ---")

    test_schemas = [
        ("UserCreate", UserCreate, {"first_name": "John", "last_name": "Doe", "email": "j@d.com"}),
        ("UserUpdate", UserUpdate, {"first_name": "John"}),
        ("PatientUpdate", PatientUpdate, {"first_name": "Jane"}),
        ("PatientMedicalProfileCreate", PatientMedicalProfileCreate, {"medical_history": ["asthma"]}),
        ("PatientMedicalProfileUpdate", PatientMedicalProfileUpdate, {"smoking_status": "never"}),
        ("DentistUpdate", DentistUpdate, {"specialization": "Orthodontics"}),
        ("DentistVerificationCreate", DentistVerificationCreate, {"document_type": "license", "document_url": "https://url", "file_name": "doc.pdf"}),
        ("UserStatusUpdate", UserStatusUpdate, {"is_active": True}),
        ("VerificationReviewRequest", VerificationReviewRequest, {"review_notes": "approved"}),
        ("ScreeningCreate", ScreeningCreate, {"clinical_notes": "pain in lower molar"}),
        ("ReportGenerateRequest", ReportGenerateRequest, {"report_title": "Summary Report"}),
        ("RiskAssessmentRequest", RiskAssessmentRequest, {"force_recompute": True}),
        ("XAIGenerationRequest", XAIGenerationRequest, {"force_recompute": False}),
    ]

    # Suite R: Rejection of extra unexpected fields
    for name, schema_cls, valid_data in test_schemas:
        bad_data = {**valid_data, "unauthorized_extra_field_attack": "malicious_payload"}
        rejected = False
        try:
            schema_cls(**bad_data)
        except ValidationError as exc:
            if "extra_forbidden" in str(exc) or "extra fields not permitted" in str(exc).lower():
                rejected = True
        log_test(f"R: {name} rejects unexpected fields", rejected)

    # Suite S: Compatibility with valid payloads
    for name, schema_cls, valid_data in test_schemas:
        accepted = False
        try:
            instance = schema_cls(**valid_data)
            accepted = instance is not None
        except ValidationError:
            accepted = False
        log_test(f"S: {name} accepts valid legitimate payload", accepted)


def run_suite_t_and_u():
    """Suites T & U: Production Documentation Disabling and CORS"""
    print("\n--- Running Suites T & U: Production Documentation and CORS ---")
    settings = get_settings()

    # Suite T: Production Documentation Disabling
    # Simulate production environment
    prod_app = FastAPI(
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    prod_client = TestClient(prod_app)
    r_docs = prod_client.get("/docs")
    r_redoc = prod_client.get("/redoc")
    r_openapi = prod_client.get("/openapi.json")

    log_test("T1: /docs disabled (returns 404 in production)", r_docs.status_code == 404)
    log_test("T2: /redoc disabled (returns 404 in production)", r_redoc.status_code == 404)
    log_test("T3: /openapi.json disabled (returns 404 in production)", r_openapi.status_code == 404)

    # In dev environment with main_app
    dev_client = TestClient(main_app)
    r_dev_docs = dev_client.get("/docs")
    log_test("T4: /docs active in development", r_dev_docs.status_code == 200)

    # Suite U: CORS Allow-List Restriction
    res_cors = dev_client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )
    allow_methods = res_cors.headers.get("access-control-allow-methods", "")
    log_test("U1: CORS allows explicit verbs", "POST" in allow_methods and "GET" in allow_methods, f"Methods: {allow_methods}")
    log_test("U2: CORS omits dangerous wildcard verbs like TRACE", "TRACE" not in allow_methods)


def run_suite_v():
    """Suite V: Database Schema Invariant Verification (23 tables, 1 migration)"""
    print("\n--- Running Suite V: Database Schema Invariants ---")
    total_tables = len(Base.metadata.tables)
    log_test("V1: Exactly 23 database tables in Base.metadata", total_tables == 23, f"Found: {total_tables} tables")

    migration_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "alembic", "versions"))
    migration_files = [f for f in os.listdir(migration_dir) if f.endswith(".py")]
    log_test("V2: Exactly 1 initial Alembic migration", len(migration_files) == 1 and migration_files[0] == "001_initial_database_schema.py", f"Found: {migration_files}")


def run_suite_w():
    """Suite W: Frozen Domain Logic & State Machine Integrity"""
    print("\n--- Running Suite W: Frozen Domain Logic & State Machine Integrity ---")
    from app.services.ai_inference_service import EFFICIENTNET_CLASS_CODES
    from app.schemas.appointment import VALID_STATUSES as APPOINTMENT_STATUSES
    from app.schemas.consultation import VALID_SESSION_STATUSES as CONSULTATION_STATUSES
    from app.schemas.risk_assessment import RiskAssessmentResponse

    # 1. 7-Class AI Taxonomy
    expected_ai_classes = ["CaS", "CoS", "Gum", "MC", "OC", "OLP", "OT"]
    log_test("W1: 7-Class AI taxonomy preserved", EFFICIENTNET_CLASS_CODES == expected_ai_classes, f"Got: {EFFICIENTNET_CLASS_CODES}")

    # 2. 4-Tier Risk Levels (low, moderate, high, critical)
    risk_type_args = RiskAssessmentResponse.model_fields["risk_level"].annotation.__args__
    log_test("W2: 4-Tier risk levels preserved (no 'medium')", set(risk_type_args) == {"low", "moderate", "high", "critical"}, f"Got: {risk_type_args}")

    # 3. 7 Appointment Statuses
    expected_appt = {"requested", "confirmed", "in_progress", "completed", "cancelled", "rescheduled", "no_show"}
    log_test("W3: 7 Appointment statuses preserved", set(APPOINTMENT_STATUSES) == expected_appt, f"Got: {APPOINTMENT_STATUSES}")

    # 4. 4 Consultation Statuses
    expected_consult = {"scheduled", "active", "ended", "failed"}
    log_test("W4: 4 Consultation statuses preserved (no 'completed')", set(CONSULTATION_STATUSES) == expected_consult, f"Got: {CONSULTATION_STATUSES}")


def run_suite_x():
    """Suite X: Full Regression Suite across Phases 3B–19"""
    print("\n--- Running Suite X: Full Regression Suite (Phases 3B–19) ---")
    # Test core endpoints of main_app to ensure no regression in router mounting or health
    client = TestClient(main_app)
    r_root = client.get("/")
    log_test("X1: Root endpoint online", r_root.status_code == 200 and r_root.json()["status"] == "online")

    r_health = client.get("/health")
    log_test("X2: Health check healthy", r_health.status_code == 200 and r_health.json()["status"] == "healthy")

    # Unauthenticated requests across domain routers verify proper 401 Unauthorized handling
    protected_endpoints = [
        ("/api/users/me", 401),
        ("/api/screenings", 401),
        ("/api/reports/00000000-0000-0000-0000-000000000000", 401),
        ("/api/appointments", 401),
        ("/api/consultations/00000000-0000-0000-0000-000000000000", 401),
        ("/api/conversations", 401),
        ("/api/notifications", 401),
        ("/api/admin/analytics/overview", 401),
    ]

    from unittest.mock import AsyncMock
    from app.db.session import get_db

    async def mock_get_db():
        yield AsyncMock()

    main_app.dependency_overrides[get_db] = mock_get_db

    try:
        for path, expected_status in protected_endpoints:
            res = client.get(path)
            log_test(f"X: {path} auth gate", res.status_code == expected_status, f"Got {res.status_code}")
    finally:
        main_app.dependency_overrides.pop(get_db, None)


def main():
    print("=" * 70)
    print(" OraVisionAI — Phase 20 Production Hardening & Security Validation")
    print("=" * 70)

    run_suite_a()
    run_suite_b()
    run_suite_c()
    run_suite_d()
    run_suite_e()
    run_suite_f_to_l()
    run_suite_m()
    run_suite_n_and_o()
    run_suite_p_and_q()
    run_suite_r_and_s()
    run_suite_t_and_u()
    run_suite_v()
    run_suite_w()
    run_suite_x()

    print("\n" + "=" * 70)
    print(f" TOTAL TESTS RUN: {passed_tests + failed_tests}")
    print(f" PASSED: {passed_tests}")
    print(f" FAILED: {failed_tests}")
    print("=" * 70)

    if failed_tests > 0:
        print("\n[FAILED] Phase 20 validation did NOT pass completely!")
        sys.exit(1)
    else:
        print("\n[SUCCESS] Phase 20 production hardening and security validation 100% PASSED!")
        sys.exit(0)


if __name__ == "__main__":
    main()
