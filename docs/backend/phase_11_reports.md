# OraVisionAI — Phase 11: Clinical Report Generation Subsystem

## 1. Overview & Architecture

Phase 11 implements the **Clinical Report Generation Subsystem** for the OraVisionAI backend. Operating as a consolidated historical presentation and diagnostic record layer, the subsystem compiles screening metadata, multi-image findings, 7-class deep learning predictions, spatial lesion bounding boxes, Explainable AI visual heatmaps, multi-factor risk scores, and professional dentist clinical assessments into an immutable frozen JSON snapshot and publication-grade PDF document.

```
Screening Session (PostgreSQL screenings)
  ├── Uploaded Oral Photographs (screening_images)
  ├── 7-Class AI Predictions (ai_predictions & prediction_probabilities)
  ├── Spatial YOLO Detections (yolo_detections)
  ├── Visual XAI Explanations (xai_results)
  ├── Clinical Risk Tier (risk_assessments)
  └── Licensed Dentist Review (dentist_assessments)
                 │
                 ▼
ReportService.build_report_snapshot(...)
                 │
                 ▼
Frozen Diagnostic JSON Snapshot (`report_data` in PostgreSQL `reports`)
                 │
                 ▼
PDFReportRenderer.render_pdf(snapshot) [ReportLab Engine]
                 │
                 ▼
Firebase Storage Upload (`reports/{patient_id}/{screening_id}/{report_number}.pdf`)
                 │
                 ▼
PostgreSQL Transaction Persistence (`reports` table record)
                 │
                 ▼
Immutable Audit Log Entry (`REPORT_GENERATED` in `audit_logs`)
```

---

## 2. Clinical Safety & Medical Terminology Principles

1. **Assistive Screening vs. Diagnosis**:
   - The AI output is explicitly communicated as an *assistive screening finding* and *model prediction*, never as a definitive medical diagnosis.
   - Clinical disclaimer prominently highlighted at the top of every generated PDF:
     > *"This AI-generated screening report provides assistive diagnostic recommendations based on deep learning analysis. It does NOT constitute a definitive medical diagnosis and must be evaluated by a licensed dental professional."*
2. **Separation of Concerns**:
   - `ai_predictions` remain immutable historical machine learning predictions.
   - `dentist_assessments` are maintained in a separate clinical entity and rendered as licensed professional evaluations.

---

## 3. Report Contents & Snapshot Schema

The frozen diagnostic snapshot (`report_data` JSONB) contains:

| Section | Key | Contents |
|---|---|---|
| **Header Metadata** | `report_number`, `screening_date`, `screening_status` | Unique format `RPT-YYYYMMDD-XXXXXX`, UTC timestamps, lifecycle status |
| **Patient Profile** | `patient` | Name, Date of Birth, Gender, Patient ID (sanitized of sensitive auth tokens) |
| **Screening Info** | `screening`, `total_images` | Screening ID, patient clinical symptom notes, total oral photographs |
| **AI Classification** | `primary_prediction` | Predicted class name, confidence %, inference duration, model name/version, and full 7-class probability breakdown |
| **Spatial Detections** | `detections` | YOLO lesion bounding boxes `[x_min, y_min, x_max, y_max]` normalized to `[0.0, 1.0]` and confidence scores |
| **XAI Explanations** | `xai_results` | Primary (Occlusion Sensitivity, Grad-CAM) and Secondary (Grad-CAM++, LayerCAM, Score-CAM, Integrated Gradients) references |
| **Risk Assessment** | `risk_assessment` | Multi-factor risk level (`low`, `moderate`, `high`, `critical`), risk score `0..100`, and triage action (or `None` if pending) |
| **Dentist Assessment** | `dentist_assessments` | Professional observations, clinical diagnosis notes, treatment plan, specialist referral flags |

---

## 4. PDF Generation Architecture (ReportLab)

Implemented in [`backend/app/services/pdf_report_renderer.py`](file:///c:/Users/hp/Desktop/OravisionAI/backend/app/services/pdf_report_renderer.py):
- **Engine**: ReportLab `SimpleDocTemplate`, `Table`, `Paragraph`, `HRFlowable`.
- **Dimensions**: Letter size with standardized margins (36 pt / 0.5 in).
- **Typography & Styling**: Clean clinical hierarchy with high contrast, semantic alert boxes (Crimson for warnings, Slate/Teal for diagnostic tables), and Unicode-safe confidence bars.
- **Output**: Generates standard binary `%PDF-1.4` stream without browser automation or external headless runtimes.

---

## 5. Storage Architecture & Path Strategy

PDF documents are uploaded to Firebase Storage via `StorageService.upload_report_pdf(...)`:
- **Deterministic Storage Path**:
  ```
  reports/{patient_id}/{screening_id}/{report_number}.pdf
  ```
- **Database Storage**: Only the relative storage path URI is persisted in `reports.pdf_storage_path`. Zero binary blob data is written to PostgreSQL.

---

## 6. Multi-Role Authorization & Access Control

Access to report generation, retrieval, and PDF downloads is governed by `ReportService.verify_user_report_access`:

| Role | Access Level | Authorization Rule |
|---|---|---|
| **Patient** | Self-Service | `Screening.patient_id == current_patient.id`. Cross-patient requests are blocked with `403 Forbidden` / `404 Not Found`. |
| **Dentist** | Treating Clinician | Must have an active `PatientDentistRelationship` (`status == 'active'`) with the patient. Unauthorized dentists receive `403 Forbidden`. |
| **Admin** | Oversight | Administrative oversight access with mandatory compliance audit logging. |

---

## 7. Idempotency & Duplicate Prevention

- Calling `POST /api/screenings/{screening_id}/report` with default `force_regenerate=False`:
  - Detects if an existing `Report` record exists for the screening.
  - Reuses and returns the existing report and PDF path with **zero duplicate database insertions**.
- Setting `force_regenerate=True` enables explicit recalculation of snapshot data, PDF re-rendering, and database record update.

---

## 8. Immutable Audit Logging

Every clinical report event is captured in `audit_logs`:
- `REPORT_GENERATED`: Captures report creation/recalculation, report number, screening ID, and patient ID.
- `REPORT_VIEWED`: Logs every report inspection event by patients, dentists, or administrators.
- `REPORT_DOWNLOADED`: Logs every PDF binary download request.

---

## 9. API Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/screenings/{screening_id}/report` | `get_current_user` (Patient / Treating Dentist / Admin) | Generates or returns existing clinical report and PDF document |
| `GET` | `/api/screenings/{screening_id}/report` | `get_current_user` (Patient / Treating Dentist / Admin) | Retrieves clinical report for screening session |
| `GET` | `/api/reports/{report_id}` | `get_current_user` (Patient / Treating Dentist / Admin) | Retrieves detailed report record by report UUID |
| `GET` | `/api/reports/{report_id}/download` | `get_current_user` (Patient / Treating Dentist / Admin) | Secure binary download of clinical PDF document |
