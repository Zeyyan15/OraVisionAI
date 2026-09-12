# OraVisionAI — Phase 13: Dentist Assessment Module

**Authoritative Technical Documentation**  
**Phase Baseline**: Phase 13 Complete and Verified  
**Schema Drift**: Zero (Preserves exactly 23 tables in `Base.metadata`)  

---

## 1. Purpose

The **Dentist Assessment Module** provides licensed dental practitioners with an independent clinical evaluation workbench. It allows verified dentists to:
- Review multi-modal oral screening findings: patient demographic context, uploaded high-resolution oral photographs, 7-class EfficientNetB0 classification with complete probability distributions, spatial YOLO lesion bounding boxes, Explainable AI (XAI) visual explanation heatmaps, and Clinical Context / Risk Assessment triage priorities.
- Record formal clinical observations, preliminary diagnosis notes, treatment recommendations, and urgent specialist referral indications.
- Manage a medical-legal draft versus finalized assessment lifecycle, where draft assessments can be revised, but finalized assessments are permanently locked against modifications.
- Seamlessly integrate licensed dentist findings into the medical-grade clinical report (`ReportService` / `PDFReportRenderer`) as an independent professional section clearly demarcated from automated AI predictions.
- Maintain tamper-evident compliance audit logging for every assessment creation, view, and update event.

---

## 2. Existing Schema Used

Phase 13 introduces **zero schema changes** and creates **no new migrations**. It leverages the already-approved relational model defined in [`backend/app/models/dentist_assessment.py`](file:///c:/Users/hp/Desktop/OravisionAI/backend/app/models/dentist_assessment.py):

```sql
CREATE TABLE dentist_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screening_id UUID NOT NULL REFERENCES screenings(id) ON DELETE CASCADE,
    dentist_id UUID NOT NULL REFERENCES dentists(id) ON DELETE RESTRICT,
    clinical_observations TEXT NOT NULL,
    diagnosis_notes TEXT NOT NULL,
    treatment_recommendation TEXT NOT NULL,
    referral_needed BOOLEAN NOT NULL DEFAULT FALSE,
    referral_specialty VARCHAR(150),
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dentist_assessments_screening ON dentist_assessments(screening_id);
CREATE INDEX idx_dentist_assessments_dentist ON dentist_assessments(dentist_id);
```

### Key Schema Characteristics
- **`ON DELETE CASCADE` on `screening_id`**: An assessment is bound to its screening session lifecycle.
- **`ON DELETE RESTRICT` on `dentist_id`**: A dentist record cannot be deleted while active clinical assessments exist, preserving the integrity of patient diagnostic histories.
- **`is_finalized` & `finalized_at`**: State variables governing the legal lock on clinical opinions.

---

## 3. Workflow

```
1. Patient Screening Completed
   (Photographs Captured -> EfficientNet Inference -> YOLO Detection -> XAI Heatmaps -> Risk Triage)
                               │
                               ▼
2. Verified Dentist Reviews Findings
   GET /api/screenings/{screening_id}/review
   ├── Validates Dentist Verification ('approved')
   ├── Validates Active Relationship (PatientDentistRelationship.status == 'active')
   └── Aggregates Patient Metadata, Images, AI Inferences, YOLO Boxes, XAI Heatmaps, Risk Tier
                               │
                               ▼
3. Dentist Submits Professional Assessment
   POST /api/screenings/{screening_id}/assessment
   ├── Body: clinical_observations, diagnosis_notes, treatment_recommendation, referral_needed, is_finalized
   ├── Validates non-empty clinical text
   ├── Rejects duplicate assessments (Use PATCH to revise drafts)
   ├── Stamps finalized_at if is_finalized=True
   └── Logs Audit Event: DENTIST_ASSESSMENT_CREATED
                               │
                               ▼
4. Optional: Dentist Revises Draft Assessment
   PATCH /api/screenings/{screening_id}/assessment
   ├── Rejects with 409 CONFLICT if is_finalized == True (Permanently Locked)
   ├── Applies non-null updates (clinical observations, recommendations, etc.)
   ├── If is_finalized=True -> Locks assessment and records finalized_at
   └── Logs Audit Event: DENTIST_ASSESSMENT_UPDATED
                               │
                               ▼
5. Retrieval & Diagnostic Archiving
   GET /api/screenings/{screening_id}/assessment
   ├── Accessible by: Patient Owner, Authorized Treating Dentist, Admin
   └── Logs Audit Event: DENTIST_ASSESSMENT_VIEWED
                               │
                               ▼
6. Clinical Report Generation (Phase 11 Integration)
   POST /api/screenings/{screening_id}/report (force_regenerate=True)
   └── Frozen JSON snapshot & PDF Section 6 display Dentist Assessment
```

---

## 4. Authorization & Security Policies

The subsystem implements strict multi-role access control using the existing `require_dentist`, `require_patient`, and `get_current_user` FastAPI dependencies:

### 1. Treating Dentist Authority
- **Role Requirement**: User must have `role == 'dentist'`.
- **Verification Requirement**: `Dentist.verification_status` must equal `'approved'`. Dentists with `'pending'`, `'rejected'`, or `'suspended'` status are rejected with `403 Forbidden`.
- **Active Relationship Requirement**: An active record must exist in `patient_dentist_relationships` where `patient_id == screening.patient_id`, `dentist_id == dentist.id`, and `status == 'active'`. Unrelated dentists are rejected with `403 Forbidden`.
- **Authorship Isolation**: A dentist may only update an assessment that they personally authored.

### 2. Patient Authority
- **Creation/Update Prohibition**: Patients are strictly forbidden from creating (`POST`) or updating (`PATCH`) dentist assessments. Calls return `403 Forbidden`.
- **Read Isolation**: Patients may only view (`GET`) assessments belonging to screenings they own (`screening.patient_id == patient.id`). Cross-patient access returns `403 Forbidden`.

### 3. Administrator Authority
- **Oversight Access**: Administrators (`role == 'admin'`) can inspect assessments for clinical and regulatory compliance.
- **Clinical Immutability**: Administrators cannot author or alter a dentist's clinical opinion.

### 4. Client Parameter Sanitization
- Clients are never trusted to provide `dentist_id`, `patient_id`, `screening_id`, `created_at`, or `finalized_at`.
- Identifiers and credentials are derived exclusively from the verified session token and database relationships.

---

## 5. Validation Rules

1. **Non-Empty Clinical Text**: `clinical_observations`, `diagnosis_notes`, and `treatment_recommendation` must have minimum length $\ge 1$ character (whitespace stripped).
2. **Screening State**:
   - Screening must exist in the database.
   - Screening must not be soft-deleted (`is_deleted == False`).
3. **Draft Lockout**:
   - If an assessment has `is_finalized == True`, any subsequent update attempt is rejected with `409 Conflict`.
4. **Duplicate Prevention**:
   - If an assessment already exists for the given screening and dentist, repeated `POST` requests are rejected with `409 Conflict`, directing the client to use `PATCH`.

---

## 6. API Endpoints

| HTTP Method | Endpoint | Authorization | Status Codes | Description |
|---|---|---|---|---|
| `GET` | `/api/screenings/{screening_id}/review` | Treating Dentist / Patient Owner / Admin | 200, 403, 404 | Returns consolidated multi-modal findings for clinical evaluation |
| `POST` | `/api/screenings/{screening_id}/assessment` | Treating Dentist (`status == 'active'`) | 201, 400, 403, 404, 409 | Submits a professional clinical assessment (draft or finalized) |
| `GET` | `/api/screenings/{screening_id}/assessment` | Patient Owner / Treating Dentist / Admin | 200, 403, 404 | Retrieves the clinical assessment for a screening session |
| `PATCH` | `/api/screenings/{screening_id}/assessment` | Authoring Treating Dentist | 200, 400, 403, 404, 409 | Updates an unfinalized assessment draft or permanently locks it |

---

## 7. Assessment Lifecycle

```
       [ Dentist Begins Review ]
                   │
                   ▼
       [ Create Assessment ]
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
[ is_finalized=False ]   [ is_finalized=True ]
   (DRAFT STAGE)            (FINALIZED)
        │                         │
        ├── Can PATCH notes       ▼
        ├── Can adjust referral  [ PERMANENTLY LOCKED ]
        │                        (Cannot PATCH, 409 Conflict)
        ▼                        (finalized_at stamped)
[ Finalize Assessment ]
```

---

## 8. Audit Logging

Every clinical assessment action is immutably logged into the `audit_logs` table:
- **`DENTIST_ASSESSMENT_CREATED`**: Logged when a dentist submits an initial assessment. Details include `screening_id`, `dentist_id`, `is_finalized`, and `referral_needed`.
- **`DENTIST_ASSESSMENT_UPDATED`**: Logged when a dentist updates an unfinalized draft or finalizes it. Details include `screening_id`, `dentist_id`, and `is_finalized`.
- **`DENTIST_ASSESSMENT_VIEWED`**: Logged when an assessment or screening review is retrieved. Details include `screening_id` and `viewer_role`.

Audit logs omit passwords, Firebase authentication tokens, and raw patient personal health identifiers (PHI).

---

## 9. Report Subsystem Integration

Phase 11's [`ReportService`](file:///c:/Users/hp/Desktop/OravisionAI/backend/app/services/report_service.py) automatically incorporates dentist assessments into the frozen diagnostic JSON snapshot (`report_data["dentist_assessments"]`).

When rendered into a PDF via [`PDFReportRenderer`](file:///c:/Users/hp/Desktop/OravisionAI/backend/app/services/pdf_report_renderer.py), the assessment appears in **Section 6: LICENSED DENTIST CLINICAL ASSESSMENT**:
- Dentist Observations
- Preliminary Diagnosis Notes
- Proposed Treatment Recommendations
- Specialist Referral Details (if indicated)
- Practitioner Signature Block (Dentist Name, Clinic, License Number, and Finalization Timestamp)

The report preserves the fundamental architectural distinction:
$$\text{AI Prediction} \neq \text{YOLO Detection} \neq \text{XAI Explanation} \neq \text{Screening Priority} \neq \text{Dentist Assessment}$$

---

## 10. AI vs. Dentist Separation

1. **Independent Columns & Tables**:
   Automated AI inferences reside in `ai_predictions`, `prediction_probabilities`, `yolo_detections`, `xai_results`, and `risk_assessments`. The dentist's opinion resides solely in `dentist_assessments`.
2. **Immutability of AI Outputs**:
   Creating, modifying, or finalizing a `DentistAssessment` performs zero writes to any AI tables.
3. **No Automated Synthesis**:
   A dentist's diagnosis notes and treatment recommendations are authored directly by the dental practitioner. The platform never generates automated diagnoses or treatments under the dentist's name.

---

## 11. Limitations & Future Extensions

- **Single Active Assessment per Dentist**: Each treating dentist may maintain one active assessment draft per screening session.
- **Addendum System**: Post-finalization corrections will be supported in future phases via a formal clinical addendum model rather than overwriting locked assessments.

