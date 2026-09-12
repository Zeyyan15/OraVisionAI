# OraVisionAI — Phase 18: Platform Administration, Audit Oversight & Clinical Analytics

**Status**: Implemented, Verified, Zero Regressions (Phases 3B–18: 100% PASS)  
**Database Schema**: Exactly 23 Tables Preserved (0 New Migrations, 0 Model Modifications)  
**Security Tier**: Strict Administrator Role Enforcement (`require_admin`)  

---

## 1. Executive Summary & Objective

Phase 18 completes the administrative oversight, compliance auditing, operational observability, and clinical workflow intelligence layer of the **OraVisionAI** platform. It implements eight read-only administrative endpoints under `/api/admin` that leverage the existing PostgreSQL schema and data structures without modifying underlying clinical or domain records.

### Core Architecture & Guarantees
- **Pure Administrative Inspection**: All eight Phase 18 endpoints are strictly read-only with respect to underlying domain records. Zero mutation endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) exist for analytics, audit logs, or AI models.
- **Strict Multi-Role Boundary**: Every endpoint enforces [`require_admin`](file:///c:/Users/hp/Desktop/OravisionAI/backend/app/core/auth.py#L160). Unauthenticated requests return `401 Unauthorized`. Authenticated patients and dentists are strictly rejected with `403 Forbidden`. Deactivated administrators follow standard account suspension rules (`403 Forbidden`).
- **Screening-Anchored Temporal Cohort**: For `GET /api/admin/analytics/screenings`, the analytics population is defined strictly by the creation timestamp of non-deleted screenings (`Screening.is_deleted == False` within `[start_date, end_date]`). All associated metrics (status breakdown, risk distribution, dentist assessment counts, and generated reports) are joined directly to this anchored screening cohort via `screening_id`.
- **Authoritative 7-Class AI Taxonomy**: `GET /api/admin/analytics/ai-telemetry` reports operational inference distributions strictly mapped to the authoritative Phase 9B taxonomy:
  - `CaS` — Canker Sore
  - `CoS` — Cold Sore
  - `Gum` — Gum Disease
  - `MC` — Mucocele
  - `OC` — Oral Cancer
  - `OLP` — Oral Lichen Planus
  - `OT` — Oral Thrush
  Any class with zero historical predictions is explicitly represented with `count = 0` and `percentage = 0.0`.
- **Non-Clinical Interpretation Guarantee**: Operational AI telemetry confidence is explicitly reported as *average prediction confidence*, NOT diagnostic accuracy, precision, recall, or clinical efficacy. Risk level distributions are reported as platform-level risk assessment categorizations, NOT disease prevalence or disease probability.
- **Deterministic Self-Auditing**: When an administrator queries the audit trail (`GET /api/admin/audit-logs`), the result snapshot is computed prior to committing the access event (`AUDIT_LOGS_VIEWED`), guaranteeing that self-auditing does not alter pagination counts or shift item offsets.
- **Response-Layer Privacy Redaction**: Passwords, tokens, private keys, authorization headers, and secrets are recursively masked as `[REDACTED]` at the serialization layer. Historical database audit logs remain untouched.
- **AI Model Registry Privacy**: The `ai_models` catalog endpoints expose architectural metadata while strictly concealing `weights_path` and private filesystem paths.

---

## 2. API Endpoints

All endpoints are hosted under `/api/admin` and require an active administrator account.

| HTTP Method | Path | Summary | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/audit-logs` | List Audit Logs | Paginated, filtered inspection of the append-only audit trail ordered newest-first (`timestamp DESC, id DESC`). Supports `user_id`, `action`, `resource_type`, `start_date`, `end_date`, `page`, and `page_size`. |
| `GET` | `/api/admin/audit-logs/{audit_log_id}` | Get Audit Log Detail | Inspect a specific audit log record with recursive response-level credential redaction. Returns `404` if not found. |
| `GET` | `/api/admin/analytics/overview` | Platform Overview Analytics | Global operational KPIs: user counts by role/status, dentist verification breakdown, non-deleted screening statuses, appointment/consultation totals, communication counts, and audit log totals. |
| `GET` | `/api/admin/analytics/screenings` | Screening Workflow Analytics | Aggregate screening metrics strictly anchored to non-deleted screenings created within `[start_date, end_date]`. Returns screening statuses, 4-level risk distribution, dentist assessment counts (total, finalized, draft), and report counts. |
| `GET` | `/api/admin/analytics/ai-telemetry` | AI Inference Telemetry | Operational AI telemetry: total predictions, 7-class distribution (with zero-count preservation), mean prediction confidence, YOLO lesion detection counts, average detections per image, XAI generation counts, and active model summaries. |
| `GET` | `/api/admin/analytics/telehealth` | Telehealth Analytics | Operational appointment and consultation metrics: all 7 appointment statuses, cancellation rate, all 4 consultation statuses, cumulative ended consultation duration, and average ended duration. |
| `GET` | `/api/admin/ai-models` | List Registered AI Models | Read-only listing of all registered versioned AIModel entities. Excludes private filesystem paths. |
| `GET` | `/api/admin/ai-models/{model_id}` | Get AI Model Detail | Detailed architectural metadata for a specific registered AI model. Excludes private filesystem paths. Returns `404` if not found. |

---

## 3. Authoritative Domain Taxonomies

### A. 7-Class AI Condition Taxonomy (Phase 9B)
The AI telemetry endpoint adheres strictly to the 7-class dataset taxonomy:
1. `CaS`: Canker Sore
2. `CoS`: Cold Sore
3. `Gum`: Gum Disease
4. `MC`: Mucocele
5. `OC`: Oral Cancer
6. `OLP`: Oral Lichen Planus
7. `OT`: Oral Thrush

### B. Risk Assessment Taxonomy (Phase 12)
Clinical screening analytics report exact Phase 12 risk levels:
1. `low`: Routine preventive dental monitoring.
2. `moderate`: Non-urgent clinical follow-up advised.
3. `high`: Priority clinical dental consultation recommended.
4. `critical`: Urgent clinical assessment indicated.

### C. Appointment Status Taxonomy (Phase 14)
All seven Phase 14 appointment statuses are tracked:
`requested`, `confirmed`, `in_progress`, `completed`, `cancelled`, `rescheduled`, `no_show`.

### D. Consultation Status Taxonomy (Phase 15)
All four Phase 15 teleconsultation session statuses are tracked:
`scheduled`, `active`, `ended`, `failed`.
*(Note: Appointments transition to `completed`; consultations transition to `ended`).*

### E. Screening Lifecycle Status Taxonomy (Phase 9A)
All five Phase 9A screening lifecycle statuses are tracked:
`pending`, `uploading`, `processing`, `completed`, `failed`.
*(Note: Soft-deleted screenings with `is_deleted == True` are strictly excluded).*

---

## 4. Screening-Anchored Cohort Query Architecture

To prevent erroneous cross-population metrics, `GET /api/admin/analytics/screenings` anchors all related entities to the non-deleted screening cohort:

```sql
-- 1. Anchored Screening Cohort Subquery
WITH cohort AS (
    SELECT id FROM screenings
    WHERE is_deleted = FALSE
      AND (:start_date IS NULL OR created_at >= :start_date)
      AND (:end_date IS NULL OR created_at <= :end_date)
)
-- 2. Status Breakdown
SELECT status, COUNT(id) FROM screenings WHERE id IN (SELECT id FROM cohort) GROUP BY status;

-- 3. Cohort-Anchored Risk Distribution
SELECT risk_level, COUNT(id) FROM risk_assessments WHERE screening_id IN (SELECT id FROM cohort) GROUP BY risk_level;

-- 4. Cohort-Anchored Dentist Assessments
SELECT COUNT(id),
       COALESCE(SUM(CASE WHEN is_finalized = TRUE THEN 1 ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN is_finalized = FALSE THEN 1 ELSE 0 END), 0)
FROM dentist_assessments WHERE screening_id IN (SELECT id FROM cohort);

-- 5. Cohort-Anchored Clinical Reports
SELECT COUNT(id) FROM reports WHERE screening_id IN (SELECT id FROM cohort);
```

---

## 5. Security, Privacy & Redaction

### Administrative Access Auditing
Inspecting administrative endpoints produces append-only audit entries in `audit_logs`:
- `AUDIT_LOGS_VIEWED`: Query filters and pagination recorded.
- `AUDIT_LOG_DETAIL_VIEWED`: Target log ID recorded.
- `PLATFORM_ANALYTICS_VIEWED`: Platform overview access.
- `CLINICAL_ANALYTICS_VIEWED`: Date filter bounds recorded.
- `AI_ANALYTICS_VIEWED`: AI telemetry access.
- `TELEHEALTH_ANALYTICS_VIEWED`: Telehealth analytics access.
- `AI_MODELS_CATALOG_VIEWED`: Model catalog inspection.

### Privacy Redaction
Audit log details undergo recursive redaction before transmission:
- Any dictionary key matching `password`, `token`, `firebase_token`, `authorization`, `secret`, `private_key`, `access_token`, or `refresh_token` is sanitized to `"[REDACTED]"`.
- Raw clinical image byte arrays and direct message contents are omitted.

---

## 6. Database Schema Integrity

- **Tables**: Exactly 23 tables maintained in `Base.metadata`.
- **Migrations**: Zero new Alembic migrations generated.
- **Models**: Zero database models modified.
- **Frozen Modules**: Phases 3B through 17 remain completely functional and untouched.

---

## 7. Non-Clinical Interpretation & Regulatory Scope

1. **AI Telemetry is NOT Validation**: Prediction confidence reflects softmax probability output and must not be described as accuracy, sensitivity, or clinical specificity.
2. **Operational Telehealth is NOT Clinical Outcome**: Appointment cancellation rate is an operational scheduling metric, not a clinical treatment failure.
3. **Risk Distributions are NOT Epidemiological Prevalence**: Aggregate risk levels represent triage flags from the deterministic clinical context engine, not population disease prevalence.
4. **Privacy-Oriented Design is NOT Regulatory Certification**: Administrative auditability and role-based access control provide traceability without claiming statutory HIPAA certification.
