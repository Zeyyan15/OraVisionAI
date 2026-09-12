# OraVisionAI — Database Schema Specification

This document defines the complete relational database schema for the **OraVisionAI** platform.

---

## 1. Schema Design Principles & Standards

- **Engine**: PostgreSQL 15+
- **Primary Keys**: UUID (`uuid_generate_v4()` / PostgreSQL `gen_random_uuid()`) across all tables to avoid enumerable IDs and facilitate distributed security.
- **Timestamps**: All timestamps use `TIMESTAMPTZ` (`TIMESTAMP WITH TIME ZONE`) initialized to `CURRENT_TIMESTAMP`.
- **Identity & Auth**: Firebase Authentication manages passwords, multi-factor, and OAuth tokens. Only the external `firebase_uid` is stored in the database for identity mapping.
- **File Storage**: Object binaries reside in Firebase Storage. The database records file metadata, storage paths, mime types, and cryptographic/integrity information.
- **Soft Deletion**: Screening records implement soft deletion (`is_deleted`, `deleted_at`) to preserve audit trails while honoring patient deletion requests at the application tier.
- **AI Separation**: Raw AI outputs, class probabilities, YOLO bounding boxes, and XAI heatmaps are normalized and versioned, strictly separated from professional `dentist_assessments`.
- **Auditability**: `audit_logs` records security-critical actions immutably. Sensitive credentials/tokens are strictly prohibited from logs.

---

## 2. Table Summary by Domain

| # | Domain | Table Name | Purpose |
|---|---|---|---|
| 1 | **Identity & Roles** | `users` | Core user identity mapped to Firebase Auth |
| 2 | | `patients` | Patient demographic and administrative profile |
| 3 | | `patient_medical_profiles` | Sensitive medical, dental, allergy, and lifestyle history |
| 4 | | `dentists` | Professional dentist profile and clinic credentials |
| 5 | | `dentist_verifications` | Administrative verification documents and approval history |
| 6 | | `patient_dentist_relationships` | Explicit authorization binding patients and dentists |
| 7 | **Screening & Images** | `screenings` | Screening session header and lifecycle status |
| 8 | | `screening_images` | Oral/dental images captured and uploaded for analysis |
| 9 | **AI & Machine Learning** | `ai_models` | Model version registry (EfficientNetB0, YOLO, etc.) |
| 10 | | `ai_predictions` | High-level classification inference records |
| 11 | | `prediction_probabilities` | 7-class discrete probability distribution per inference |
| 12 | | `yolo_detections` | Structured lesion detection bounding boxes |
| 13 | | `risk_assessments` | Automated risk stratification based on multi-model AI |
| 14 | | `xai_results` | Explainable AI heatmaps (Grad-CAM, Occlusion, etc.) |
| 15 | **Reports & Reviews** | `reports` | Consolidated patient/dentist screening reports |
| 16 | | `dentist_assessments` | Licensed dentist clinical diagnosis and recommendations |
| 17 | **Appointments & Teleconsultation** | `dentist_availabilities` | Weekly recurring availability windows for booking |
| 18 | | `appointments` | Scheduled consultation sessions and booking status |
| 19 | | `consultations` | Live teleconsultation metadata and Stream call records |
| 20 | **Communication** | `conversations` | Patient-dentist communication channels |
| 21 | | `messages` | Direct messages with attachment and read receipts |
| 22 | **System & Audit** | `notifications` | In-app user notifications and dispatch status |
| 23 | | `audit_logs` | Immutable audit trail for compliance and security events |

---

## 3. Entity Definitions

---

### Domain 1: Identity, Users, Roles & Relationships

#### 3.1 `users`
Core account entity representing all platform actors (Patient, Dentist, Admin).

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique internal identifier |
| `firebase_uid` | `VARCHAR(128)` | No | — | `UNIQUE`, `NOT NULL` | Firebase Authentication UID |
| `email` | `VARCHAR(255)` | No | — | `UNIQUE`, `NOT NULL` | Account email address |
| `role` | `VARCHAR(20)` | No | — | `CHECK (role IN ('patient', 'dentist', 'admin'))` | User access tier |
| `first_name` | `VARCHAR(100)` | No | — | | Given name |
| `last_name` | `VARCHAR(100)` | No | — | | Family name |
| `phone_number` | `VARCHAR(30)` | Yes | `NULL` | | Contact telephone number |
| `avatar_url` | `TEXT` | Yes | `NULL` | | Profile avatar storage URL |
| `is_active` | `BOOLEAN` | No | `TRUE` | | Account activation status |
| `is_email_verified` | `BOOLEAN` | No | `FALSE` | | Synced verification flag |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last profile update timestamp |

- **Indexes**:
  - `CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebase_uid);`
  - `CREATE UNIQUE INDEX idx_users_email ON users(email);`
  - `CREATE INDEX idx_users_role ON users(role);`

---

#### 3.2 `patients`
Extended profile for users holding the `patient` role.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique patient profile ID |
| `user_id` | `UUID` | No | — | `UNIQUE`, `FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE` | 1-to-1 link to user |
| `date_of_birth` | `DATE` | Yes | `NULL` | | Date of birth for age calculation |
| `gender` | `VARCHAR(30)` | Yes | `NULL` | `CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'))` | Gender identity |
| `emergency_contact_name` | `VARCHAR(150)` | Yes | `NULL` | | Emergency contact person |
| `emergency_contact_phone`| `VARCHAR(30)` | Yes | `NULL` | | Emergency contact phone number |
| `address` | `TEXT` | Yes | `NULL` | | Residential address |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last update timestamp |

- **Indexes**:
  - `CREATE UNIQUE INDEX idx_patients_user_id ON patients(user_id);`

---

#### 3.3 `patient_medical_profiles`
Structured clinical background, dental history, and risk factors.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique medical profile ID |
| `patient_id` | `UUID` | No | — | `UNIQUE`, `FOREIGN KEY REFERENCES patients(id) ON DELETE CASCADE` | 1-to-1 link to patient |
| `medical_history` | `JSONB` | No | `'[]'::jsonb` | | Array of past medical conditions (diabetes, hypertension, etc.) |
| `dental_history` | `JSONB` | No | `'[]'::jsonb` | | Prior dental procedures, implants, surgeries |
| `allergies` | `JSONB` | No | `'[]'::jsonb` | | Drug/latex/anesthesia allergies |
| `current_medications` | `JSONB` | No | `'[]'::jsonb` | | List of current pharmaceutical medications |
| `smoking_status` | `VARCHAR(50)` | Yes | `'never'` | `CHECK (smoking_status IN ('never', 'former', 'occasional', 'regular', 'heavy'))` | Tobacco consumption risk factor |
| `alcohol_consumption` | `VARCHAR(50)` | Yes | `'none'` | `CHECK (alcohol_consumption IN ('none', 'occasional', 'moderate', 'frequent'))` | Alcohol consumption risk factor |
| `betel_quid_user` | `BOOLEAN` | No | `FALSE` | | Oral cancer high-risk indicator |
| `additional_notes` | `TEXT` | Yes | `NULL` | | Additional clinical notes |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last update timestamp |

- **Indexes**:
  - `CREATE UNIQUE INDEX idx_medical_profiles_patient_id ON patient_medical_profiles(patient_id);`
  - `CREATE INDEX idx_medical_profiles_gin_allergies ON patient_medical_profiles USING GIN (allergies);`

---

#### 3.4 `dentists`
Professional profile and clinical credentials for verified practitioners.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique dentist profile ID |
| `user_id` | `UUID` | No | — | `UNIQUE`, `FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE` | 1-to-1 link to user |
| `license_number` | `VARCHAR(100)` | No | — | `UNIQUE`, `NOT NULL` | Dental council license ID |
| `specialization` | `VARCHAR(150)` | No | `'General Dentistry'` | | Area of specialization |
| `clinic_name` | `VARCHAR(200)` | Yes | `NULL` | | Associated clinic or hospital |
| `clinic_address` | `TEXT` | Yes | `NULL` | | Physical clinic location |
| `years_of_experience` | `INTEGER` | No | `0` | `CHECK (years_of_experience >= 0)` | Years in active practice |
| `bio` | `TEXT` | Yes | `NULL` | | Professional summary |
| `verification_status` | `VARCHAR(30)` | No | `'pending'` | `CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended'))` | Admin verification status |
| `verified_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Date/time of admin approval |
| `verified_by_id` | `UUID` | Yes | `NULL` | `FOREIGN KEY REFERENCES users(id) ON DELETE SET NULL` | Admin who approved |
| `rejection_reason` | `TEXT` | Yes | `NULL` | | Feedback if rejected/suspended |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last update timestamp |

- **Indexes**:
  - `CREATE UNIQUE INDEX idx_dentists_user_id ON dentists(user_id);`
  - `CREATE UNIQUE INDEX idx_dentists_license ON dentists(license_number);`
  - `CREATE INDEX idx_dentists_verification_status ON dentists(verification_status);`

---

#### 3.5 `dentist_verifications`
Document repository for credential verification workflows.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique verification record ID |
| `dentist_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES dentists(id) ON DELETE CASCADE` | Associated dentist |
| `document_type` | `VARCHAR(100)` | No | — | | Type (e.g. 'license_certificate', 'id_proof', 'degree') |
| `document_url` | `TEXT` | No | — | | Firebase Storage secure path |
| `file_name` | `VARCHAR(255)` | No | — | | Original document filename |
| `file_size_bytes` | `BIGINT` | Yes | `NULL` | | Document size in bytes |
| `status` | `VARCHAR(30)` | No | `'pending'` | `CHECK (status IN ('pending', 'approved', 'rejected'))` | Individual document review status |
| `reviewer_id` | `UUID` | Yes | `NULL` | `FOREIGN KEY REFERENCES users(id) ON DELETE SET NULL` | Reviewing admin |
| `review_notes` | `TEXT` | Yes | `NULL` | | Internal review notes |
| `submitted_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Submission timestamp |
| `reviewed_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Review completion timestamp |

- **Indexes**:
  - `CREATE INDEX idx_dentist_verifications_dentist_id ON dentist_verifications(dentist_id);`
  - `CREATE INDEX idx_dentist_verifications_status ON dentist_verifications(status);`

---

#### 3.6 `patient_dentist_relationships`
Authorization mapping establishing patient consent and dentist access boundaries.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique relationship ID |
| `patient_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES patients(id) ON DELETE CASCADE` | Connected patient |
| `dentist_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES dentists(id) ON DELETE CASCADE` | Connected dentist |
| `status` | `VARCHAR(30)` | No | `'active'` | `CHECK (status IN ('active', 'pending_consent', 'revoked', 'archived'))` | Relationship lifecycle |
| `established_via` | `VARCHAR(50)` | No | `'appointment'` | `CHECK (established_via IN ('appointment', 'direct_invite', 'screening_share'))` | How relationship originated |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Establishment timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Status change timestamp |

- **Constraints & Indexes**:
  - `CONSTRAINT uq_patient_dentist UNIQUE (patient_id, dentist_id)`
  - `CREATE INDEX idx_pdr_patient_id ON patient_dentist_relationships(patient_id);`
  - `CREATE INDEX idx_pdr_dentist_id ON patient_dentist_relationships(dentist_id);`
  - `CREATE INDEX idx_pdr_status ON patient_dentist_relationships(status);`

---

### Domain 2: Screening & Image Management

#### 3.7 `screenings`
Screening session header tracking the end-to-end diagnostic workflow.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique screening identifier |
| `patient_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES patients(id) ON DELETE CASCADE` | Patient owner |
| `created_by_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES users(id) ON DELETE RESTRICT` | Submitting user (patient or dentist) |
| `status` | `VARCHAR(30)` | No | `'pending'` | `CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed'))` | Pipeline execution status |
| `clinical_notes` | `TEXT` | Yes | `NULL` | | Patient-provided symptoms or history |
| `error_message` | `TEXT` | Yes | `NULL` | | Diagnostic error description if pipeline failed |
| `is_deleted` | `BOOLEAN` | No | `FALSE` | | Soft deletion flag |
| `deleted_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Soft deletion timestamp |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Initiation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last state transition timestamp |

- **Indexes**:
  - `CREATE INDEX idx_screenings_patient_id ON screenings(patient_id);`
  - `CREATE INDEX idx_screenings_status ON screenings(status);`
  - `CREATE INDEX idx_screenings_active ON screenings(patient_id, is_deleted, created_at DESC);`

---

#### 3.8 `screening_images`
Individual photographic inputs submitted for oral screening analysis.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique image record ID |
| `screening_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES screenings(id) ON DELETE CASCADE` | Parent screening session |
| `storage_path` | `TEXT` | No | — | `NOT NULL` | Firebase Storage internal URI |
| `file_name` | `VARCHAR(255)` | No | — | | Original filename |
| `file_size_bytes` | `BIGINT` | No | — | | Image size in bytes |
| `mime_type` | `VARCHAR(100)` | No | `'image/jpeg'` | | Media MIME type |
| `image_width` | `INTEGER` | Yes | `NULL` | | Resolution width (pixels) |
| `image_height` | `INTEGER` | Yes | `NULL` | | Resolution height (pixels) |
| `image_sha256` | `VARCHAR(64)` | Yes | `NULL` | | SHA-256 content hash for integrity |
| `is_primary` | `BOOLEAN` | No | `TRUE` | | Primary image flag for multi-image sessions |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Upload timestamp |

- **Indexes**:
  - `CREATE INDEX idx_screening_images_screening_id ON screening_images(screening_id);`

---

### Domain 3: AI Inference, XAI & Model Management

#### 3.9 `ai_models`
Model metadata registry supporting version tracking and multi-model runtime configurations.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique model identifier |
| `name` | `VARCHAR(100)` | No | — | | Model name (e.g. `OraVisionAI-EfficientNetB0`, `OraVisionAI-YOLOv8`) |
| `model_type` | `VARCHAR(50)` | No | — | `CHECK (model_type IN ('classifier', 'detector', 'multimodal', 'risk_engine'))` | Task categorization |
| `version` | `VARCHAR(50)` | No | — | | Semantic version (e.g. `1.0.0-verified`) |
| `architecture` | `VARCHAR(100)` | No | — | | Underlying architecture (`EfficientNetB0`, `YOLOv8s`) |
| `weights_path` | `TEXT` | Yes | `NULL` | | Artifact configuration path |
| `input_shape` | `VARCHAR(50)` | No | `'224x224x3'` | | Required input tensor dimensions |
| `class_labels` | `JSONB` | No | `'[]'::jsonb` | | Ordered list of target class labels |
| `target_layers` | `JSONB` | Yes | `'[]'::jsonb` | | Validated layers for XAI extraction |
| `is_active` | `BOOLEAN` | No | `TRUE` | | Available for production inference |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Registration timestamp |

- **Constraints & Indexes**:
  - `CONSTRAINT uq_model_name_version UNIQUE (name, version)`
  - `CREATE INDEX idx_ai_models_active ON ai_models(model_type, is_active);`

---

#### 3.10 `ai_predictions`
Top-level classification outputs generated by the 7-class EfficientNetB0 classifier.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique prediction ID |
| `screening_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES screenings(id) ON DELETE CASCADE` | Associated screening |
| `screening_image_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES screening_images(id) ON DELETE CASCADE` | Input image evaluated |
| `ai_model_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES ai_models(id) ON DELETE RESTRICT` | Model version used |
| `predicted_class` | `VARCHAR(100)` | No | — | | Top predicted condition class |
| `confidence` | `NUMERIC(5, 4)`| No | — | `CHECK (confidence >= 0.0 AND confidence <= 1.0)` | Probability of top class (0.0000–1.0000) |
| `inference_duration_ms` | `INTEGER` | Yes | `NULL` | | Latency in milliseconds |
| `status` | `VARCHAR(30)` | No | `'completed'` | `CHECK (status IN ('processing', 'completed', 'failed'))` | Execution status |
| `raw_output` | `JSONB` | Yes | `NULL` | | Full raw logits/tensor output dictionary |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Inference timestamp |

- **Indexes**:
  - `CREATE INDEX idx_predictions_screening_id ON ai_predictions(screening_id);`
  - `CREATE INDEX idx_predictions_image_id ON ai_predictions(screening_image_id);`
  - `CREATE INDEX idx_predictions_model_id ON ai_predictions(ai_model_id);`

---

#### 3.11 `prediction_probabilities`
Normalized probability distribution across all 7 oral condition classes for each inference.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique probability record ID |
| `ai_prediction_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES ai_predictions(id) ON DELETE CASCADE` | Parent prediction |
| `class_name` | `VARCHAR(100)` | No | — | | Condition class name |
| `probability` | `NUMERIC(5, 4)`| No | — | `CHECK (probability >= 0.0 AND probability <= 1.0)` | Class probability (0.0000–1.0000) |
| `class_index` | `SMALLINT` | No | — | | Zero-indexed model output node index |

- **Constraints & Indexes**:
  - `CONSTRAINT uq_prediction_class UNIQUE (ai_prediction_id, class_name)`
  - `CREATE INDEX idx_pred_prob_prediction_id ON prediction_probabilities(ai_prediction_id);`

---

#### 3.12 `yolo_detections`
Structured spatial bounding box detections generated by the OraVisionAI YOLO model.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique detection ID |
| `screening_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES screenings(id) ON DELETE CASCADE` | Parent screening |
| `screening_image_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES screening_images(id) ON DELETE CASCADE` | Input image evaluated |
| `ai_model_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES ai_models(id) ON DELETE RESTRICT` | YOLO model version used |
| `detected_class` | `VARCHAR(100)` | No | — | | Detected lesion/finding class name |
| `confidence` | `NUMERIC(5, 4)`| No | — | `CHECK (confidence >= 0.0 AND confidence <= 1.0)` | Detection confidence |
| `bbox_x_min` | `NUMERIC(7, 4)`| No | — | `CHECK (bbox_x_min >= 0.0 AND bbox_x_min <= 1.0)` | Normalized top-left X (0.0–1.0) |
| `bbox_y_min` | `NUMERIC(7, 4)`| No | — | `CHECK (bbox_y_min >= 0.0 AND bbox_y_min <= 1.0)` | Normalized top-left Y (0.0–1.0) |
| `bbox_x_max` | `NUMERIC(7, 4)`| No | — | `CHECK (bbox_x_max >= 0.0 AND bbox_x_max <= 1.0)` | Normalized bottom-right X (0.0–1.0) |
| `bbox_y_max` | `NUMERIC(7, 4)`| No | — | `CHECK (bbox_y_max >= 0.0 AND bbox_y_max <= 1.0)` | Normalized bottom-right Y (0.0–1.0) |
| `detection_metadata`| `JSONB` | Yes | `NULL` | | Area, aspect ratio, auxiliary attributes |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Inference timestamp |

- **Indexes**:
  - `CREATE INDEX idx_yolo_screening_id ON yolo_detections(screening_id);`
  - `CREATE INDEX idx_yolo_image_id ON yolo_detections(screening_image_id);`

---

#### 3.13 `risk_assessments`
Synthesized risk scoring combining classification confidence, lesion count, and medical history.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique risk assessment ID |
| `screening_id` | `UUID` | No | — | `UNIQUE`, `FOREIGN KEY REFERENCES screenings(id) ON DELETE CASCADE` | 1-to-1 link to screening |
| `ai_prediction_id` | `UUID` | Yes | `NULL` | `FOREIGN KEY REFERENCES ai_predictions(id) ON DELETE SET NULL` | Reference classification |
| `risk_level` | `VARCHAR(30)` | No | — | `CHECK (risk_level IN ('low', 'moderate', 'high', 'critical'))` | Stratified risk tier |
| `risk_score` | `NUMERIC(5, 2)`| No | — | `CHECK (risk_score >= 0.0 AND risk_score <= 100.0)` | Numerical risk index (0–100) |
| `contributing_factors` | `JSONB`| No | `'[]'::jsonb` | | Array of reasons (e.g. "Lesion detected", "Smoking history") |
| `summary` | `TEXT` | No | — | | Patient-friendly risk summary |
| `recommended_action` | `TEXT` | No | — | | Triage recommendation (e.g. "Urgent dentist review advised") |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Calculation timestamp |

- **Indexes**:
  - `CREATE UNIQUE INDEX idx_risk_screening_id ON risk_assessments(screening_id);`
  - `CREATE INDEX idx_risk_level ON risk_assessments(risk_level);`

---

#### 3.14 `xai_results`
Visual explainability artifacts highlighting neural network focus areas.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique XAI result ID |
| `ai_prediction_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES ai_predictions(id) ON DELETE CASCADE` | Parent classification |
| `screening_image_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES screening_images(id) ON DELETE CASCADE` | Evaluated image |
| `method` | `VARCHAR(50)` | No | — | `CHECK (method IN ('grad_cam', 'occlusion_sensitivity', 'score_cam', 'grad_cam_plus_plus', 'layer_cam', 'integrated_gradients'))` | XAI algorithm used |
| `target_layer` | `VARCHAR(100)` | Yes | `NULL` | | CNN target layer (e.g. `block6a_expand_conv`) |
| `is_primary_user_facing`| `BOOLEAN`| No | `FALSE` | | `TRUE` for Occlusion & Grad-CAM; `FALSE` for secondary methods |
| `heatmap_storage_path` | `TEXT` | No | — | | Firebase Storage path to raw heatmap |
| `overlay_image_storage_path` | `TEXT` | No | — | | Firebase Storage path to blended RGB overlay |
| `parameters` | `JSONB` | Yes | `NULL` | | Method parameters (e.g. patch size, stride) |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Generation timestamp |

- **Indexes**:
  - `CREATE INDEX idx_xai_prediction_id ON xai_results(ai_prediction_id);`
  - `CREATE INDEX idx_xai_method ON xai_results(method);`
  - `CREATE INDEX idx_xai_primary ON xai_results(ai_prediction_id, is_primary_user_facing);`

---

### Domain 4: Clinical Reports & Dentist Reviews

#### 3.15 `reports`
Consolidated diagnostic reports incorporating patient data, AI findings, and clinical notes.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique report ID |
| `screening_id` | `UUID` | No | — | `UNIQUE`, `FOREIGN KEY REFERENCES screenings(id) ON DELETE CASCADE` | 1-to-1 link to screening |
| `report_number` | `VARCHAR(50)` | No | — | `UNIQUE`, `NOT NULL` | Human-readable ID (e.g. `RPT-2026-000142`) |
| `generated_by_id` | `UUID` | Yes | `NULL` | `FOREIGN KEY REFERENCES users(id) ON DELETE SET NULL` | User who generated report |
| `report_title` | `VARCHAR(200)` | No | `'Oral Health AI Screening Report'` | | Report header title |
| `summary` | `TEXT` | Yes | `NULL` | | Executive diagnostic summary |
| `report_data` | `JSONB` | No | `'{}'::jsonb` | | Frozen JSON snapshot of all findings at generation |
| `pdf_storage_path` | `TEXT` | Yes | `NULL` | | Firebase Storage path to generated PDF |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Initial compilation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last update timestamp |

- **Indexes**:
  - `CREATE UNIQUE INDEX idx_reports_screening_id ON reports(screening_id);`
  - `CREATE UNIQUE INDEX idx_reports_number ON reports(report_number);`

---

#### 3.16 `dentist_assessments`
Independent professional diagnosis and recommendations entered by licensed dentists.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique assessment ID |
| `screening_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES screenings(id) ON DELETE CASCADE` | Evaluated screening |
| `dentist_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES dentists(id) ON DELETE RESTRICT` | Evaluating dentist |
| `clinical_observations` | `TEXT` | No | — | | Visual/clinical findings by dentist |
| `diagnosis_notes` | `TEXT` | No | — | | Professional diagnosis |
| `treatment_recommendation` | `TEXT` | No | — | | Proposed treatment or follow-up |
| `referral_needed` | `BOOLEAN` | No | `FALSE` | | Urgent specialist referral required |
| `referral_specialty` | `VARCHAR(150)` | Yes | `NULL` | | Specialty referred to (e.g. 'Oral Oncology') |
| `is_finalized` | `BOOLEAN` | No | `FALSE` | | Locks assessment from further edits |
| `finalized_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Finalization timestamp |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last edit timestamp |

- **Indexes**:
  - `CREATE INDEX idx_dentist_assessments_screening ON dentist_assessments(screening_id);`
  - `CREATE INDEX idx_dentist_assessments_dentist ON dentist_assessments(dentist_id);`

---

### Domain 5: Appointments & Teleconsultations

#### 3.17 `dentist_availabilities`
Weekly recurring schedule slots defining when dentists accept consultations.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique availability slot ID |
| `dentist_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES dentists(id) ON DELETE CASCADE` | Associated dentist |
| `day_of_week` | `SMALLINT` | No | — | `CHECK (day_of_week BETWEEN 0 AND 6)` | 0 = Sunday, 1 = Monday, ..., 6 = Saturday |
| `start_time` | `TIME` | No | — | | Window start time |
| `end_time` | `TIME` | No | — | | Window end time |
| `slot_duration_minutes` | `INTEGER` | No | `30` | `CHECK (slot_duration_minutes > 0)` | Length of individual appointment |
| `is_active` | `BOOLEAN` | No | `TRUE` | | Slot active status |

- **Constraints & Indexes**:
  - `CONSTRAINT chk_time_window CHECK (end_time > start_time)`
  - `CREATE INDEX idx_availability_dentist ON dentist_availabilities(dentist_id, day_of_week, is_active);`

---

#### 3.18 `appointments`
Patient-dentist consultation booking requests, schedules, and lifecycle status.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique appointment ID |
| `patient_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES patients(id) ON DELETE CASCADE` | Booking patient |
| `dentist_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES dentists(id) ON DELETE RESTRICT` | Selected dentist |
| `screening_id` | `UUID` | Yes | `NULL` | `FOREIGN KEY REFERENCES screenings(id) ON DELETE SET NULL` | Optional associated screening |
| `scheduled_start` | `TIMESTAMPTZ` | No | — | | Appointment start time |
| `scheduled_end` | `TIMESTAMPTZ` | No | — | | Appointment end time |
| `appointment_type`| `VARCHAR(50)` | No | `'video_teleconsultation'` | `CHECK (appointment_type IN ('video_teleconsultation', 'audio_teleconsultation', 'in_person_consultation', 'follow_up'))` | Mode of consultation |
| `status` | `VARCHAR(30)` | No | `'requested'` | `CHECK (status IN ('requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'))` | Appointment lifecycle state |
| `cancellation_reason` | `TEXT` | Yes | `NULL` | | Reason if cancelled |
| `cancelled_by_id` | `UUID` | Yes | `NULL` | `FOREIGN KEY REFERENCES users(id) ON DELETE SET NULL` | User who initiated cancellation |
| `patient_notes` | `TEXT` | Yes | `NULL` | | Reason for consultation provided by patient |
| `dentist_notes` | `TEXT` | Yes | `NULL` | | Internal dentist prep notes |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Booking creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last status change timestamp |

- **Constraints & Indexes**:
  - `CONSTRAINT chk_appt_time CHECK (scheduled_end > scheduled_start)`
  - `CREATE INDEX idx_appts_patient ON appointments(patient_id, scheduled_start);`
  - `CREATE INDEX idx_appts_dentist ON appointments(dentist_id, scheduled_start);`
  - `CREATE INDEX idx_appts_status ON appointments(status);`

---

#### 3.19 `consultations`
Live teleconsultation session tracking Stream Video/Audio integration metadata.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique consultation ID |
| `appointment_id` | `UUID` | No | — | `UNIQUE`, `FOREIGN KEY REFERENCES appointments(id) ON DELETE CASCADE` | 1-to-1 link to appointment |
| `patient_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES patients(id) ON DELETE CASCADE` | Participating patient |
| `dentist_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES dentists(id) ON DELETE RESTRICT` | Participating dentist |
| `stream_call_id` | `VARCHAR(128)` | No | — | `UNIQUE`, `NOT NULL` | Stream Video Call ID |
| `stream_channel_id` | `VARCHAR(128)` | Yes | `NULL` | | Associated Stream Chat Channel ID |
| `consultation_type`| `VARCHAR(30)` | No | `'video'` | `CHECK (consultation_type IN ('video', 'audio', 'chat'))` | Modality |
| `session_status` | `VARCHAR(30)` | No | `'scheduled'` | `CHECK (session_status IN ('scheduled', 'active', 'ended', 'failed'))` | Live session status |
| `started_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Actual call commencement time |
| `ended_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Call conclusion time |
| `duration_seconds` | `INTEGER` | Yes | `0` | | Total call duration in seconds |
| `clinical_summary` | `TEXT` | Yes | `NULL` | | Summary entered post-consultation |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last update timestamp |

- **Indexes**:
  - `CREATE UNIQUE INDEX idx_consultations_appointment ON consultations(appointment_id);`
  - `CREATE UNIQUE INDEX idx_consultations_call_id ON consultations(stream_call_id);`

---

### Domain 6: Communication & Messaging

#### 3.20 `conversations`
Direct communication channels between patients and authorized dentists.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique conversation channel ID |
| `patient_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES patients(id) ON DELETE CASCADE` | Patient participant |
| `dentist_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES dentists(id) ON DELETE CASCADE` | Dentist participant |
| `stream_channel_id` | `VARCHAR(128)` | No | — | `UNIQUE`, `NOT NULL` | Stream Chat Channel ID |
| `conversation_type` | `VARCHAR(30)` | No | `'direct'` | `CHECK (conversation_type IN ('direct', 'consultation_chat'))` | Scope of channel |
| `is_active` | `BOOLEAN` | No | `TRUE` | | Channel active flag |
| `last_message_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Timestamp of most recent message |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Channel creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Last activity timestamp |

- **Constraints & Indexes**:
  - `CONSTRAINT uq_patient_dentist_conv UNIQUE (patient_id, dentist_id, conversation_type)`
  - `CREATE UNIQUE INDEX idx_conv_stream_channel ON conversations(stream_channel_id);`
  - `CREATE INDEX idx_conv_patient ON conversations(patient_id);`
  - `CREATE INDEX idx_conv_dentist ON conversations(dentist_id);`

---

#### 3.21 `messages`
Individual message records maintaining internal auditability alongside Stream chat.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique message record ID |
| `conversation_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES conversations(id) ON DELETE CASCADE` | Parent conversation |
| `sender_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE` | Author user |
| `stream_message_id` | `VARCHAR(128)` | Yes | `NULL` | | External Stream message ID |
| `message_type` | `VARCHAR(30)` | No | `'text'` | `CHECK (message_type IN ('text', 'image', 'screening_share', 'system'))` | Content format |
| `content` | `TEXT` | No | — | | Message text body |
| `attachment_storage_path` | `TEXT` | Yes | `NULL` | | Firebase Storage path if attachment present |
| `is_read` | `BOOLEAN` | No | `FALSE` | | Read receipt status |
| `read_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Read timestamp |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Message sent timestamp |

- **Indexes**:
  - `CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);`
  - `CREATE INDEX idx_messages_sender ON messages(sender_id);`

---

### Domain 7: Notifications & Audit Logging

#### 3.22 `notifications`
In-app alert inbox for user lifecycle events, bookings, and screening alerts.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique notification ID |
| `user_id` | `UUID` | No | — | `FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE` | Recipient user |
| `notification_type` | `VARCHAR(50)` | No | — | `CHECK (notification_type IN ('screening_completed', 'screening_failed', 'appointment_booked', 'appointment_confirmed', 'appointment_cancelled', 'dentist_verified', 'dentist_assessment_added', 'new_message', 'system_alert'))` | Event category |
| `title` | `VARCHAR(200)` | No | — | | Notification title |
| `message` | `TEXT` | No | — | | Human-readable alert body |
| `action_url` | `VARCHAR(255)` | Yes | `NULL` | | Deep link route in application |
| `is_read` | `BOOLEAN` | No | `FALSE` | | Read status |
| `read_at` | `TIMESTAMPTZ` | Yes | `NULL` | | Read timestamp |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Notification creation timestamp |

- **Indexes**:
  - `CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);`

---

#### 3.23 `audit_logs`
Immutable regulatory and security event log tracking access, modifications, and administrative actions.

| Column | Type | Nullable | Default | Constraints / References | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique audit event ID |
| `user_id` | `UUID` | Yes | `NULL` | `FOREIGN KEY REFERENCES users(id) ON DELETE SET NULL` | Acting user (`NULL` for anonymous/system) |
| `action` | `VARCHAR(100)` | No | — | | Action performed (e.g. `screening.create`, `dentist.verify`, `record.access`) |
| `resource_type` | `VARCHAR(100)` | No | — | | Target entity type (`screenings`, `dentists`, `users`) |
| `resource_id` | `VARCHAR(128)` | Yes | `NULL` | | Target entity ID |
| `ip_address` | `VARCHAR(45)` | Yes | `NULL` | | Client IPv4/IPv6 address |
| `user_agent` | `VARCHAR(255)` | Yes | `NULL` | | Client browser / device user agent |
| `details` | `JSONB` | Yes | `'{}'::jsonb` | | Sanitized context metadata (no secrets/passwords) |
| `timestamp` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | | Event occurrence timestamp |

- **Indexes**:
  - `CREATE INDEX idx_audit_user_id ON audit_logs(user_id, timestamp DESC);`
  - `CREATE INDEX idx_audit_action ON audit_logs(action, timestamp DESC);`
  - `CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);`
  - `CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);`
