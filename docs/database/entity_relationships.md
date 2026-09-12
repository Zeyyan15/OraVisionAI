# OraVisionAI — Entity Relationships & Cardinality Specification

This document maps all structural relationships, cardinalities, join paths, and authorization boundaries across the 23 relational database entities of **OraVisionAI**.

---

## 1. High-Level Entity Relationship Map

```
                                      [ users ]
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │ (1:1)                 │ (1:1)                 │ (1:N)
                  ▼                       ▼                       ▼
            [ patients ]             [ dentists ]          [ notifications ]
                  │                       │
      ┌───────────┼───────────┐           ├───────────────────────┬───────────────────────┐
      │ (1:1)     │ (1:N)     │ (1:N)     │ (1:N)                 │ (1:N)                 │ (1:N)
      ▼           ▼           ▼           ▼                       ▼                       ▼
 [ patient_   [ screenings ]  │     [ dentist_              [ dentist_              [ dentist_
   medical_       │           │    verifications ]        availabilities ]        assessments ]
   profiles ]     │           │                                                           ▲
                  │           └───────────────────────┬───────────────────────────────────┤
                  │                                   ▼                                   │
                  │                    [ patient_dentist_relationships ]                  │
                  │                                   │                                   │
                  ├─────────────────────────────┬─────┴──────────────────────┐            │
                  │ (1:N)                       │ (1:N)                      │ (1:N)      │
                  ▼                             ▼                            ▼            │
         [ screening_images ]            [ appointments ]             [ conversations ]   │
                  │                             │                            │            │
         ┌────────┴────────┐                    │ (1:1)                      │ (1:N)      │
         │ (1:N)           │ (1:N)              ▼                            ▼            │
         ▼                 ▼             [ consultations ]               [ messages ]     │
  [ ai_predictions ] [ yolo_detections ]                                                  │
         │                                                                                │
    ┌────┴──────────────────────────┐                                                     │
    │ (1:N)                         │ (1:N)                                               │
    ▼                               ▼                                                     │
[ prediction_                [ xai_results ]                                              │
  probabilities ]                   │                                                     │
                                    │ (Synthesizes)                                       │
                                    ▼                                                     │
                          [ risk_assessments ] ───────────────────────────────────────────┤
                                    │                                                     │
                                    ▼ (1:1)                                               │
                               [ reports ] ◄──────────────────────────────────────────────┘
```

---

## 2. Cardinality Breakdown

### 2.1 One-to-One (1:1) Relationships

| Parent Entity | Child Entity | Foreign Key Column | Nullable | Cascade Rule | Business Purpose |
|---|---|---|---|---|---|
| `users` | `patients` | `patients.user_id` | No | `ON DELETE CASCADE` | Extends user identity into patient medical domain |
| `users` | `dentists` | `dentists.user_id` | No | `ON DELETE CASCADE` | Extends user identity into professional dental domain |
| `patients` | `patient_medical_profiles` | `patient_medical_profiles.patient_id` | No | `ON DELETE CASCADE` | Detailed clinical medical & lifestyle history |
| `screenings` | `risk_assessments` | `risk_assessments.screening_id` | No | `ON DELETE CASCADE` | Automated risk stratification per screening |
| `screenings` | `reports` | `reports.screening_id` | No | `ON DELETE CASCADE` | Final consolidated patient/dentist clinical report |
| `appointments` | `consultations` | `consultations.appointment_id` | No | `ON DELETE CASCADE` | Teleconsultation session metadata for a scheduled appointment |

---

### 2.2 One-to-Many (1:N) Relationships

| Parent Entity | Child Entity | Foreign Key Column | Cascade Rule | Cardinality Details |
|---|---|---|---|---|
| `users` | `notifications` | `notifications.user_id` | `CASCADE` | One user receives multiple notifications over time |
| `users` | `audit_logs` | `audit_logs.user_id` | `SET NULL` | One user generates multiple audit log entries |
| `dentists` | `dentist_verifications` | `dentist_verifications.dentist_id` | `CASCADE` | One dentist submits multiple credential documents (license, degree) |
| `dentists` | `dentist_availabilities` | `dentist_availabilities.dentist_id` | `CASCADE` | One dentist defines recurring weekly schedule slots |
| `patients` | `screenings` | `screenings.patient_id` | `CASCADE` | One patient performs multiple screenings over their lifetime |
| `screenings` | `screening_images` | `screening_images.screening_id` | `CASCADE` | One screening session can include 1 or more uploaded images |
| `screening_images` | `ai_predictions` | `ai_predictions.screening_image_id` | `CASCADE` | One image can be evaluated by classification models |
| `ai_models` | `ai_predictions` | `ai_predictions.ai_model_id` | `RESTRICT` | One registered model generates predictions across many screenings |
| `ai_predictions` | `prediction_probabilities` | `prediction_probabilities.ai_prediction_id` | `CASCADE` | One prediction generates 7 discrete class probabilities |
| `screening_images` | `yolo_detections` | `yolo_detections.screening_image_id` | `CASCADE` | One image produces multiple bounding-box lesion detections |
| `ai_models` | `yolo_detections` | `yolo_detections.ai_model_id` | `RESTRICT` | One registered YOLO model detects lesions across many images |
| `ai_predictions` | `xai_results` | `xai_results.ai_prediction_id` | `CASCADE` | One prediction produces multiple XAI maps (Grad-CAM, Occlusion, etc.) |
| `screenings` | `dentist_assessments` | `dentist_assessments.screening_id` | `CASCADE` | One screening can receive professional notes/assessments from dentists |
| `conversations` | `messages` | `messages.conversation_id` | `CASCADE` | One conversation thread contains many sequential messages |

---

### 2.3 Many-to-Many (M:N) Relationships & Association Entities

OraVisionAI models all M:N relationships via dedicated **association tables with metadata** rather than bare join tables:

#### 1. Patients ↔ Dentists (`patient_dentist_relationships`)
- **Relationship**: A patient may consult multiple dentists; a dentist manages multiple patients.
- **Association Table**: `patient_dentist_relationships`
- **Metadata**: `status` (active, pending_consent, revoked, archived), `established_via` (appointment, direct_invite, screening_share), timestamps.
- **Unique Constraint**: `UNIQUE(patient_id, dentist_id)` ensures a single active relationship record per pair.

#### 2. Patients ↔ Dentists Appointments (`appointments`)
- **Relationship**: A patient can book multiple appointments with different dentists over time.
- **Association Table**: `appointments`
- **Metadata**: `scheduled_start`, `scheduled_end`, `appointment_type`, `status`, `screening_id` (optional link to screening being reviewed).

#### 3. Patients ↔ Dentists Conversations (`conversations`)
- **Relationship**: Direct communication channel between a specific patient and dentist.
- **Association Table**: `conversations`
- **Metadata**: `stream_channel_id`, `conversation_type`, `is_active`, `last_message_at`.
- **Unique Constraint**: `UNIQUE(patient_id, dentist_id, conversation_type)` prevents duplicate open channels.

---

## 3. Critical Query Traversal & Join Paths

### Path 1: Patient Complete Screening Diagnostic Profile
Retrieves an entire screening record including images, classification, 7-class breakdown, YOLO lesions, XAI explanations, risk tier, and dentist assessment:

```sql
SELECT 
    s.id AS screening_id,
    s.status AS screening_status,
    s.created_at AS screening_date,
    si.storage_path AS original_image_path,
    ap.predicted_class,
    ap.confidence,
    pp.class_name,
    pp.probability,
    yd.detected_class AS lesion_class,
    yd.confidence AS lesion_confidence,
    yd.bbox_x_min, yd.bbox_y_min, yd.bbox_x_max, yd.bbox_y_max,
    xr.method AS xai_method,
    xr.overlay_image_storage_path,
    ra.risk_level,
    ra.risk_score,
    da.diagnosis_notes AS dentist_diagnosis,
    r.report_number,
    r.pdf_storage_path
FROM screenings s
JOIN patients p ON s.patient_id = p.id
JOIN screening_images si ON si.screening_id = s.id
LEFT JOIN ai_predictions ap ON ap.screening_image_id = si.id
LEFT JOIN prediction_probabilities pp ON pp.ai_prediction_id = ap.id
LEFT JOIN yolo_detections yd ON yd.screening_image_id = si.id
LEFT JOIN xai_results xr ON xr.ai_prediction_id = ap.id AND xr.is_primary_user_facing = TRUE
LEFT JOIN risk_assessments ra ON ra.screening_id = s.id
LEFT JOIN dentist_assessments da ON da.screening_id = s.id
LEFT JOIN reports r ON r.screening_id = s.id
WHERE s.id = :screening_id
  AND s.is_deleted = FALSE;
```

---

### Path 2: Dentist Access Verification (Authorization Boundary)
Validates whether a logged-in dentist is authorized to view a specific patient's medical records or screening history:

```sql
SELECT 1 
FROM patient_dentist_relationships pdr
JOIN dentists d ON d.id = pdr.dentist_id
JOIN users u ON u.id = d.user_id
WHERE u.firebase_uid = :current_user_firebase_uid
  AND pdr.patient_id = :target_patient_id
  AND pdr.status = 'active'
  AND d.verification_status = 'approved';
```

---

### Path 3: Teleconsultation Session Activation
Fetches appointment, patient background, and initializes Stream call metadata:

```sql
SELECT 
    a.id AS appointment_id,
    a.scheduled_start,
    a.scheduled_end,
    a.appointment_type,
    p.id AS patient_id,
    pu.first_name AS patient_first_name,
    pu.last_name AS patient_last_name,
    pmp.allergies,
    pmp.current_medications,
    d.id AS dentist_id,
    du.first_name AS dentist_first_name,
    du.last_name AS dentist_last_name,
    c.stream_call_id,
    c.session_status
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN users pu ON p.user_id = pu.id
LEFT JOIN patient_medical_profiles pmp ON pmp.patient_id = p.id
JOIN dentists d ON a.dentist_id = d.id
JOIN users du ON d.user_id = du.id
LEFT JOIN consultations c ON c.appointment_id = a.id
WHERE a.id = :appointment_id;
```

---

## 4. Cascading & Deletion Rules

| Scenario | Affected Tables | Deletion Policy | Rationale |
|---|---|---|---|
| **Patient requests deletion of a Screening** | `screenings`, `screening_images`, `ai_predictions`, `xai_results`, `reports` | **Soft Delete** (`is_deleted=TRUE`, `deleted_at=NOW()`) | Prevents data loss during active clinical review while hiding record from patient UI. Retains audit compliance. |
| **User Account Deletion (Hard)** | `users` → `patients`/`dentists` | **CASCADE** | Deleting a user purges linked patient/dentist profile rows. |
| **Model Deprecation / Deletion** | `ai_models` → `ai_predictions` | **RESTRICT** | Prevents deletion of a model record if historical predictions reference it, preserving medical reproducibility. |
| **Appointment Cancelled** | `appointments` → `consultations` | **CASCADE** | Purges consultation metadata if appointment was never held. |
| **Dentist Deleted / Unlinked** | `dentists` → `dentist_assessments` | **RESTRICT** | Preserves finalized medical opinions on patient records even if a practitioner leaves the platform. |

---

## 5. Security & Authorization Boundaries

1. **Patient Tier**:
   - Authorized exclusively to rows where `patient_id` resolves to the authenticated user's `patients.id`.
   - Cannot view other patients' profiles, screenings, or appointments.
2. **Dentist Tier**:
   - Authorized to view patient profiles **only** if an active row exists in `patient_dentist_relationships` OR an active `appointment` is booked.
   - Must hold `verification_status = 'approved'` to accept bookings or create `dentist_assessments`.
3. **Admin Tier**:
   - Authorized across user verification, model registry, audit log inspection, and system metrics.
   - Cannot modify clinical data or overwrite dentist diagnoses.
