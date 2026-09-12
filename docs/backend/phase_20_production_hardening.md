# OraVisionAI — Phase 20: Production Hardening & Security

**Date**: September 6, 2026  
**Status**: Complete, Verified, Zero Regressions (Phases 3B–20: 100% PASS)  
**Database Schema**: Exactly 23 Tables Preserved (0 New Migrations, 0 Model Changes)  
**Infrastructure Invariants**: Zero external infrastructure added (No Redis, No Message Brokers)

---

## 1. Executive Summary

Phase 20 establishes comprehensive production hardening, defense-in-depth HTTP security controls, abuse protection, and error sanitization across the **OraVisionAI** backend without altering frozen clinical logic or modifying the database schema.

Key deliverables include:
1. **Defensive HTTP Security Headers**: Implementation of `SecurityHeadersMiddleware` injecting standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, restrictive `Content-Security-Policy`), with `Strict-Transport-Security` (HSTS) emitted conditionally for HTTPS and production environments.
2. **Pre-Buffering Request Body Size Limiting**: Implementation of `RequestSizeLimitMiddleware` enforcing a 1 MB limit on standard JSON requests and a 20 MB limit on multipart image upload requests (allowing framing overhead for the 15 MB file upload ceiling) at the ASGI layer before memory buffering.
3. **Process-Local In-Memory Rate Limiting**: Implementation of `InMemoryRateLimiter` providing thread-safe, sliding-window rate limiting across 5 route categories with per-user, per-IP, and route-scope isolation, `Retry-After` calculation, and lazy memory eviction without external dependencies.
4. **Centralized Exception Handlers**: Registration of handlers in `app/core/exceptions.py` preserving intentional HTTPException status codes (400, 401, 403, 404, 409, 413, 422, 429) and safe details, providing useful client validation errors while sanitizing internal Python/database implementation details on 500 errors.
5. **Active User Hardening**: Updating route dependencies from `get_current_user` to `get_current_active_user` across clinical report and screening evaluation endpoints to reject deactivated accounts while preserving ownership and relationship authorization.
6. **Strict Inbound Request Schemas**: Configuring `model_config = ConfigDict(extra="forbid")` exclusively across verified inbound request schemas in `user.py`, `patient.py`, `dentist.py`, `admin.py`, `screening.py`, `report.py`, `risk_assessment.py`, and `xai.py`.
7. **Production Documentation Toggle**: Restricting Swagger UI (`/docs`), ReDoc (`/redoc`), and OpenAPI schema (`/openapi.json`) to non-production environments when enabled.
8. **CORS Hardening**: Restricting CORS allowed HTTP methods and headers to explicit allow-lists.

---

## 2. In-Memory Rate Limiter Architecture

### 2.1 Process-Local Statement
The `InMemoryRateLimiter` is implemented entirely using Python standard library primitives (`asyncio`, `collections.deque`, `time`, `math`). It operates **strictly within the single local Python process** and does **not** provide distributed protection across horizontal worker nodes. Redis and distributed brokers are explicitly omitted per project architecture constraints. In clustered multi-replica deployments behind load balancers, edge API gateway / reverse-proxy rate limiting (e.g. Nginx `limit_req`, Cloudflare) should be utilized.

### 2.2 Category Limits & Scopes

| Scope Name | Target Endpoints | Max Requests | Window (Seconds) | Rationale |
| :--- | :--- | :---: | :---: | :--- |
| `ai_run` | `POST /api/screenings/{id}/run-ai`<br>`POST /api/screenings/{id}/xai`<br>`POST /api/screenings/{id}/xai/{method}` | **10** | **60s** | Protects computationally intensive PyTorch/TensorFlow inference pipelines. |
| `image_upload` | `POST /api/screenings/{id}/images` | **20** | **60s** | Protects file I/O, hash computation, and Firebase Storage upload bandwidth. |
| `report_ops` | `POST /api/screenings/{id}/report`<br>`GET /api/reports/{id}/download` | **15** | **60s** | Protects ReportLab PDF compilation and streaming bandwidth. |
| `identity_read` | `GET /api/auth/me`<br>`GET /api/users/me` | **60** | **60s** | Protects token synchronization and user lookup queries. |
| `default` | All other API endpoints | **120** | **60s** | Baseline platform defense against burst flooding. |

### 2.3 Identity Key, Isolation & Retry-After
- **Authenticated Requests**: Key is derived as `f"user:{user.id}"`.
- **Unauthenticated Requests**: Key is derived as `f"ip:{client_ip}"`.
- **Scope Isolation**: Keys are compounded with scope `f"{scope}:{identity_key}"`. Consuming quota on `ai_run` has zero effect on `identity_read` or viewing screenings.
- **Per-User Isolation**: User A and User B have separate buckets; throttling User A has zero effect on User B.
- **Retry-After Header**: Monotonically calculated as `max(1, int(math.ceil((oldest_timestamp + window_seconds) - now)))`. Emitted via `Retry-After: <seconds>` on HTTP 429 responses.
- **Memory Eviction**: Passive eviction on each access; periodic sweep purges expired keys every 1,000 requests or when key count exceeds 5,000.
- **Toggle**: Managed by `settings.rate_limit_enabled: bool = True`.

---

## 3. Request Body Size Limit Architecture

### 3.1 File Size vs. Multipart Request Distinction
- **Raw File Content Limit**: Exactly **15 MB** (`15 * 1024 * 1024 = 15,728,640 bytes`), enforced by `validate_image_file` on raw extracted bytes.
- **HTTP Multipart Request Limit**: Set to **20 MB** (`20 * 1024 * 1024 = 20,971,520 bytes`). This accommodates the 15 MB file payload plus ~5 MB of multipart framing overhead (boundary strings, `Content-Disposition`, headers, filenames, form fields) without premature rejection.
- **HTTP JSON Request Limit**: Set to **1 MB** (`1,048,576 bytes`), generous for all JSON payloads across the platform.

### 3.2 Pre-Buffering Enforcement
`RequestSizeLimitMiddleware` intercepts requests at the ASGI layer:
1. **Fast-Path (`Content-Length`)**: If the header exceeds the threshold, the middleware immediately returns an HTTP 413 JSON response without reading body bytes from the wire.
2. **Streaming / Chunked Transfer**: If `Content-Length` is absent, the middleware wraps the ASGI `receive` callable and counts cumulative bytes. Streaming is terminated and HTTP 413 returned as soon as the threshold is crossed, preventing memory exhaustion.

---

## 4. Defensive HTTP Security Headers & Conditional HSTS

### 4.1 Defense-in-Depth HTTP Hardening
Headers emitted by `SecurityHeadersMiddleware`:
- `X-Content-Type-Options: nosniff`: Prevents MIME confusion.
- `X-Frame-Options: DENY`: Prohibits framing and clickjacking.
- `Referrer-Policy: strict-origin-when-cross-origin`: Protects referrer privacy.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Restricts browser hardware access in API context.
- `Content-Security-Policy: default-src 'self'; frame-ancestors 'none';`: Restricts resource loading.

*Note: Security headers represent defense-in-depth hardening. CSP alone does NOT provide complete XSS protection; application security relies on input validation, context-aware escaping, output encoding, and server-side token derivation.*

### 4.2 Conditional HSTS
`Strict-Transport-Security: max-age=31536000; includeSubDomains` is emitted **only** when:
- `request.url.scheme == "https"`, OR
- `request.headers.get("x-forwarded-proto") == "https"`, OR
- `settings.environment == "production"` and `settings.hsts_enabled is True`.

In local development over plain HTTP (`environment == "development"`), HSTS is strictly omitted to prevent browser caching of forced HTTPS on `localhost`.

---

## 5. Centralized Exception Handlers

Registered via `setup_exception_handlers(app)` in `backend/app/core/exceptions.py`:
1. **`StarletteHTTPException`**:
   - Preserves intentional HTTP status codes (400, 401, 403, 404, 409, 413, 422, 429).
   - Preserves safe application details.
   - Preserves response headers (e.g. `WWW-Authenticate`, `Retry-After`).
   - Does NOT convert 4xx client errors into 500 errors.
2. **`RequestValidationError`**:
   - Returns structured HTTP 422 with `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`.
   - Sanitizes `ctx` by removing Python class objects, file paths, and database query fragments.
3. **`SQLAlchemyError`**:
   - Logs database error internally with full traceback.
   - Returns sanitized HTTP 500: `{"detail": "A database error occurred while processing the request."}`.
4. **Generic `Exception`**:
   - Logs unhandled error internally with full traceback.
   - Returns sanitized HTTP 500: `{"detail": "An internal server error occurred."}`.

---

## 6. Active User Hardening & Terminology

### 6.1 Minimal Dependency-Only Changes
Updated from `get_current_user` to `get_current_active_user`:
- `backend/app/api/reports.py`: `get_report_by_id`, `download_report_pdf`
- `backend/app/api/screenings.py`: `generate_screening_report`, `get_screening_report`, `generate_screening_risk_assessment`, `get_screening_risk_assessment`, `review_screening_findings`, `get_dentist_assessment`
- `backend/app/api/users.py`: Preserved `get_current_user` on `get_my_user_profile` so deactivated users can observe their account status (`is_active: false`) without gaining access to clinical operations.

### 6.2 Authoritative Isolation Terminology
- **Cross-Patient Ownership Isolation**: Strict patient boundary enforcement for screenings and notifications.
- **Relationship-Based Dentist Authorization**: Verified dentist profile and active `PatientDentistRelationship` requirement for clinical review.
- **Admin Authorization Boundaries**: Administrative oversight isolated behind `require_admin`.

---

## 7. Pydantic `extra="forbid"` Configuration

Configured strictly on verified inbound request schemas:
- `backend/app/schemas/user.py`: `UserCreate`, `UserUpdate`
- `backend/app/schemas/patient.py`: `PatientUpdate`, `PatientMedicalProfileCreate`, `PatientMedicalProfileUpdate`
- `backend/app/schemas/dentist.py`: `DentistUpdate`, `DentistVerificationCreate`
- `backend/app/schemas/admin.py`: `UserStatusUpdate`, `VerificationReviewRequest`
- `backend/app/schemas/screening.py`: `ScreeningCreate`
- `backend/app/schemas/report.py`: `ReportGenerateRequest`
- `backend/app/schemas/risk_assessment.py`: `RiskAssessmentRequest`
- `backend/app/schemas/xai.py`: `XAIGenerationRequest`

All response schemas (`*Response`), lists (`*ListResponse`), and entity components (`ContributingFactorItem`, `XAIMethodInfo`) remain unmodified.

---

## 8. Database Invariant Compliance

- **Total Database Tables**: Exactly **23 tables** preserved in `Base.metadata`.
- **Alembic Migrations**: Exactly **1 migration** (`001_initial_database_schema.py`) preserved.
- **Model Files**: Zero modifications to `backend/app/models/*`.
- **Frozen Modules**: Zero changes to AI inference, XAI algorithms, 4-tier risk waterfall (`low`, `moderate`, `high`, `critical`), appointments, consultations, or messaging.
