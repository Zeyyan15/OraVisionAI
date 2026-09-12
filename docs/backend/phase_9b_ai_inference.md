# OraVisionAI — Phase 9B: AI Inference Service Architecture

## 1. Overview & Architecture

Phase 9B integrates the **AI Inference Service** for the OraVisionAI backend, connecting uploaded patient screening photographs with the validated **7-class EfficientNetB0 oral lesion classifier** and **OraVisionAI YOLO lesion detector**.

```
Patient Screening Image (PostgreSQL screening_images)
                 │
                 ▼
StorageService (Download from Firebase Storage)
                 │
                 ▼
Image Preprocessing Pipeline (Resize 224×224×3, RGB float32, EfficientNet Normalization)
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
EfficientNetB0        OraVisionAI YOLO
  Classifier              Detector
       │                   │
       ▼                   ▼
7-Class Probability     Spatial Bounding Boxes
  Vector & Label        (Normalized [0.0, 1.0])
       │                   │
       └─────────┬─────────┘
                 │
                 ▼
Database Persistence Transaction (PostgreSQL)
  ├── AIModel Registry (Traceable Versioning)
  ├── AIPrediction Record
  ├── 7× PredictionProbability Records
  └── N× YOLODetection Records
                 │
                 ▼
Screening Status: "completed"
```

---

## 2. Authoritative 7-Class Oral Taxonomy (7Teeth Dataset)

The authoritative class taxonomy originates from the validated research transfer learning notebooks (`7Teeth_TransferLearning.ipynb` / `OravisionAI_7TeethDataset_EDA.ipynb`):

| Class Index | Class Code | Class Name | Clinical Category |
|---|---|---|---|
| `0` | `CaS` | **Canker Sore** | Aphthous Ulceration / Benign Mucosal Defect |
| `1` | `CoS` | **Cold Sore** | Herpes Simplex / Vesicular Lesion |
| `2` | `Gum` | **Gum Disease** | Periodontal / Gingival Inflammation |
| `3` | `MC` | **Mucocele** | Salivary Extravasation Cyst |
| `4` | `OC` | **Oral Cancer** | Oral Squamous Cell Carcinoma (OSCC) |
| `5` | `OLP` | **Oral Lichen Planus** | Oral Potentially Malignant Disorder (OPMD) |
| `6` | `OT` | **Oral Thrush** | Oral Candidiasis / Fungal Overgrowth |

---

## 3. Preprocessing Pipeline

- **Source Input**: JPEG, PNG, or WEBP oral photographs.
- **Decoding & Normalization**:
  - Decode raw binary image data into standard RGB.
  - Bilinear resize to strict target shape: `224 × 224 × 3`.
  - Convert to float32 NumPy array batch of shape `(1, 224, 224, 3)`.
  - Apply TensorFlow Keras `preprocess_input` for EfficientNet.

---

## 4. Model Registry & Version Traceability

Every AI prediction and YOLO detection is explicitly tied to an entry in `ai_models`:

- **Classifier Record**:
  - `name`: `OravisionAI_7Teeth_EfficientNetB0`
  - `model_type`: `classifier`
  - `version`: `v1.0`
  - `architecture`: `EfficientNetB0`
  - `input_shape`: `224x224x3`
  - `class_labels`: `["Canker Sore", "Cold Sore", "Gum Disease", "Mucocele", "Oral Cancer", "Oral Lichen Planus", "Oral Thrush"]`
- **Detector Record**:
  - `name`: `OravisionAI_YOLO`
  - `model_type`: `detector`
  - `version`: `v1.0`
  - `architecture`: `YOLO`
  - `input_shape`: `Variable`
  - `class_labels`: `["Lesion", "Abnormality"]`

Historical predictions remain immutable and permanently linked to the model version that generated them.

---

## 5. Persistence Hierarchy & Data Integrity

For every screening photograph analyzed:
1. `ai_predictions`: Single header record storing `predicted_class`, `confidence`, `inference_duration_ms`, `ai_model_id`, and `status = "completed"`.
2. `prediction_probabilities`: Exactly 7 records inserted per prediction, corresponding to the entire probability distribution with range `0.0 <= probability <= 1.0`.
3. `yolo_detections`: $N$ detection records ($N \ge 0$) storing detected class names, detection confidence, and normalized bounding box coordinates ($0.0 \le x_{min}, y_{min}, x_{max}, y_{max} \le 1.0$).
4. `screenings.status`: Transitioned from `"uploading"`/`"pending"` to `"completed"`.

All operations occur inside a single atomic database transaction. If any step fails, the entire transaction is rolled back (`db.rollback()`), preventing partial or corrupted diagnostic records.

---

## 6. Re-run & Idempotency Behavior

- When `POST /api/screenings/{id}/run-ai` is requested for a screening that has already completed inference:
  - If `force_recompute=False` (default): The service reconstructs and returns the existing completed diagnostic results from PostgreSQL without redundant model computation or duplicate database inserts.
  - If `force_recompute=True`: A new diagnostic run is executed and appended.

---

## 7. Security, Ownership & Error Handling

- **Patient Ownership Enforcement**: Screening ownership is verified against the authenticated patient profile before loading images or running models (`Screening.patient_id == authenticated_patient.id`). Cross-patient requests immediately return `404 Not Found`.
- **Role Isolation**: Only patients can trigger self-service AI inference (`require_patient`). Dentists and administrators receive `403 Forbidden`.
- **Controlled Error Handling**: Missing model weights return `503 Service Unavailable` with a controlled diagnostic message, preventing server crashes and avoiding leakage of internal server paths.

---

## 8. Real-Model Inference Results & Status

- **Model Weight Artifacts Status**:
  - The model weight files (`best_7teeth_efficientnetb0_verified.keras` and `oravisionai_yolo.pt`) are maintained externally outside the Git repository.
  - *Statement*: Real model inference on hardware was simulated and verified via unit tests, as the local weight files are configured via environment paths (`CLASSIFIER_MODEL_PATH` and `YOLO_MODEL_PATH`).
- **Unit & Integration Testing**: 100% of pipeline tests passed, including syntax, schema preservation (23 tables), 401/403 security guards, preprocessing shape validation, 7-class taxonomy verification, transaction rollback, and idempotent caching.
