# OraVisionAI — Database Data Dictionary

This document provides a field-level dictionary for all 23 entities in the **OraVisionAI** database schema, detailing semantics, constraints, and privacy/security classifications.

---

## Data Privacy & Security Classifications

- **PII (Personally Identifiable Information)**: Name, email, phone, address, date of birth. Must be encrypted in transit and access-restricted.
- **PHI (Protected Health Information)**: Medical history, allergies, dental conditions, screening images, AI predictions, XAI maps, dentist assessments. Protected by strict role authorization.
- **Internal / Operational**: System IDs, timestamps, status flags, technical inference metrics.
- **Public**: Model registry metadata, general clinic addresses, verified dentist bios.

---

## 1. Domain: Identity, Users, Roles & Relationships

### 1.1 `users`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Immutable system-wide unique identifier for the account |
| `firebase_uid` | `VARCHAR(128)` | Yes | `UNIQUE`, `NOT NULL` | Sensitive | External identity token subject identifier issued by Firebase Auth |
| `email` | `VARCHAR(255)` | Yes | `UNIQUE`, `NOT NULL` | PII | Primary login and notification email address |
| `role` | `VARCHAR(20)` | Yes | `CHECK (role IN ('patient', 'dentist', 'admin'))` | Internal | Access control role determining platform capabilities |
| `first_name` | `VARCHAR(100)` | Yes | `NOT NULL` | PII | User's legal first name |
| `last_name` | `VARCHAR(100)` | Yes | `NOT NULL` | PII | User's legal family/last name |
| `phone_number` | `VARCHAR(30)` | No | `NULL` | PII | International contact phone number |
| `avatar_url` | `TEXT` | No | `NULL` | Public | Firebase Storage public/signed URL to user profile avatar |
| `is_active` | `BOOLEAN` | Yes | `DEFAULT TRUE` | Internal | Flag allowing administrative suspension/deactivation |
| `is_email_verified` | `BOOLEAN` | Yes | `DEFAULT FALSE` | Internal | Synchronized status of Firebase email verification |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Account registration timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Profile modification timestamp |

---

### 1.2 `patients`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique patient profile ID |
| `user_id` | `UUID` | Yes | `FK users(id) ON DELETE CASCADE`, `UNIQUE` | Internal | 1-to-1 association with root `users` account |
| `date_of_birth` | `DATE` | No | `NULL` | PII / PHI | Patient birth date used for age-adjusted risk modeling |
| `gender` | `VARCHAR(30)` | No | `CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'))` | PII / PHI | Gender identity |
| `emergency_contact_name` | `VARCHAR(150)` | No | `NULL` | PII | Name of next-of-kin or primary emergency contact |
| `emergency_contact_phone`| `VARCHAR(30)` | No | `NULL` | PII | Phone number of emergency contact |
| `address` | `TEXT` | No | `NULL` | PII | Residential mailing address |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Record update timestamp |

---

### 1.3 `patient_medical_profiles`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique medical profile identifier |
| `patient_id` | `UUID` | Yes | `FK patients(id) ON DELETE CASCADE`, `UNIQUE` | Internal | 1-to-1 association with patient |
| `medical_history` | `JSONB` | Yes | `DEFAULT '[]'::jsonb` | PHI | Structured list of systemic conditions (hypertension, diabetes, etc.) |
| `dental_history` | `JSONB` | Yes | `DEFAULT '[]'::jsonb` | PHI | Past dental surgeries, periodontal treatments, restorations |
| `allergies` | `JSONB` | Yes | `DEFAULT '[]'::jsonb` | PHI | Clinical drug allergies (Penicillin, Latex, NSAIDs) |
| `current_medications` | `JSONB` | Yes | `DEFAULT '[]'::jsonb` | PHI | Active prescriptions and over-the-counter medications |
| `smoking_status` | `VARCHAR(50)` | No | `CHECK (smoking_status IN ('never', 'former', 'occasional', 'regular', 'heavy'))` | PHI | Tobacco consumption risk factor |
| `alcohol_consumption` | `VARCHAR(50)` | No | `CHECK (alcohol_consumption IN ('none', 'occasional', 'moderate', 'frequent'))` | PHI | Alcohol consumption frequency |
| `betel_quid_user` | `BOOLEAN` | Yes | `DEFAULT FALSE` | PHI | Betel nut/areca consumption (critical oral cancer risk factor) |
| `additional_notes` | `TEXT` | No | `NULL` | PHI | Supplementary patient-provided health notes |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Record update timestamp |

---

### 1.4 `dentists`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique dentist profile ID |
| `user_id` | `UUID` | Yes | `FK users(id) ON DELETE CASCADE`, `UNIQUE` | Internal | 1-to-1 association with root `users` account |
| `license_number` | `VARCHAR(100)` | Yes | `UNIQUE`, `NOT NULL` | PII / Public | Official dental regulatory board registration number |
| `specialization` | `VARCHAR(150)` | Yes | `DEFAULT 'General Dentistry'` | Public | Field of specialization (e.g. Orthodontics, Oral Pathology) |
| `clinic_name` | `VARCHAR(200)` | No | `NULL` | Public | Primary dental practice/hospital name |
| `clinic_address` | `TEXT` | No | `NULL` | Public | Practice physical address |
| `years_of_experience` | `INTEGER` | Yes | `CHECK (years_of_experience >= 0)` | Public | Total years in clinical practice |
| `bio` | `TEXT` | No | `NULL` | Public | Professional background summary displayed to patients |
| `verification_status` | `VARCHAR(30)` | Yes | `CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended'))` | Internal | Regulatory verification state managed by administrators |
| `verified_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Timestamp when admin granted approval |
| `verified_by_id` | `UUID` | No | `FK users(id) ON DELETE SET NULL` | Internal | Admin user ID responsible for approval |
| `rejection_reason` | `TEXT` | No | `NULL` | Sensitive | Feedback provided if verification was declined |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Registration timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Profile update timestamp |

---

### 1.5 `dentist_verifications`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique document verification entry ID |
| `dentist_id` | `UUID` | Yes | `FK dentists(id) ON DELETE CASCADE` | Internal | Reference to applicant dentist |
| `document_type` | `VARCHAR(100)` | Yes | `NOT NULL` | Sensitive | Document category (`license_certificate`, `medical_degree`, `id_proof`) |
| `document_url` | `TEXT` | Yes | `NOT NULL` | Sensitive | Firebase Storage path to secure credential scan |
| `file_name` | `VARCHAR(255)` | Yes | `NOT NULL` | Sensitive | Original uploaded filename |
| `file_size_bytes` | `BIGINT` | No | `NULL` | Internal | File size in bytes |
| `status` | `VARCHAR(30)` | Yes | `CHECK (status IN ('pending', 'approved', 'rejected'))` | Internal | Individual document review status |
| `reviewer_id` | `UUID` | No | `FK users(id) ON DELETE SET NULL` | Internal | Admin reviewer ID |
| `review_notes` | `TEXT` | No | `NULL` | Sensitive | Administrator compliance review notes |
| `submitted_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Submission timestamp |
| `reviewed_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Review completion timestamp |

---

### 1.6 `patient_dentist_relationships`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique relationship mapping ID |
| `patient_id` | `UUID` | Yes | `FK patients(id) ON DELETE CASCADE` | Internal | Reference to patient |
| `dentist_id` | `UUID` | Yes | `FK dentists(id) ON DELETE CASCADE` | Internal | Reference to dentist |
| `status` | `VARCHAR(30)` | Yes | `CHECK (status IN ('active', 'pending_consent', 'revoked', 'archived'))` | Internal | Authorization status granting dentist access to patient records |
| `established_via` | `VARCHAR(50)` | Yes | `CHECK (established_via IN ('appointment', 'direct_invite', 'screening_share'))` | Internal | Origin mechanism for relationship |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Consent establishment timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Last status update timestamp |

---

## 2. Domain: Screening & Images

### 2.1 `screenings`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique screening session identifier |
| `patient_id` | `UUID` | Yes | `FK patients(id) ON DELETE CASCADE` | Internal | Patient owning this screening |
| `created_by_id` | `UUID` | Yes | `FK users(id) ON DELETE RESTRICT` | Internal | Submitting user ID (patient self-screening or dentist on-premise) |
| `status` | `VARCHAR(30)` | Yes | `CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed'))` | Internal | End-to-end pipeline execution status |
| `clinical_notes` | `TEXT` | No | `NULL` | PHI | Patient-described symptoms, pain levels, or observation notes |
| `error_message` | `TEXT` | No | `NULL` | Internal | Detailed pipeline error message if status is `failed` |
| `is_deleted` | `BOOLEAN` | Yes | `DEFAULT FALSE` | Internal | Soft deletion flag to respect patient deletion while retaining auditability |
| `deleted_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Soft deletion timestamp |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Screening creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Last modification timestamp |

---

### 2.2 `screening_images`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique image record ID |
| `screening_id` | `UUID` | Yes | `FK screenings(id) ON DELETE CASCADE` | Internal | Associated screening session |
| `storage_path` | `TEXT` | Yes | `NOT NULL` | PHI / Sensitive | Firebase Storage path (e.g. `screenings/{patient_id}/{screening_id}/image1.jpg`) |
| `file_name` | `VARCHAR(255)` | Yes | `NOT NULL` | Internal | Original image filename from client |
| `file_size_bytes` | `BIGINT` | Yes | `NOT NULL` | Internal | Size in bytes |
| `mime_type` | `VARCHAR(100)` | Yes | `DEFAULT 'image/jpeg'` | Internal | Image MIME format (`image/jpeg`, `image/png`) |
| `image_width` | `INTEGER` | No | `NULL` | Internal | Width resolution in pixels |
| `image_height` | `INTEGER` | No | `NULL` | Internal | Height resolution in pixels |
| `image_sha256` | `VARCHAR(64)` | No | `NULL` | Internal | SHA-256 hash for forensic image integrity verification |
| `is_primary` | `BOOLEAN` | Yes | `DEFAULT TRUE` | Internal | Primary image flag for multi-image screening protocols |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Upload timestamp |

---

## 3. Domain: AI Inference, XAI & Models

### 3.1 `ai_models`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique AI model registration ID |
| `name` | `VARCHAR(100)` | Yes | `NOT NULL` | Public | System name (`OraVisionAI-EfficientNetB0`, `OraVisionAI-YOLOv8`) |
| `model_type` | `VARCHAR(50)` | Yes | `CHECK (model_type IN ('classifier', 'detector', 'multimodal', 'risk_engine'))` | Internal | Task domain |
| `version` | `VARCHAR(50)` | Yes | `NOT NULL` | Public | Semantic version identifier (`1.0.0-verified`) |
| `architecture` | `VARCHAR(100)` | Yes | `NOT NULL` | Public | Underlying neural architecture |
| `weights_path` | `TEXT` | No | `NULL` | Sensitive | Local or storage artifact path to weights file |
| `input_shape` | `VARCHAR(50)` | Yes | `DEFAULT '224x224x3'` | Internal | Required tensor input dimension format |
| `class_labels` | `JSONB` | Yes | `DEFAULT '[]'::jsonb` | Public | Ordered array of supported classification label names |
| `target_layers` | `JSONB` | No | `'[]'::jsonb` | Internal | Validated CNN layers for XAI activation mapping |
| `is_active` | `BOOLEAN` | Yes | `DEFAULT TRUE` | Internal | Production availability flag |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Model registration timestamp |

---

### 3.2 `ai_predictions`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique classification inference ID |
| `screening_id` | `UUID` | Yes | `FK screenings(id) ON DELETE CASCADE` | Internal | Associated screening session |
| `screening_image_id` | `UUID` | Yes | `FK screening_images(id) ON DELETE CASCADE` | Internal | Image evaluated during this inference run |
| `ai_model_id` | `UUID` | Yes | `FK ai_models(id) ON DELETE RESTRICT` | Internal | Reference to model version that generated prediction |
| `predicted_class` | `VARCHAR(100)` | Yes | `NOT NULL` | PHI | Predicted primary oral condition (e.g. `Caries`, `Gingivitis`, `Normal`) |
| `confidence` | `NUMERIC(5, 4)`| Yes | `CHECK (confidence BETWEEN 0.0 AND 1.0)` | PHI | Softmax confidence score for top prediction |
| `inference_duration_ms` | `INTEGER` | No | `NULL` | Internal | Processing latency in milliseconds |
| `status` | `VARCHAR(30)` | Yes | `CHECK (status IN ('processing', 'completed', 'failed'))` | Internal | Inference execution status |
| `raw_output` | `JSONB` | No | `NULL` | Internal | Complete raw probability/logit dictionary |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Inference execution timestamp |

---

### 3.3 `prediction_probabilities`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique probability entry ID |
| `ai_prediction_id` | `UUID` | Yes | `FK ai_predictions(id) ON DELETE CASCADE` | Internal | Parent classification inference |
| `class_name` | `VARCHAR(100)` | Yes | `NOT NULL` | PHI | Class label name (one of the 7 evaluated conditions) |
| `probability` | `NUMERIC(5, 4)`| Yes | `CHECK (probability BETWEEN 0.0 AND 1.0)` | PHI | Softmax probability assigned to this class (0.0000–1.0000) |
| `class_index` | `SMALLINT` | Yes | `NOT NULL` | Internal | Output node index corresponding to model output tensor |

---

### 3.4 `yolo_detections`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique lesion detection ID |
| `screening_id` | `UUID` | Yes | `FK screenings(id) ON DELETE CASCADE` | Internal | Associated screening session |
| `screening_image_id` | `UUID` | Yes | `FK screening_images(id) ON DELETE CASCADE` | Internal | Input image containing detected lesion |
| `ai_model_id` | `UUID` | Yes | `FK ai_models(id) ON DELETE RESTRICT` | Internal | YOLO model version used |
| `detected_class` | `VARCHAR(100)` | Yes | `NOT NULL` | PHI | Detected oral lesion category (e.g. `ulcer`, `plaque`, `lesion`) |
| `confidence` | `NUMERIC(5, 4)`| Yes | `CHECK (confidence BETWEEN 0.0 AND 1.0)` | PHI | Bounding box object confidence score |
| `bbox_x_min` | `NUMERIC(7, 4)`| Yes | `CHECK (bbox_x_min BETWEEN 0.0 AND 1.0)` | PHI | Normalized top-left horizontal coordinate |
| `bbox_y_min` | `NUMERIC(7, 4)`| Yes | `CHECK (bbox_y_min BETWEEN 0.0 AND 1.0)` | PHI | Normalized top-left vertical coordinate |
| `bbox_x_max` | `NUMERIC(7, 4)`| Yes | `CHECK (bbox_x_max BETWEEN 0.0 AND 1.0)` | PHI | Normalized bottom-right horizontal coordinate |
| `bbox_y_max` | `NUMERIC(7, 4)`| Yes | `CHECK (bbox_y_max BETWEEN 0.0 AND 1.0)` | PHI | Normalized bottom-right vertical coordinate |
| `detection_metadata`| `JSONB` | No | `NULL` | Internal | Supplementary bounding box geometric metrics |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Detection timestamp |

---

### 3.5 `risk_assessments`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique risk assessment ID |
| `screening_id` | `UUID` | Yes | `FK screenings(id) ON DELETE CASCADE`, `UNIQUE` | Internal | Associated screening session |
| `ai_prediction_id` | `UUID` | No | `FK ai_predictions(id) ON DELETE SET NULL` | Internal | Underlying classification prediction reference |
| `risk_level` | `VARCHAR(30)` | Yes | `CHECK (risk_level IN ('low', 'moderate', 'high', 'critical'))` | PHI | Triage risk category |
| `risk_score` | `NUMERIC(5, 2)`| Yes | `CHECK (risk_score BETWEEN 0.0 AND 100.0)` | PHI | Synthesized numerical oral health risk score (0–100) |
| `contributing_factors`| `JSONB` | Yes | `DEFAULT '[]'::jsonb` | PHI | Array of clinical/AI risk drivers (e.g. "Severe Caries", "Betel Quid User") |
| `summary` | `TEXT` | Yes | `NOT NULL` | PHI | Plain-language risk explanation for patients |
| `recommended_action` | `TEXT` | Yes | `NOT NULL` | PHI | Clinical next step (e.g. "Schedule urgent consultation within 48h") |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Assessment calculation timestamp |

---

### 3.6 `xai_results`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique XAI result record ID |
| `ai_prediction_id` | `UUID` | Yes | `FK ai_predictions(id) ON DELETE CASCADE` | Internal | Prediction being visually explained |
| `screening_image_id` | `UUID` | Yes | `FK screening_images(id) ON DELETE CASCADE` | Internal | Source image evaluated |
| `method` | `VARCHAR(50)` | Yes | `CHECK (method IN ('grad_cam', 'occlusion_sensitivity', 'score_cam', 'grad_cam_plus_plus', 'layer_cam', 'integrated_gradients'))` | Internal | XAI algorithm applied |
| `target_layer` | `VARCHAR(100)` | No | `NULL` | Internal | CNN feature layer targeted (e.g. `block6a_expand_conv`) |
| `is_primary_user_facing`| `BOOLEAN`| Yes | `DEFAULT FALSE` | Internal | `TRUE` for Occlusion Sensitivity and Grad-CAM; `FALSE` for secondary methods |
| `heatmap_storage_path` | `TEXT` | Yes | `NOT NULL` | PHI | Firebase Storage URI for floating-point attention matrix / grayscale heatmap |
| `overlay_image_storage_path`| `TEXT`| Yes | `NOT NULL` | PHI | Firebase Storage URI for colorized heatmap blended over original oral image |
| `parameters` | `JSONB` | No | `NULL` | Internal | Execution hyper-parameters (patch size, stride, target class index) |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | XAI generation timestamp |

---

## 4. Domain: Clinical Reports & Dentist Reviews

### 4.1 `reports`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique report ID |
| `screening_id` | `UUID` | Yes | `FK screenings(id) ON DELETE CASCADE`, `UNIQUE` | Internal | Associated screening session |
| `report_number` | `VARCHAR(50)` | Yes | `UNIQUE`, `NOT NULL` | PHI | Patient-facing serial number (e.g. `RPT-2026-000412`) |
| `generated_by_id` | `UUID` | No | `FK users(id) ON DELETE SET NULL` | Internal | User ID who requested PDF generation |
| `report_title` | `VARCHAR(200)` | Yes | `DEFAULT 'Oral Health AI Screening Report'` | PHI | Report title heading |
| `summary` | `TEXT` | No | `NULL` | PHI | Executive diagnostic synthesis |
| `report_data` | `JSONB` | Yes | `DEFAULT '{}'::jsonb` | PHI | Immutable snapshot of all patient, AI, and doctor data at report generation time |
| `pdf_storage_path` | `TEXT` | No | `NULL` | PHI | Firebase Storage path to compiled PDF document |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Initial report compilation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Last modification timestamp |

---

### 4.2 `dentist_assessments`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique clinical assessment ID |
| `screening_id` | `UUID` | Yes | `FK screenings(id) ON DELETE CASCADE` | Internal | Screening evaluated by practitioner |
| `dentist_id` | `UUID` | Yes | `FK dentists(id) ON DELETE RESTRICT` | Internal | Evaluating dentist |
| `clinical_observations`| `TEXT` | Yes | `NOT NULL` | PHI | Dentist's clinical observations of oral cavity |
| `diagnosis_notes` | `TEXT` | Yes | `NOT NULL` | PHI | Professional clinical diagnosis |
| `treatment_recommendation`| `TEXT`| Yes | `NOT NULL` | PHI | Suggested dental treatment or procedures |
| `referral_needed` | `BOOLEAN` | Yes | `DEFAULT FALSE` | PHI | Flag indicating urgent referral to specialist/hospital |
| `referral_specialty` | `VARCHAR(150)` | No | `NULL` | PHI | Specialty referred to (e.g. `Oral & Maxillofacial Surgery`) |
| `is_finalized` | `BOOLEAN` | Yes | `DEFAULT FALSE` | Internal | If `TRUE`, locks notes from further modification |
| `finalized_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Timestamp of signature / finalization |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Last update timestamp |

---

## 5. Domain: Appointments & Teleconsultations

### 5.1 `dentist_availabilities`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique availability window ID |
| `dentist_id` | `UUID` | Yes | `FK dentists(id) ON DELETE CASCADE` | Internal | Associated dentist |
| `day_of_week` | `SMALLINT` | Yes | `CHECK (day_of_week BETWEEN 0 AND 6)` | Public | Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) |
| `start_time` | `TIME` | Yes | `NOT NULL` | Public | Shift start time |
| `end_time` | `TIME` | Yes | `NOT NULL` | Public | Shift end time (must be > `start_time`) |
| `slot_duration_minutes` | `INTEGER`| Yes | `DEFAULT 30, CHECK (slot_duration_minutes > 0)` | Public | Standard consultation duration |
| `is_active` | `BOOLEAN` | Yes | `DEFAULT TRUE` | Public | Availability slot active toggle |

---

### 5.2 `appointments`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique appointment booking ID |
| `patient_id` | `UUID` | Yes | `FK patients(id) ON DELETE CASCADE` | Internal | Patient requesting consultation |
| `dentist_id` | `UUID` | Yes | `FK dentists(id) ON DELETE RESTRICT` | Internal | Dentist conducting consultation |
| `screening_id` | `UUID` | No | `FK screenings(id) ON DELETE SET NULL` | Internal | Optional screening linked to this appointment |
| `scheduled_start` | `TIMESTAMPTZ` | Yes | `NOT NULL` | PHI / PII | Consultation start time |
| `scheduled_end` | `TIMESTAMPTZ` | Yes | `NOT NULL` | PHI / PII | Consultation end time |
| `appointment_type`| `VARCHAR(50)` | Yes | `CHECK (appointment_type IN ('video_teleconsultation', 'audio_teleconsultation', 'in_person_consultation', 'follow_up'))` | PHI | Mode of consultation |
| `status` | `VARCHAR(30)` | Yes | `CHECK (status IN ('requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'))` | Internal | Appointment lifecycle state |
| `cancellation_reason` | `TEXT` | No | `NULL` | PHI | Reason given if appointment is cancelled |
| `cancelled_by_id` | `UUID` | No | `FK users(id) ON DELETE SET NULL` | Internal | User who initiated cancellation |
| `patient_notes` | `TEXT` | No | `NULL` | PHI | Patient reason for consultation request |
| `dentist_notes` | `TEXT` | No | `NULL` | PHI | Private preparation notes by dentist |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Booking timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Status update timestamp |

---

### 5.3 `consultations`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique teleconsultation session ID |
| `appointment_id` | `UUID` | Yes | `FK appointments(id) ON DELETE CASCADE`, `UNIQUE` | Internal | 1-to-1 link to parent appointment |
| `patient_id` | `UUID` | Yes | `FK patients(id) ON DELETE CASCADE` | Internal | Attending patient |
| `dentist_id` | `UUID` | Yes | `FK dentists(id) ON DELETE RESTRICT` | Internal | Attending dentist |
| `stream_call_id` | `VARCHAR(128)` | Yes | `UNIQUE`, `NOT NULL` | Sensitive | External Stream Video Call room identifier |
| `stream_channel_id` | `VARCHAR(128)`| No | `NULL` | Sensitive | External Stream Chat channel identifier |
| `consultation_type`| `VARCHAR(30)` | Yes | `CHECK (consultation_type IN ('video', 'audio', 'chat'))` | Internal | Consultation modality |
| `session_status` | `VARCHAR(30)` | Yes | `CHECK (session_status IN ('scheduled', 'active', 'ended', 'failed'))` | Internal | Real-time session state |
| `started_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Call commencement timestamp |
| `ended_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Call completion timestamp |
| `duration_seconds` | `INTEGER` | Yes | `DEFAULT 0` | Internal | Total active duration of consultation |
| `clinical_summary` | `TEXT` | No | `NULL` | PHI | Post-call summary notes |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Status change timestamp |

---

## 6. Domain: Communication & Messaging

### 6.1 `conversations`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique conversation channel ID |
| `patient_id` | `UUID` | Yes | `FK patients(id) ON DELETE CASCADE` | Internal | Participating patient |
| `dentist_id` | `UUID` | Yes | `FK dentists(id) ON DELETE CASCADE` | Internal | Participating dentist |
| `stream_channel_id` | `VARCHAR(128)` | Yes | `UNIQUE`, `NOT NULL` | Sensitive | External Stream Chat channel ID |
| `conversation_type` | `VARCHAR(30)` | Yes | `CHECK (conversation_type IN ('direct', 'consultation_chat'))` | Internal | Channel scope |
| `is_active` | `BOOLEAN` | Yes | `DEFAULT TRUE` | Internal | Channel active state |
| `last_message_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Timestamp of latest message (used for inbox sorting) |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Update timestamp |

---

### 6.2 `messages`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique message ID |
| `conversation_id` | `UUID` | Yes | `FK conversations(id) ON DELETE CASCADE` | Internal | Parent conversation thread |
| `sender_id` | `UUID` | Yes | `FK users(id) ON DELETE CASCADE` | Internal | Author user ID |
| `stream_message_id`| `VARCHAR(128)` | No | `NULL` | Internal | Synchronized Stream message ID |
| `message_type` | `VARCHAR(30)` | Yes | `CHECK (message_type IN ('text', 'image', 'screening_share', 'system'))` | Internal | Message content payload format |
| `content` | `TEXT` | Yes | `NOT NULL` | PHI / PII | Message text body |
| `attachment_storage_path` | `TEXT` | No | `NULL` | PHI / Sensitive | Firebase Storage path if file/image attached |
| `is_read` | `BOOLEAN` | Yes | `DEFAULT FALSE` | Internal | Read receipt flag |
| `read_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Read receipt timestamp |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Message dispatch timestamp |

---

## 7. Domain: Notifications & Audit Logging

### 7.1 `notifications`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique notification ID |
| `user_id` | `UUID` | Yes | `FK users(id) ON DELETE CASCADE` | Internal | Target recipient user |
| `notification_type` | `VARCHAR(50)` | Yes | `CHECK (notification_type IN ('screening_completed', 'screening_failed', 'appointment_booked', 'appointment_confirmed', 'appointment_cancelled', 'dentist_verified', 'dentist_assessment_added', 'new_message', 'system_alert'))` | Internal | Event type category |
| `title` | `VARCHAR(200)` | Yes | `NOT NULL` | Internal | Notification title header |
| `message` | `TEXT` | Yes | `NOT NULL` | PHI / PII | Human-readable notification summary |
| `action_url` | `VARCHAR(255)` | No | `NULL` | Internal | Frontend navigation route |
| `is_read` | `BOOLEAN` | Yes | `DEFAULT FALSE` | Internal | Read status flag |
| `read_at` | `TIMESTAMPTZ` | No | `NULL` | Internal | Read receipt timestamp |
| `created_at` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Notification creation timestamp |

---

### 7.2 `audit_logs`
| Field Name | Type | Required | Constraints | Privacy Level | Semantic Meaning & Security Notes |
|---|---|---|---|---|---|
| `id` | `UUID` | Yes | `PK`, `DEFAULT gen_random_uuid()` | Internal | Unique audit event ID |
| `user_id` | `UUID` | No | `FK users(id) ON DELETE SET NULL` | Internal | Acting user (`NULL` if unauthenticated/system action) |
| `action` | `VARCHAR(100)` | Yes | `NOT NULL` | Internal | Security/business action performed (`screening.create`, `dentist.verify`, `record.access`) |
| `resource_type` | `VARCHAR(100)` | Yes | `NOT NULL` | Internal | Affected database table / domain |
| `resource_id` | `VARCHAR(128)` | No | `NULL` | Internal | ID of affected entity |
| `ip_address` | `VARCHAR(45)` | No | `NULL` | PII / Sensitive | Client IPv4 or IPv6 network address |
| `user_agent` | `VARCHAR(255)` | No | `NULL` | Internal | Browser / Client User-Agent string |
| `details` | `JSONB` | Yes | `DEFAULT '{}'::jsonb` | Internal / Sanitized | Sanitized context payload. **Must NEVER contain passwords or secrets.** |
| `timestamp` | `TIMESTAMPTZ` | Yes | `DEFAULT CURRENT_TIMESTAMP` | Internal | Immutable event timestamp |
