# OraVisionAI — Phase 12: Clinical Context & Screening Triage Subsystem

## 1. Overview & Architecture

Phase 12 implements the **Clinical Context & Screening Triage Subsystem** for the OraVisionAI backend. Operating as a deterministic decision-support layer, the subsystem synthesizes already-generated AI classification outputs, spatial YOLO lesion localizations, self-reported patient lifestyle context, and demographic age context into an objective, explainable screening priority tier (`low`, `moderate`, `high`, `critical`) and an associated technical tier index (`risk_score`).

```
Screening Session (PostgreSQL screenings)
  ├── 7-Class AI Classification (ai_predictions)
  ├── Spatial YOLO Detections (yolo_detections)
  ├── Patient Medical & Lifestyle Profile (patient_medical_profiles)
  └── Patient Demographics (patients.date_of_birth)
                 │
                 ▼
Clinical Context Engine (Strict Priority Waterfall)
  ├── 1. Primary finding of Oral Cancer (OC) ───────────────────────────> CRITICAL
  ├── 2. Primary finding of Oral Lichen Planus (OLP) OR Multiple Exposures > HIGH
  ├── 3. Primary finding of Gum/OT OR Single Established Exposure ──────> MODERATE
  ├── 4. Patient Age >= 50 with Qualifying Oral Finding ────────────────> MODERATE
  └── 5. Otherwise / No Flagged High-Risk Context ──────────────────────> LOW
                 │
                 ▼
Factual Evidence Aggregation (`contributing_factors` JSONB)
  ├── AI Classification & Model Confidence Observation
  ├── YOLO Spatial Localization Observation
  ├── Documented Lifestyle Exposure Observation
  └── Demographic Age Observation
                 │
                 ▼
Technical Tier Index Assignment (`risk_score` NUMERIC(5, 2))
  ├── low: 25.00
  ├── moderate: 50.00
  ├── high: 75.00
  └── critical: 100.00
                 │
                 ▼
PostgreSQL Transaction Persistence (`risk_assessments` table record)
                 │
                 ▼
Immutable Audit Log Entry (`RISK_ASSESSMENT_GENERATED` in `audit_logs`)
                 │
                 ▼
Clinical Report Integration (`reports` frozen snapshot & ReportLab PDF)
```

---

## 2. Clinical Context Engine Hierarchy & Precedence

The engine evaluates screening context using a strict waterfall order. No arbitrary medical points, point-addition formulas, or disease risk probabilities are computed.

| Priority | Context Tier | Trigger Criteria | Resulting `risk_level` | Technical Tier Index (`risk_score`) | Triage Action Framing |
|:---:|---|---|:---:|:---:|---|
| **1** | **Warning Signs** | Primary AI classification is `Oral Cancer` (`OC`) | **`critical`** | `100.00` | Prompt specialist dental evaluation recommended. Seek immediate clinical assessment with an oral maxillofacial specialist or hospital dental clinic. |
| **2** | **High Clinical Vigilance / Multiple Exposures** | Primary AI classification is `Oral Lichen Planus` (`OLP`)<br>**OR** $\ge 2$ active documented exposures (regular/heavy smoking, moderate/frequent alcohol, or betel quid) | **`high`** | `75.00` | Priority professional dental evaluation recommended. Schedule an in-person clinical examination with a licensed dentist within 1–2 weeks. |
| **3** | **Established Exposure / Active Pathology** | Primary AI classification is `Gum Disease` (`Gum`) or `Oral Thrush` (`OT`)<br>**OR** single established exposure (betel quid, regular/heavy smoking, or frequent alcohol) | **`moderate`** | `50.00` | Professional dental evaluation recommended. Schedule an outpatient dental consultation for clinical inspection and professional care. |
| **4** | **Age-Associated Context** | Patient age $\ge 50$ years **AND** qualifying oral finding present **AND** no Tier 1–3 conditions met | **`moderate`** | `50.00` | Professional dental evaluation recommended. Discuss screening findings during an in-person dental visit. |
| **5** | **No Flagged Context** | Common benign or self-limiting oral findings (`Canker Sore`, `Cold Sore`, `Mucocele`) with no flagged lifestyle or age context | **`low`** | `25.00` | Routine oral health follow-up. Maintain regular bi-annual dental check-ups. Re-evaluate if sores persist beyond 10–14 days. |

---

## 3. Technical Role of `risk_score`

The database schema defines `risk_score` as a `NUMERIC(5, 2) NOT NULL CHECK (risk_score >= 0.0 AND risk_score <= 100.0)`.

- **Explicit Semantic Meaning**:
  - `risk_score` is stored as an **ordinal technical tier index**:
    - `low`: `25.00`
    - `moderate`: `50.00`
    - `high`: `75.00`
    - `critical`: `100.00`
  - It does **NOT** represent the mathematical probability of cancer or clinical disease risk.
  - It satisfies the database column contract without manufacturing an unvalidated epidemiological formula or confusing AI model confidence with clinical risk.

---

## 4. Contributing Factors Structure

Every factor stored in `contributing_factors` is a verifiable factual observation derived directly from persisted data:

```json
[
  {
    "category": "AI Classification",
    "observation": "Primary AI screening classification: Oral Lichen Planus (model confidence: 85.0%).",
    "source": "ai_predictions"
  },
  {
    "category": "Spatial Localization",
    "observation": "YOLO detector localized 2 discrete finding region(s) in screening images.",
    "source": "yolo_detections"
  },
  {
    "category": "Lifestyle Context",
    "observation": "Documented lifestyle exposure factors: regular tobacco smoking, moderate alcohol consumption.",
    "source": "patient_medical_profiles"
  },
  {
    "category": "Demographic Context",
    "observation": "Patient age evaluated: 52 years.",
    "source": "patients"
  },
  {
    "category": "Clinical Context Decision",
    "observation": "Elevated to HIGH triage tier based on Oral Lichen Planus screening classification requiring elevated clinical vigilance.",
    "source": "clinical_context_engine"
  }
]
```

---

## 5. Safe Missing-Data Handling

1. **Missing AI Predictions**:
   - Risk assessment requires completed AI classification.
   - If `ai_predictions` has no records, requests are rejected with `HTTP 400 Bad Request` (`"AI inference must be executed before generating a risk assessment"`).
2. **Missing `PatientMedicalProfile`**:
   - `PatientMedicalProfile` is an optional table. If unrecorded, the engine assumes **no flagged lifestyle exposures**.
   - Missing profile data is **never penalized** and **never imputed**.
   - Factual note in `contributing_factors`: `"Patient medical profile not on file; lifestyle risk factors unassessed."`
3. **Missing Date of Birth**:
   - If `Patient.date_of_birth` is null, age-associated context (Tier 4) is skipped safely.
4. **Missing YOLO Detections**:
   - If no YOLO detections exist, it is recorded factually as `"No discrete localized finding regions detected by YOLO model"` without penalizing the triage tier.

---

## 6. API Endpoints

| HTTP Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/screenings/{screening_id}/risk-assessment` | `get_current_user` (Patient / Treating Dentist / Admin) | Generates or retrieves existing clinical risk assessment for a screening session |
| `GET` | `/api/screenings/{screening_id}/risk-assessment` | `get_current_user` (Patient / Treating Dentist / Admin) | Retrieves existing clinical risk assessment for a screening session |

---

## 7. Multi-Role Authorization & Security

- **Patient Self-Service**: Patients may only access screenings where `screening.patient_id == patient.id`. Cross-patient access returns `404 Not Found`.
- **Treating Dentist**: Dentists may only access patient screenings if an active relationship exists in `patient_dentist_relationships` (`status == 'active'`). Unauthorized dentists receive `403 Forbidden`.
- **Admin**: Oversight access with mandatory compliance audit logging.
- **Server-Side Evaluation**: The client cannot submit `risk_level`, `risk_score`, or patient overrides; all evaluations occur strictly server-side from verified database state.

---

## 8. Idempotency & Audit Logging

- Calling `POST /api/screenings/{id}/risk-assessment` with `force_recompute=False` (default) returns the existing cached assessment record with **zero duplicate database insertions**.
- Setting `force_recompute=True` refreshes the existing assessment in place.
- All operations record audit events in `audit_logs`:
  - `RISK_ASSESSMENT_GENERATED`
  - `RISK_ASSESSMENT_VIEWED`

---

## 9. Clinical Report Integration

- Phase 11's `ReportService` queries `screening.risk_assessment`.
- When an assessment exists, Section 5 ("MULTI-FACTOR RISK ASSESSMENT") of the generated PDF report displays:
  - Triage Priority Tier (`risk_level`)
  - Technical Tier Index (`risk_score`)
  - Plain-Language Summary
  - Triage Recommendation
- All displays maintain strict conceptual separation: AI model confidence $\neq$ Clinical diagnosis $\neq$ Screening triage priority.

---

## 10. Clinical Safety Disclaimer

Mandatory disclaimer included on all responses and reports:

> *"IMPORTANT CLINICAL NOTICE: This screening risk assessment and triage tier is an automated decision-support synthesis of preliminary AI image findings and self-reported patient context. It does NOT constitute a definitive medical or dental diagnosis, disease staging, or treatment plan. It is intended solely to assist in scheduling and prioritizing professional evaluation. Comprehensive clinical examination by a licensed dental professional is required."*

