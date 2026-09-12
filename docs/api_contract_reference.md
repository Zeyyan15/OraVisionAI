# OraVisionAI — API Contract & Frontend Developer Reference Manual

> **Authoritative Specification**: Prepared during Phase 21 for reliable React frontend client integration.
> **Architecture Freeze**: Database schema (23 tables, 1 migration), AI weights/taxonomy, CCE risk waterfall, and backend domain logic are strictly frozen.

---

## 1. Executive Summary & Integration Principles

The OraVisionAI backend is a FastAPI application exposing **82 operations across 66 canonical URL paths**, organized into 13 modules.

### Core Integration Rules for React Developers:
1. **Authentication**: All operational endpoints require the Firebase ID token in the header: `Authorization: Bearer <token>`.
2. **Token Refresh**: Firebase tokens expire after 60 minutes. React client interceptors must automatically refresh the token upon receiving `401 Unauthorized` (`Authentication token has expired`).
3. **Active Account Check**: Deactivated users receive `403 Forbidden` (`User account is deactivated or suspended`) on all operational routes. Only `GET /api/users/me` permits deactivated users to inspect their account profile.
4. **Clinical Taxonomy**: Strictly use the 7 authoritative classes: `CaS` (Canker Sore), `CoS` (Cold Sore), `Gum` (Gum Disease), `MC` (Mucocele), `OC` (Oral Cancer), `OLP` (Oral Lichen Planus), `OT` (Oral Thrush).
5. **Risk Levels**: Strictly 4 tiers: `low`, `moderate`, `high`, `critical`. The level `medium` does NOT exist.
6. **Technical Risk Score**: `risk_score` (25.00, 50.00, 75.00, 100.00) is a technical ordinal tier index, NOT a disease probability or cancer likelihood. Do NOT display it as a percentage chance of cancer.
7. **Screening Lifecycle**: `pending` -> `uploading` -> `processing` -> `completed` (or `failed`). Statuses `uploaded` or `analyzed` do NOT exist.
8. **Consultation Lifecycle**: `scheduled` -> `active` -> `ended` (or `failed`). Teleconsultations terminate with `ended`, not `completed`.
9. **XAI Artifacts**: Heatmaps and overlays return relative Firebase Storage paths (e.g. `xai/.../heatmap_abc.png`), NOT browser-accessible image URLs. The client cannot render them in `<img src=...>` directly.
10. **Report PDF Download**: `GET /api/reports/{id}/download` requires standard Bearer token authentication and streams binary `application/pdf`. No download-tickets or public token swaps exist.

---

## 2. Pre-Existing Phase 20 Rate-Limiter Conformance Discrepancy

During the Phase 21 audit, a discrepancy was identified between the conceptual Phase 20 specification and the live implementation in `backend/app/core/security.py`:

| Specification / Aspect | Frozen Phase 20 Conceptual Contract | Observed Live Implementation in Code |
| :--- | :--- | :--- |
| **Scope Names & Limits** | • `auth_login`: 5 req / 60s<br>• `image_upload`: 20 req / 60s<br>• `ai_run`: 10 req / 60s<br>• `report_ops`: 15 req / 60s<br>• `general_api`: 120 req / 60s | • `ai_run`: (10, 60)<br>• `image_upload`: (20, 60)<br>• `report_ops`: (15, 60)<br>• `identity_read`: (60, 60)<br>• `default`: (120, 60) |
| **Endpoint Call Coverage** | Intended across all category endpoints | Explicitly invoked on only 3 operations:<br>1. `POST /api/screenings/{id}/xai/{method}` (`ai_run`)<br>2. `POST /api/screenings/{id}/report` (`report_ops`)<br>3. `GET /api/reports/{id}/download` (`report_ops`) |
| **Fallback Behavior** | Not formally specified | Unknown scopes safely fall back to `default` (120 req / 60s) |

> [!WARNING]
> **Change Control Boundary**: This is documented as a pre-existing Phase 20 contract-conformance discrepancy. In accordance with Phase 21 governance, Phase 20 production code is strictly frozen and has NOT been modified.

---

## 3. Authentication & Role-Based Access Control (RBAC)

### 3.1 Authentication Dependency Distribution across 82 Operations
- `None (Public)`: **3** operations (`GET /`, `GET /health`, `GET /api/xai/methods`)
- `get_current_firebase_user`: **1** operation (`GET /api/auth/me`)
- `get_current_user`: **1** operation (`GET /api/users/me`)
- `get_current_active_user`: **34** operations (active user token + service-layer ownership/relationship check)
- `require_patient`: **16** operations (`user.role == 'patient'`)
- `require_dentist`: **11** operations (`user.role == 'dentist'`)
- `require_admin`: **16** operations (`user.role == 'admin'`)

### 3.2 Role Permissions Matrix
| Feature / Domain | Public | Patient | Dentist | Admin |
| :--- | :---: | :---: | :---: | :---: |
| Health & Public Methods | Yes | Yes | Yes | Yes |
| Account Self-Inspection (`/api/users/me`) | No | Yes (Active/Deactivated) | Yes (Active/Deactivated) | Yes (Active/Deactivated) |
| Create Screening & Upload Photos | No | Yes | No | No |
| Run AI & Generate XAI Heatmaps | No | Yes | No | No |
| View Patient Screenings / Reports | No | Own Only | Assigned Patients Only | All (Oversight) |
| Dentist Verification Submission | No | No | Yes (Pending/Rejected) | No |
| Set Dentist Availability Schedule | No | No | Yes (Approved Only) | No |
| Book Appointment | No | Yes | No | No |
| Update Appointment Status | No | Cancel Only | Confirm / In-Progress / Complete / Cancel | No |
| Teleconsultation Video Session | No | Participant | Host / Start / End / Fail | No |
| 1-to-1 Asynchronous Messaging | No | Treating Dentist Only | Assigned Patient Only | No |
| Admin Oversight, Audit & Analytics | No | No | No | Yes |

---

## 4. Domain Models & Lifecycle Contracts

### 4.1 Screening Lifecycle State Machine
Enforced by table check constraint `chk_screenings_status`:
```
pending ──► uploading ──► processing ──► completed
                                │
                                ▼
                              failed
```
- `pending`: Initial state created via `POST /api/screenings`.
- `uploading`: Photo uploaded and attached via `POST /api/screenings/{id}/images`.
- `processing`: Dual-stage AI inference initiated via `POST /api/screenings/{id}/run-ai`.
- `completed`: YOLO bounding boxes and 7-class EfficientNet predictions successfully persisted.
- `failed`: Inference encountered an unrecoverable model or image decoding failure.

### 4.2 AI Taxonomy (7 Authoritative Classes)
| Code | Clinical Name | Description |
| :--- | :--- | :--- |
| `CaS` | **Canker Sore** | Aphthous stomatitis / benign recurrent mucosal ulceration |
| `CoS` | **Cold Sore** | Herpes simplex labialis / viral vesicular lesion |
| `Gum` | **Gum Disease** | Gingivitis, periodontitis, or inflammatory gingival lesion |
| `MC` | **Mucocele** | Benign mucous extravasation cyst of salivary gland |
| `OC` | **Oral Cancer** | Oral squamous cell carcinoma / malignant lesion |
| `OLP` | **Oral Lichen Planus** | Chronic autoimmune inflammatory mucosal condition |
| `OT` | **Oral Thrush** | Oral pseudomembranous/erythematous candidiasis |

### 4.3 Risk Assessment Contract (Clinical Context Engine)
- **4 Tiers**: `low`, `moderate`, `high`, `critical`.
- **Technical Tier Score**: `low`=25.00, `moderate`=50.00, `high`=75.00, `critical`=100.00.
- **Clinical Meaning**: The risk score is an internal ordinal ranking for triage priority; it does NOT represent disease probability.
- **Waterfall Input Factors**: Primary AI classification, YOLO finding count, patient age (>= 50), and patient medical habits (`betel_quid_user`, `smoking_status`, `alcohol_consumption`).

### 4.4 Telehealth & Teleconsultation Lifecycle
- **Appointment States (7)**: `requested` -> `confirmed` -> `in_progress` -> `completed` (branches: `cancelled`, `rescheduled`, `no_show`).
- **Consultation States (4)**: `scheduled` -> `active` -> `ended` (or `failed`). Terminated by `ended`, not `completed`.
- **Stream Identifiers**: Contains `stream_call_id` and `stream_channel_id` placeholder strings. The backend does not implement live WebRTC signaling or Stream SDK webhooks.

### 4.5 In-App Notifications (Exact 9 Types)
Enforced by database check constraint `chk_notification_type`:
`screening_completed`, `screening_failed`, `appointment_booked`, `appointment_confirmed`, `appointment_cancelled`, `dentist_verified`, `dentist_assessment_added`, `new_message`, `system_alert`.

---

## 5. Complete Endpoint-by-Endpoint Contract (All 82 Operations)

### 5.1 Root Module (2 Operations)

#### `GET` /
- **Summary**: Root
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `None (Public)` (Role: `None (Public)`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Public | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `dict/binary`

#### `GET` /health
- **Summary**: Health Check
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `None (Public)` (Role: `None (Public)`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Public | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `dict/binary`

### 5.2 Admin Module (15 Operations)

#### `GET` /api/admin/ai-models
- **Summary**: List registered AI models
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `AIModelListResponse`
  - Top-Level Fields:
    - `items` (List[AIModelResponse])
    - `total` (integer)

#### `GET` /api/admin/ai-models/{model_id}
- **Summary**: Get registered AI model detail
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `model_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `AIModelResponse`
  - Top-Level Fields:
    - `id` (string)
    - `name` (string)
    - `model_type` (string)
    - `version` (string)
    - `architecture` (string)
    - `input_shape` (string)
    - `class_labels` (array)
    - `target_layers` (array | null)
    - *(and 2 more fields)*

#### `GET` /api/admin/analytics/ai-telemetry
- **Summary**: Get AI inference telemetry
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `AITelemetryAnalyticsResponse`
  - Top-Level Fields:
    - `total_predictions` (integer)
    - `classification_distribution` (List[AIClassTelemetryItem])
    - `average_prediction_confidence` (number)
    - `total_yolo_detections` (integer)
    - `average_detections_per_image` (number)
    - `total_xai_generations` (integer)
    - `active_models` (List[AIActiveModelSummary])
    - `generated_at` (string)

#### `GET` /api/admin/analytics/overview
- **Summary**: Get platform overview analytics
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `PlatformOverviewAnalyticsResponse`
  - Top-Level Fields:
    - `users` (UserOverviewMetrics)
    - `dentist_verifications` (DentistVerificationOverviewMetrics)
    - `screenings` (ScreeningOverviewMetrics)
    - `telehealth` (TelehealthOverviewMetrics)
    - `communication` (CommunicationOverviewMetrics)
    - `total_audit_logs` (integer)
    - `generated_at` (string)

#### `GET` /api/admin/analytics/screenings
- **Summary**: Get screening workflow analytics
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: System-wide analytics | None
- **Side Effects**: Anchors screening population on creation date of non-deleted screenings when date filters supplied
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `None`
- **Query Parameters**:
  - `start_date` (string): default=None, required=False
  - `end_date` (string): default=None, required=False
- **Request Body**: `none`
- **Response Model**: `ClinicalScreeningAnalyticsResponse`
  - Top-Level Fields:
    - `total_screenings` (integer)
    - `screening_status_breakdown` (object)
    - `risk_distribution` (List[RiskDistributionItem])
    - `dentist_assessments` (DentistAssessmentMetrics)
    - `reports_generated` (integer)
    - `start_date` (string | null)
    - `end_date` (string | null)
    - `generated_at` (string)

#### `GET` /api/admin/analytics/telehealth
- **Summary**: Get telehealth utilization analytics
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `TelehealthAnalyticsResponse`
  - Top-Level Fields:
    - `total_appointments` (integer)
    - `appointment_status_breakdown` (object)
    - `appointment_cancellation_rate` (number)
    - `total_consultations` (integer)
    - `consultation_status_breakdown` (object)
    - `total_ended_consultation_duration_seconds` (integer)
    - `average_ended_consultation_duration_seconds` (number)
    - `generated_at` (string)

#### `GET` /api/admin/audit-logs
- **Summary**: List audit logs
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: System-wide audit trail inspection | None
- **Side Effects**: Recursively redacts passwords, tokens, and authorization headers with '[REDACTED]'
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `page_based (page, page_size)`
- **Query Parameters**:
  - `user_id` (string): default=None, required=False
  - `action` (string): default=None, required=False
  - `resource_type` (string): default=None, required=False
  - `start_date` (string): default=None, required=False
  - `end_date` (string): default=None, required=False
  - `page` (integer): default=1, required=False
  - `page_size` (integer): default=20, required=False
- **Request Body**: `none`
- **Response Model**: `AdminAuditLogListResponse`
  - Top-Level Fields:
    - `items` (List[AdminAuditLogResponse])
    - `total` (integer)
    - `page` (integer)
    - `page_size` (integer)
    - `total_pages` (integer)

#### `GET` /api/admin/audit-logs/{audit_log_id}
- **Summary**: Get audit log details
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `audit_log_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `AdminAuditLogResponse`
  - Top-Level Fields:
    - `id` (string)
    - `user_id` (string | null)
    - `actor_email` (string | null)
    - `actor_role` (string | null)
    - `action` (string)
    - `resource_type` (string)
    - `resource_id` (string | null)
    - `details` (object | null)
    - *(and 3 more fields)*

#### `GET` /api/admin/dentist-verifications
- **Summary**: List Dentist Verifications
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `page_based`
- **Query Parameters**:
  - `status` (string): default=None, required=False
  - `page` (integer): default=1, required=False
  - `page_size` (integer): default=20, required=False
- **Request Body**: `none`
- **Response Model**: `AdminVerificationListResponse`
  - Top-Level Fields:
    - `items` (List[AdminDentistVerificationResponse])
    - `total` (integer)
    - `page` (integer)
    - `page_size` (integer)
    - `total_pages` (integer)

#### `GET` /api/admin/dentist-verifications/{verification_id}
- **Summary**: Get Dentist Verification Detail
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `verification_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `AdminDentistVerificationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `dentist_id` (string)
    - `dentist_user_id` (string | null)
    - `dentist_name` (string | null)
    - `dentist_email` (string | null)
    - `license_number` (string | null)
    - `specialization` (string | null)
    - `document_type` (string)
    - *(and 8 more fields)*

#### `POST` /api/admin/dentist-verifications/{verification_id}/approve
- **Summary**: Approve Dentist Verification
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `verification_id` (string): required=True
- **Request Body**: `Review Data` (Content-Type: `application/json`)
- **Response Model**: `AdminDentistVerificationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `dentist_id` (string)
    - `dentist_user_id` (string | null)
    - `dentist_name` (string | null)
    - `dentist_email` (string | null)
    - `license_number` (string | null)
    - `specialization` (string | null)
    - `document_type` (string)
    - *(and 8 more fields)*

#### `POST` /api/admin/dentist-verifications/{verification_id}/reject
- **Summary**: Reject Dentist Verification
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `verification_id` (string): required=True
- **Request Body**: `Review Data` (Content-Type: `application/json`)
- **Response Model**: `AdminDentistVerificationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `dentist_id` (string)
    - `dentist_user_id` (string | null)
    - `dentist_name` (string | null)
    - `dentist_email` (string | null)
    - `license_number` (string | null)
    - `specialization` (string | null)
    - `document_type` (string)
    - *(and 8 more fields)*

#### `GET` /api/admin/users
- **Summary**: List Users
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: System-wide administrative oversight | None
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `page_based (page, page_size)`
- **Query Parameters**:
  - `role` (string): default=None, required=False
  - `is_active` (string): default=None, required=False
  - `page` (integer): default=1, required=False
  - `page_size` (integer): default=20, required=False
- **Request Body**: `none`
- **Response Model**: `AdminUserListResponse`
  - Top-Level Fields:
    - `items` (List[AdminUserResponse])
    - `total` (integer)
    - `page` (integer)
    - `page_size` (integer)
    - `total_pages` (integer)

#### `GET` /api/admin/users/{user_id}
- **Summary**: Get User Detail
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `user_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `AdminUserResponse`
  - Top-Level Fields:
    - `id` (string)
    - `firebase_uid` (string)
    - `email` (string)
    - `role` (string)
    - `first_name` (string)
    - `last_name` (string)
    - `phone_number` (string | null)
    - `avatar_url` (string | null)
    - *(and 7 more fields)*

#### `PATCH` /api/admin/users/{user_id}/status
- **Summary**: Update User Status
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `user_id` (string): required=True
- **Request Body**: `UserStatusUpdate` (Content-Type: `application/json`)
  - Fields:
    - `is_active` (boolean): required=True, default=None
- **Response Model**: `AdminUserResponse`
  - Top-Level Fields:
    - `id` (string)
    - `firebase_uid` (string)
    - `email` (string)
    - `role` (string)
    - `first_name` (string)
    - `last_name` (string)
    - `phone_number` (string | null)
    - `avatar_url` (string | null)
    - *(and 7 more fields)*

### 5.3 Appointments Module (4 Operations)

#### `GET` /api/appointments
- **Summary**: List user's appointments
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `bounded_list`
- **Query Parameters**:
  - `status` (string): default=None, required=False
- **Request Body**: `none`
- **Response Model**: `AppointmentListResponse`
  - Top-Level Fields:
    - `items` (List[AppointmentResponse])
    - `total` (integer)

#### `GET` /api/appointments/{appointment_id}
- **Summary**: Get appointment details
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `appointment_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `AppointmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `screening_id` (string | null)
    - `scheduled_start` (string)
    - `scheduled_end` (string)
    - `appointment_type` (string)
    - `status` (string)
    - *(and 9 more fields)*

#### `PATCH` /api/appointments/{appointment_id}/cancel
- **Summary**: Cancel appointment
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `appointment_id` (string): required=True
- **Request Body**: `AppointmentCancel` (Content-Type: `application/json`)
  - Fields:
    - `cancellation_reason` (string): required=True, default=None
- **Response Model**: `AppointmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `screening_id` (string | null)
    - `scheduled_start` (string)
    - `scheduled_end` (string)
    - `appointment_type` (string)
    - `status` (string)
    - *(and 9 more fields)*

#### `PATCH` /api/appointments/{appointment_id}/status
- **Summary**: Update appointment status
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `appointment_id` (string): required=True
- **Request Body**: `AppointmentStatusUpdate` (Content-Type: `application/json`)
  - Fields:
    - `status` (string): required=True, default=None
    - `dentist_notes` (string | null): required=False, default=None
- **Response Model**: `AppointmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `screening_id` (string | null)
    - `scheduled_start` (string)
    - `scheduled_end` (string)
    - `appointment_type` (string)
    - `status` (string)
    - *(and 9 more fields)*

### 5.4 Consultations Module (7 Operations)

#### `GET` /api/appointments/{appointment_id}/consultation
- **Summary**: Get consultation session for appointment
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `appointment_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ConsultationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `appointment_id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_call_id` (string)
    - `stream_channel_id` (string | null)
    - `consultation_type` (string)
    - `session_status` (string)
    - *(and 11 more fields)*

#### `POST` /api/appointments/{appointment_id}/consultation
- **Summary**: Initialize consultation session for appointment
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `appointment_id` (string): required=True
- **Request Body**: `ConsultationCreate` (Content-Type: `application/json`)
  - Fields:
    - `consultation_type` (string): required=False, default=video
- **Response Model**: `ConsultationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `appointment_id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_call_id` (string)
    - `stream_channel_id` (string | null)
    - `consultation_type` (string)
    - `session_status` (string)
    - *(and 11 more fields)*

#### `GET` /api/consultations
- **Summary**: List consultation sessions
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `bounded_list`
- **Query Parameters**:
  - `status` (string): default=None, required=False
- **Request Body**: `none`
- **Response Model**: `ConsultationListResponse`
  - Top-Level Fields:
    - `items` (List[ConsultationResponse])
    - `total` (integer)

#### `GET` /api/consultations/{consultation_id}
- **Summary**: Get consultation session details
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `consultation_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ConsultationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `appointment_id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_call_id` (string)
    - `stream_channel_id` (string | null)
    - `consultation_type` (string)
    - `session_status` (string)
    - *(and 11 more fields)*

#### `PATCH` /api/consultations/{consultation_id}/end
- **Summary**: End teleconsultation session
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `consultation_id` (string): required=True
- **Request Body**: `ConsultationEnd` (Content-Type: `application/json`)
  - Fields:
    - `clinical_summary` (string | null): required=False, default=None
- **Response Model**: `ConsultationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `appointment_id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_call_id` (string)
    - `stream_channel_id` (string | null)
    - `consultation_type` (string)
    - `session_status` (string)
    - *(and 11 more fields)*

#### `PATCH` /api/consultations/{consultation_id}/fail
- **Summary**: Mark teleconsultation session as failed
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `consultation_id` (string): required=True
- **Request Body**: `ConsultationFail` (Content-Type: `application/json`)
- **Response Model**: `ConsultationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `appointment_id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_call_id` (string)
    - `stream_channel_id` (string | null)
    - `consultation_type` (string)
    - `session_status` (string)
    - *(and 11 more fields)*

#### `PATCH` /api/consultations/{consultation_id}/start
- **Summary**: Start teleconsultation session
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `consultation_id` (string): required=True
- **Request Body**: `ConsultationStart` (Content-Type: `application/json`)
- **Response Model**: `ConsultationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `appointment_id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_call_id` (string)
    - `stream_channel_id` (string | null)
    - `consultation_type` (string)
    - `session_status` (string)
    - *(and 11 more fields)*

### 5.5 Authentication Module (1 Operations)

#### `GET` /api/auth/me
- **Summary**: Get Current User Identity
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_firebase_user` (Role: `Any (Handshake)`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: User resolves own record matching Firebase UID | None
- **Side Effects**: Auto-syncs user profile, updates email_verified and avatar_url in PostgreSQL
- **Notifications**: None
- **Idempotency**: Idempotent read/sync
- **Pagination Convention**: `None`
- **Request Body**: `none`
- **Response Model**: `AuthIdentityResponse`
  - Top-Level Fields:
    - `authenticated` (boolean)
    - `firebase_uid` (string)
    - `email` (string | null)
    - `email_verified` (boolean)

### 5.6 Conversations Module (9 Operations)

#### `GET` /api/conversations
- **Summary**: List conversation threads
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `bounded_list`
- **Query Parameters**:
  - `is_active` (string): default=None, required=False
  - `patient_id` (string): default=None, required=False
  - `dentist_id` (string): default=None, required=False
- **Request Body**: `none`
- **Response Model**: `ConversationListResponse`
  - Top-Level Fields:
    - `total` (integer)
    - `items` (List[ConversationResponse])

#### `GET` /api/conversations/{conversation_id}
- **Summary**: Get conversation thread details
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `conversation_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ConversationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_channel_id` (string)
    - `conversation_type` (string)
    - `is_active` (boolean)
    - `last_message_at` (string | null)
    - `created_at` (string)
    - *(and 5 more fields)*

#### `PATCH` /api/conversations/{conversation_id}/archive
- **Summary**: Archive a conversation thread
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `conversation_id` (string): required=True
- **Request Body**: `ConversationArchive` (Content-Type: `application/json`)
- **Response Model**: `ConversationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_channel_id` (string)
    - `conversation_type` (string)
    - `is_active` (boolean)
    - `last_message_at` (string | null)
    - `created_at` (string)
    - *(and 5 more fields)*

#### `GET` /api/conversations/{conversation_id}/messages
- **Summary**: List messages in a conversation (chronological)
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `patient / dentist (active participant)`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Caller must be participant in conversation | Implicit via conversation membership
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `offset_based (limit, offset)`
- **Path Parameters**:
  - `conversation_id` (string): required=True
- **Query Parameters**:
  - `limit` (integer): default=50, required=False
  - `offset` (integer): default=0, required=False
- **Request Body**: `none`
- **Response Model**: `MessageListResponse`
  - Top-Level Fields:
    - `total` (integer)
    - `limit` (integer)
    - `offset` (integer)
    - `items` (List[MessageResponse])

#### `POST` /api/conversations/{conversation_id}/messages
- **Summary**: Post a text message in an active conversation
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `get_current_active_user` (Role: `patient / dentist (active participant)`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Caller must be a participant in conversation | Implicit via conversation membership
- **Side Effects**: Persists Message record
- **Notifications**: Dispatches 'new_message' notification to recipient
- **Idempotency**: Non-idempotent message creation
- **Pagination Convention**: `None`
- **Path Parameters**:
  - `conversation_id` (string): required=True
- **Request Body**: `MessageCreate` (Content-Type: `application/json`)
  - Fields:
    - `content` (string): required=True, default=None
    - `message_type` (string): required=False, default=text
- **Response Model**: `MessageResponse`
  - Top-Level Fields:
    - `id` (string)
    - `conversation_id` (string)
    - `sender_id` (string)
    - `stream_message_id` (string | null)
    - `message_type` (string)
    - `content` (string)
    - `attachment_storage_path` (string | null)
    - `is_read` (boolean)
    - *(and 4 more fields)*

#### `GET` /api/conversations/{conversation_id}/messages/{message_id}
- **Summary**: Get single message details
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `conversation_id` (string): required=True
  - `message_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `MessageResponse`
  - Top-Level Fields:
    - `id` (string)
    - `conversation_id` (string)
    - `sender_id` (string)
    - `stream_message_id` (string | null)
    - `message_type` (string)
    - `content` (string)
    - `attachment_storage_path` (string | null)
    - `is_read` (boolean)
    - *(and 4 more fields)*

#### `PATCH` /api/conversations/{conversation_id}/read
- **Summary**: Mark unread incoming messages as read
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `conversation_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `MessageReadResponse`
  - Top-Level Fields:
    - `marked_read_count` (integer)
    - `conversation_id` (string)

#### `POST` /api/dentists/{dentist_id}/conversations
- **Summary**: Initiate or reactivate conversation with a dentist (Patient only)
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Patient initiates conversation with specified dentist | PatientDentistRelationship required
- **Side Effects**: Creates 1-to-1 conversation if not present, otherwise returns existing conversation
- **Notifications**: None
- **Idempotency**: Idempotent thread reuse
- **Pagination Convention**: `None`
- **Path Parameters**:
  - `dentist_id` (string): required=True
- **Request Body**: `ConversationCreate` (Content-Type: `application/json`)
- **Response Model**: `ConversationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_channel_id` (string)
    - `conversation_type` (string)
    - `is_active` (boolean)
    - `last_message_at` (string | null)
    - `created_at` (string)
    - *(and 5 more fields)*

#### `POST` /api/patients/{patient_id}/conversations
- **Summary**: Initiate or reactivate conversation with a patient (Dentist only)
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Dentist initiates conversation with specified patient | PatientDentistRelationship required
- **Side Effects**: Creates 1-to-1 conversation if not present, otherwise returns existing conversation
- **Notifications**: None
- **Idempotency**: Idempotent thread reuse
- **Pagination Convention**: `None`
- **Path Parameters**:
  - `patient_id` (string): required=True
- **Request Body**: `ConversationCreate` (Content-Type: `application/json`)
- **Response Model**: `ConversationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `stream_channel_id` (string)
    - `conversation_type` (string)
    - `is_active` (boolean)
    - `last_message_at` (string | null)
    - `created_at` (string)
    - *(and 5 more fields)*

### 5.7 Dentists Module (10 Operations)

#### `GET` /api/dentists/me
- **Summary**: Get My Dentist Profile
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `DentistResponse`
  - Top-Level Fields:
    - `id` (string)
    - `user_id` (string)
    - `email` (string)
    - `first_name` (string)
    - `last_name` (string)
    - `phone_number` (string | null)
    - `avatar_url` (string | null)
    - `license_number` (string)
    - *(and 10 more fields)*

#### `PATCH` /api/dentists/me
- **Summary**: Update My Dentist Profile
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Request Body**: `DentistUpdate` (Content-Type: `application/json`)
  - Fields:
    - `specialization` (string | null): required=False, default=None
    - `clinic_name` (string | null): required=False, default=None
    - `clinic_address` (string | null): required=False, default=None
    - `years_of_experience` (integer | null): required=False, default=None
    - `bio` (string | null): required=False, default=None
    - `first_name` (string | null): required=False, default=None
    - `last_name` (string | null): required=False, default=None
    - `phone_number` (string | null): required=False, default=None
    - `avatar_url` (string | null): required=False, default=None
- **Response Model**: `DentistResponse`
  - Top-Level Fields:
    - `id` (string)
    - `user_id` (string)
    - `email` (string)
    - `first_name` (string)
    - `last_name` (string)
    - `phone_number` (string | null)
    - `avatar_url` (string | null)
    - `license_number` (string)
    - *(and 10 more fields)*

#### `GET` /api/dentists/me/availability
- **Summary**: List dentist's own availability windows
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `bounded_list`
- **Request Body**: `none`
- **Response Model**: `DentistAvailabilityListResponse`
  - Top-Level Fields:
    - `items` (List[DentistAvailabilityResponse])
    - `total` (integer)

#### `POST` /api/dentists/me/availability
- **Summary**: Create availability window
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `bounded_list`
- **Request Body**: `DentistAvailabilityCreate` (Content-Type: `application/json`)
  - Fields:
    - `day_of_week` (integer): required=True, default=None
    - `start_time` (string): required=True, default=None
    - `end_time` (string): required=True, default=None
    - `slot_duration_minutes` (integer): required=False, default=30
    - `is_active` (boolean): required=False, default=True
- **Response Model**: `DentistAvailabilityResponse`
  - Top-Level Fields:
    - `id` (string)
    - `dentist_id` (string)
    - `day_of_week` (integer)
    - `start_time` (string)
    - `end_time` (string)
    - `slot_duration_minutes` (integer)
    - `is_active` (boolean)

#### `DELETE` /api/dentists/me/availability/{availability_id}
- **Summary**: Delete dentist's availability window
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `availability_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `dict/binary`

#### `PATCH` /api/dentists/me/availability/{availability_id}
- **Summary**: Update dentist's availability window
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `availability_id` (string): required=True
- **Request Body**: `DentistAvailabilityUpdate` (Content-Type: `application/json`)
  - Fields:
    - `day_of_week` (integer | null): required=False, default=None
    - `start_time` (string | null): required=False, default=None
    - `end_time` (string | null): required=False, default=None
    - `slot_duration_minutes` (integer | null): required=False, default=None
    - `is_active` (boolean | null): required=False, default=None
- **Response Model**: `DentistAvailabilityResponse`
  - Top-Level Fields:
    - `id` (string)
    - `dentist_id` (string)
    - `day_of_week` (integer)
    - `start_time` (string)
    - `end_time` (string)
    - `slot_duration_minutes` (integer)
    - `is_active` (boolean)

#### `GET` /api/dentists/me/verification
- **Summary**: Get My Verification Status
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `DentistVerificationResponse`
  - Top-Level Fields:
    - `document_type` (string)
    - `document_url` (string)
    - `file_name` (string)
    - `file_size_bytes` (integer | null)
    - `id` (string)
    - `dentist_id` (string)
    - `status` (string)
    - `submitted_at` (string)
    - *(and 2 more fields)*

#### `POST` /api/dentists/me/verification
- **Summary**: Submit My Verification
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Request Body**: `DentistVerificationCreate` (Content-Type: `application/json`)
  - Fields:
    - `document_type` (string): required=True, default=None
    - `document_url` (string): required=True, default=None
    - `file_name` (string): required=True, default=None
    - `file_size_bytes` (integer | null): required=False, default=None
- **Response Model**: `DentistVerificationResponse`
  - Top-Level Fields:
    - `document_type` (string)
    - `document_url` (string)
    - `file_name` (string)
    - `file_size_bytes` (integer | null)
    - `id` (string)
    - `dentist_id` (string)
    - `status` (string)
    - `submitted_at` (string)
    - *(and 2 more fields)*

#### `POST` /api/dentists/{dentist_id}/appointments
- **Summary**: Request/book an appointment with a dentist
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `dentist_id` (string): required=True
- **Request Body**: `AppointmentCreate` (Content-Type: `application/json`)
  - Fields:
    - `scheduled_start` (string): required=True, default=None
    - `scheduled_end` (string): required=True, default=None
    - `appointment_type` (string): required=False, default=video_teleconsultation
    - `screening_id` (string | null): required=False, default=None
    - `patient_notes` (string | null): required=False, default=None
- **Response Model**: `AppointmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `dentist_id` (string)
    - `screening_id` (string | null)
    - `scheduled_start` (string)
    - `scheduled_end` (string)
    - `appointment_type` (string)
    - `status` (string)
    - *(and 9 more fields)*

#### `GET` /api/dentists/{dentist_id}/availability
- **Summary**: Discover approved dentist's active availability windows
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `bounded_list`
- **Path Parameters**:
  - `dentist_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `DentistAvailabilityListResponse`
  - Top-Level Fields:
    - `items` (List[DentistAvailabilityResponse])
    - `total` (integer)

### 5.8 Notifications Module (5 Operations)

#### `GET` /api/notifications
- **Summary**: List notifications for current user
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `Any active user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: User lists only own notifications | None
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `offset_based (limit, offset)`
- **Query Parameters**:
  - `is_read` (string): default=None, required=False
  - `limit` (integer): default=50, required=False
  - `offset` (integer): default=0, required=False
- **Request Body**: `none`
- **Response Model**: `NotificationListResponse`
  - Top-Level Fields:
    - `items` (List[NotificationResponse])
    - `total` (integer)
    - `limit` (integer)
    - `offset` (integer)
    - `unread_count` (integer)

#### `PATCH` /api/notifications/read-all
- **Summary**: Mark all unread notifications as read
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `NotificationReadAllResponse`
  - Top-Level Fields:
    - `marked_read_count` (integer)

#### `GET` /api/notifications/unread-count
- **Summary**: Get unread notification count
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `NotificationUnreadCountResponse`
  - Top-Level Fields:
    - `unread_count` (integer)

#### `GET` /api/notifications/{id}
- **Summary**: Get notification by ID
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `NotificationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `user_id` (string)
    - `notification_type` (string)
    - `title` (string)
    - `message` (string)
    - `action_url` (string | null)
    - `is_read` (boolean)
    - `read_at` (string | null)
    - *(and 1 more fields)*

#### `PATCH` /api/notifications/{id}/read
- **Summary**: Mark notification as read
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `NotificationResponse`
  - Top-Level Fields:
    - `id` (string)
    - `user_id` (string)
    - `notification_type` (string)
    - `title` (string)
    - `message` (string)
    - `action_url` (string | null)
    - `is_read` (boolean)
    - `read_at` (string | null)
    - *(and 1 more fields)*

### 5.9 Patients Module (5 Operations)

#### `GET` /api/patients/me
- **Summary**: Get My Patient Profile
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `PatientResponse`
  - Top-Level Fields:
    - `id` (string)
    - `user_id` (string)
    - `email` (string)
    - `first_name` (string)
    - `last_name` (string)
    - `phone_number` (string | null)
    - `avatar_url` (string | null)
    - `date_of_birth` (string | null)
    - *(and 7 more fields)*

#### `PATCH` /api/patients/me
- **Summary**: Update My Patient Profile
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Request Body**: `PatientUpdate` (Content-Type: `application/json`)
  - Fields:
    - `date_of_birth` (string | null): required=False, default=None
    - `gender` (string | null): required=False, default=None
    - `emergency_contact_name` (string | null): required=False, default=None
    - `emergency_contact_phone` (string | null): required=False, default=None
    - `address` (string | null): required=False, default=None
    - `first_name` (string | null): required=False, default=None
    - `last_name` (string | null): required=False, default=None
    - `phone_number` (string | null): required=False, default=None
    - `avatar_url` (string | null): required=False, default=None
- **Response Model**: `PatientResponse`
  - Top-Level Fields:
    - `id` (string)
    - `user_id` (string)
    - `email` (string)
    - `first_name` (string)
    - `last_name` (string)
    - `phone_number` (string | null)
    - `avatar_url` (string | null)
    - `date_of_birth` (string | null)
    - *(and 7 more fields)*

#### `GET` /api/patients/me/medical-profile
- **Summary**: Get My Medical Profile
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `PatientMedicalProfileResponse`
  - Top-Level Fields:
    - `medical_history` (array)
    - `dental_history` (array)
    - `allergies` (array)
    - `current_medications` (array)
    - `smoking_status` (string | null)
    - `alcohol_consumption` (string | null)
    - `betel_quid_user` (boolean)
    - `additional_notes` (string | null)
    - *(and 4 more fields)*

#### `PATCH` /api/patients/me/medical-profile
- **Summary**: Update My Medical Profile
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Request Body**: `PatientMedicalProfileUpdate` (Content-Type: `application/json`)
  - Fields:
    - `medical_history` (array | null): required=False, default=None
    - `dental_history` (array | null): required=False, default=None
    - `allergies` (array | null): required=False, default=None
    - `current_medications` (array | null): required=False, default=None
    - `smoking_status` (string | null): required=False, default=None
    - `alcohol_consumption` (string | null): required=False, default=None
    - `betel_quid_user` (boolean | null): required=False, default=None
    - `additional_notes` (string | null): required=False, default=None
- **Response Model**: `PatientMedicalProfileResponse`
  - Top-Level Fields:
    - `medical_history` (array)
    - `dental_history` (array)
    - `allergies` (array)
    - `current_medications` (array)
    - `smoking_status` (string | null)
    - `alcohol_consumption` (string | null)
    - `betel_quid_user` (boolean)
    - `additional_notes` (string | null)
    - *(and 4 more fields)*

#### `POST` /api/patients/me/medical-profile
- **Summary**: Create My Medical Profile
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Request Body**: `PatientMedicalProfileCreate` (Content-Type: `application/json`)
  - Fields:
    - `medical_history` (array): required=False, default=None
    - `dental_history` (array): required=False, default=None
    - `allergies` (array): required=False, default=None
    - `current_medications` (array): required=False, default=None
    - `smoking_status` (string | null): required=False, default=never
    - `alcohol_consumption` (string | null): required=False, default=none
    - `betel_quid_user` (boolean): required=False, default=False
    - `additional_notes` (string | null): required=False, default=None
- **Response Model**: `PatientMedicalProfileResponse`
  - Top-Level Fields:
    - `medical_history` (array)
    - `dental_history` (array)
    - `allergies` (array)
    - `current_medications` (array)
    - `smoking_status` (string | null)
    - `alcohol_consumption` (string | null)
    - `betel_quid_user` (boolean)
    - `additional_notes` (string | null)
    - *(and 4 more fields)*

### 5.10 Reports Module (2 Operations)

#### `GET` /api/reports/{report_id}
- **Summary**: Get clinical report by ID
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `report_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ReportResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `report_number` (string)
    - `generated_by_id` (string | null)
    - `report_title` (string)
    - `summary` (string | null)
    - `report_data` (object)
    - `pdf_storage_path` (string | null)
    - *(and 2 more fields)*

#### `GET` /api/reports/{report_id}/download
- **Summary**: Download clinical report PDF
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `patient / treating dentist / admin`)
- **Rate Limit Scope**: `report_ops`
- **Ownership / Relationship Rules**: Caller must have verified report access | PatientDentistRelationship required if dentist
- **Side Effects**: Rate limited via 'report_ops' scope (15 req / 60s)
- **Notifications**: None
- **Idempotency**: Idempotent download stream
- **Pagination Convention**: `None`
- **Path Parameters**:
  - `report_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `dict/binary`

### 5.11 Screenings Module (17 Operations)

#### `GET` /api/screenings
- **Summary**: List patient's screenings
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Patient lists only own non-deleted screenings | None
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `page_based (page, page_size)`
- **Query Parameters**:
  - `page` (integer): default=1, required=False
  - `page_size` (integer): default=20, required=False
- **Request Body**: `none`
- **Response Model**: `ScreeningListResponse`
  - Top-Level Fields:
    - `items` (List[ScreeningResponse])
    - `total` (integer)
    - `page` (integer)
    - `page_size` (integer)

#### `POST` /api/screenings
- **Summary**: Create a new screening session
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Screening belongs to authenticated patient | None at creation
- **Side Effects**: Creates screening record in 'pending' status
- **Notifications**: None
- **Idempotency**: Non-idempotent (creates new screening per call)
- **Pagination Convention**: `None`
- **Request Body**: `ScreeningCreate` (Content-Type: `application/json`)
  - Fields:
    - `clinical_notes` (string | null): required=False, default=None
- **Response Model**: `ScreeningResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `created_by_id` (string)
    - `status` (string)
    - `clinical_notes` (string | null)
    - `error_message` (string | null)
    - `is_deleted` (boolean)
    - `created_at` (string)
    - *(and 1 more fields)*

#### `DELETE` /api/screenings/{screening_id}
- **Summary**: Soft-delete a screening
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ScreeningDeleteResponse`
  - Top-Level Fields:
    - `success` (boolean)
    - `message` (string)
    - `screening_id` (string)

#### `GET` /api/screenings/{screening_id}
- **Summary**: Get screening details with images
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ScreeningDetailResponse`
  - Top-Level Fields:
    - `id` (string)
    - `patient_id` (string)
    - `created_by_id` (string)
    - `status` (string)
    - `clinical_notes` (string | null)
    - `error_message` (string | null)
    - `is_deleted` (boolean)
    - `created_at` (string)
    - *(and 2 more fields)*

#### `GET` /api/screenings/{screening_id}/assessment
- **Summary**: Get clinical dentist assessment for a screening
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `DentistAssessmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `dentist_id` (string)
    - `clinical_observations` (string)
    - `diagnosis_notes` (string)
    - `treatment_recommendation` (string)
    - `referral_needed` (boolean)
    - `referral_specialty` (string | null)
    - *(and 7 more fields)*

#### `PATCH` /api/screenings/{screening_id}/assessment
- **Summary**: Update or finalize an existing dentist assessment draft
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `DentistAssessmentUpdate` (Content-Type: `application/json`)
  - Fields:
    - `clinical_observations` (string | null): required=False, default=None
    - `diagnosis_notes` (string | null): required=False, default=None
    - `treatment_recommendation` (string | null): required=False, default=None
    - `referral_needed` (boolean | null): required=False, default=None
    - `referral_specialty` (string | null): required=False, default=None
    - `is_finalized` (boolean | null): required=False, default=None
- **Response Model**: `DentistAssessmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `dentist_id` (string)
    - `clinical_observations` (string)
    - `diagnosis_notes` (string)
    - `treatment_recommendation` (string)
    - `referral_needed` (boolean)
    - `referral_specialty` (string | null)
    - *(and 7 more fields)*

#### `POST` /api/screenings/{screening_id}/assessment
- **Summary**: Create licensed dentist clinical assessment
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `DentistAssessmentCreate` (Content-Type: `application/json`)
  - Fields:
    - `clinical_observations` (string): required=True, default=None
    - `diagnosis_notes` (string): required=True, default=None
    - `treatment_recommendation` (string): required=True, default=None
    - `referral_needed` (boolean): required=False, default=False
    - `referral_specialty` (string | null): required=False, default=None
    - `is_finalized` (boolean): required=False, default=False
- **Response Model**: `DentistAssessmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `dentist_id` (string)
    - `clinical_observations` (string)
    - `diagnosis_notes` (string)
    - `treatment_recommendation` (string)
    - `referral_needed` (boolean)
    - `referral_specialty` (string | null)
    - *(and 7 more fields)*

#### `POST` /api/screenings/{screening_id}/images
- **Summary**: Upload an oral screening image
- **Primary Declared Success Status**: `201`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Patient must own target screening | None
- **Side Effects**: Validates magic bytes, uploads to Firebase Storage at screenings/{patient_id}/{screening_id}/{safe_uuid}.ext, persists ScreeningImage, transitions screening status to 'uploading'
- **Notifications**: None
- **Idempotency**: Non-idempotent (each file upload creates a new ScreeningImage)
- **Pagination Convention**: `None`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Query Parameters**:
  - `is_primary` (boolean): default=True, required=False
- **Request Body**: `Body_upload_screening_image_api_screenings__screening_id__images_post` (Content-Type: `multipart/form-data`)
  - Fields:
    - `file` (string): required=True, default=None
- **Response Model**: `ScreeningImageResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `storage_path` (string)
    - `file_name` (string)
    - `file_size_bytes` (integer)
    - `mime_type` (string)
    - `image_width` (integer | null)
    - `image_height` (integer | null)
    - *(and 3 more fields)*

#### `GET` /api/screenings/{screening_id}/report
- **Summary**: Get clinical report for a screening
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ReportResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `report_number` (string)
    - `generated_by_id` (string | null)
    - `report_title` (string)
    - `summary` (string | null)
    - `report_data` (object)
    - `pdf_storage_path` (string | null)
    - *(and 2 more fields)*

#### `POST` /api/screenings/{screening_id}/report
- **Summary**: Generate clinical report and PDF document for a screening
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `patient / treating dentist / admin`)
- **Rate Limit Scope**: `report_ops`
- **Ownership / Relationship Rules**: User must have verified screening access | PatientDentistRelationship required if dentist
- **Side Effects**: Compiles ReportLab PDF, uploads to reports/{patient_id}/{screening_id}/{safe_report_num}.pdf, persists Report record
- **Notifications**: None
- **Idempotency**: Idempotent (returns existing report if already compiled)
- **Pagination Convention**: `None`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `Request` (Content-Type: `application/json`)
- **Response Model**: `ReportResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `report_number` (string)
    - `generated_by_id` (string | null)
    - `report_title` (string)
    - `summary` (string | null)
    - `report_data` (object)
    - `pdf_storage_path` (string | null)
    - *(and 2 more fields)*

#### `GET` /api/screenings/{screening_id}/review
- **Summary**: Review complete multi-modal screening findings for professional clinical evaluation
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ScreeningReviewResponse`
  - Top-Level Fields:
    - `screening_id` (string)
    - `patient_id` (string)
    - `patient_name` (string)
    - `patient_age` (integer | null)
    - `patient_gender` (string | null)
    - `patient_notes` (string | null)
    - `screening_status` (string)
    - `screening_created_at` (string)
    - *(and 7 more fields)*

#### `GET` /api/screenings/{screening_id}/risk-assessment
- **Summary**: Get existing clinical risk assessment for a screening session
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `RiskAssessmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `ai_prediction_id` (string | null)
    - `risk_level` (string)
    - `risk_score` (number)
    - `contributing_factors` (List[ContributingFactorItem])
    - `summary` (string)
    - `recommended_action` (string)
    - *(and 3 more fields)*

#### `POST` /api/screenings/{screening_id}/risk-assessment
- **Summary**: Generate or retrieve screening risk assessment and triage priority
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_active_user` (Role: `active_user`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `Request` (Content-Type: `application/json`)
- **Response Model**: `RiskAssessmentResponse`
  - Top-Level Fields:
    - `id` (string)
    - `screening_id` (string)
    - `ai_prediction_id` (string | null)
    - `risk_level` (string)
    - `risk_score` (number)
    - `contributing_factors` (List[ContributingFactorItem])
    - `summary` (string)
    - `recommended_action` (string)
    - *(and 3 more fields)*

#### `POST` /api/screenings/{screening_id}/run-ai
- **Summary**: Execute AI inference on screening images
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Patient must own target screening | None
- **Side Effects**: Executes YOLOv8 detection + EfficientNetB0 classification synchronously, persists AIPrediction, PredictionProbability, YOLODetection, transitions screening status to 'completed' (or 'failed' on error)
- **Notifications**: Dispatches 'screening_completed' or 'screening_failed' notification to patient
- **Idempotency**: Idempotent when force_recompute=False (returns cached inference)
- **Pagination Convention**: `None`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Query Parameters**:
  - `force_recompute` (boolean): default=False, required=False
- **Request Body**: `none`
- **Response Model**: `ScreeningInferenceResponse`
  - Top-Level Fields:
    - `screening_id` (string)
    - `status` (string)
    - `total_images_processed` (integer)
    - `results` (List[ImageInferenceResult])

#### `GET` /api/screenings/{screening_id}/xai
- **Summary**: Get XAI visual explanation results for a screening
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `none`
- **Response Model**: `ScreeningXAIResponse`
  - Top-Level Fields:
    - `screening_id` (string)
    - `total_results` (integer)
    - `results` (List[XAIResultResponse])

#### `POST` /api/screenings/{screening_id}/xai
- **Summary**: Generate XAI visual explanation heatmaps for a screening
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
- **Request Body**: `Request` (Content-Type: `application/json`)
- **Response Model**: `ScreeningXAIResponse`
  - Top-Level Fields:
    - `screening_id` (string)
    - `total_results` (integer)
    - `results` (List[XAIResultResponse])

#### `POST` /api/screenings/{screening_id}/xai/{method}
- **Summary**: Generate a specific XAI visual explanation method
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `ai_run`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: State update
- **Pagination Convention**: `none`
- **Path Parameters**:
  - `screening_id` (string): required=True
  - `method` (string): required=True
- **Query Parameters**:
  - `force_recompute` (boolean): default=False, required=False
- **Request Body**: `none`
- **Response Model**: `ScreeningXAIResponse`
  - Top-Level Fields:
    - `screening_id` (string)
    - `total_results` (integer)
    - `results` (List[XAIResultResponse])

### 5.12 Users Module (4 Operations)

#### `GET` /api/users/me
- **Summary**: Get My User Profile
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `get_current_user` (Role: `Any (including deactivated accounts)`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: User inspects own account record | None
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `None`
- **Request Body**: `none`
- **Response Model**: `UserResponse`
  - Top-Level Fields:
    - `id` (string)
    - `firebase_uid` (string)
    - `email` (string)
    - `role` (string)
    - `first_name` (string)
    - `last_name` (string)
    - `phone_number` (string | null)
    - `avatar_url` (string | null)
    - *(and 4 more fields)*

#### `GET` /api/users/me/admin-access
- **Summary**: Verify Admin Access
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_admin` (Role: `admin`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `RoleAccessResponse`
  - Top-Level Fields:
    - `access` (string)
    - `role` (string)
    - `user_id` (string)

#### `GET` /api/users/me/dentist-access
- **Summary**: Verify Dentist Access
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_dentist` (Role: `dentist`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `RoleAccessResponse`
  - Top-Level Fields:
    - `access` (string)
    - `role` (string)
    - `user_id` (string)

#### `GET` /api/users/me/patient-access
- **Summary**: Verify Patient Access
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `require_patient` (Role: `patient`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Enforced by ownership / service logic | Subject to domain relationship check
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `RoleAccessResponse`
  - Top-Level Fields:
    - `access` (string)
    - `role` (string)
    - `user_id` (string)

### 5.13 XAI Module (1 Operations)

#### `GET` /api/xai/methods
- **Summary**: List available XAI explanation algorithms
- **Primary Declared Success Status**: `200`
- **Auth Dependency**: `None (Public)` (Role: `None (Public)`)
- **Rate Limit Scope**: `None`
- **Ownership / Relationship Rules**: Public | None required
- **Side Effects**: None
- **Notifications**: None
- **Idempotency**: Idempotent read
- **Pagination Convention**: `none`
- **Request Body**: `none`
- **Response Model**: `XAIAvailableMethodsResponse`
  - Top-Level Fields:
    - `primary_methods` (array)
    - `secondary_methods` (array)
    - `methods` (List[XAIMethodInfo])
