# OraVisionAI — Screening Clinical Context & Risk Assessment Methodology

**Classification**: Research/FYP Prototype — Non-validated Screening Decision-Support Engine  
**Version**: 1.0  
**Target Entity**: PostgreSQL `risk_assessments` table  

---

## 1. Purpose and Scope

This document specifies the deterministic, rule-based **Clinical Context Engine** for Phase 12 of the OraVisionAI Final Year Project (FYP). 

The approved database schema defines `risk_assessments` as:
> *"Synthesized risk scoring combining classification confidence, lesion count, and medical history."* (`database_schema.md` §3.13)

The purpose of this subsystem is to synthesize already-generated multimodal findings (primary AI classification, spatial YOLO lesion localizations, self-reported lifestyle context, and patient demographic age) into an objective, explainable screening priority tier (`low`, `moderate`, `high`, `critical`) and an associated non-clinical technical tier index (`risk_score`).

### Scope Boundaries:
- **Assistive Screening Decision Support Only**: This methodology computes a relative screening follow-up urgency indicator. It does **NOT** establish a medical or dental diagnosis, disease staging, or treatment prescription.
- **Strict Separation of Concerns**: Machine learning inferences (`ai_predictions`) and licensed dental evaluations (`dentist_assessments`) remain completely separate and unedited.
- **No Arbitrary Numerical Point Systems**: Unlike arbitrary point calculators (e.g. assigning points for smoking or YOLO counts), this engine uses a clinical-context waterfall rule hierarchy.

---

## 2. Inputs

The engine evaluates only factual, already-persisted database fields across existing entities:
- `AIPrediction`: `predicted_class`, `confidence`
- `YOLODetection`: localized bounding box findings count
- `PatientMedicalProfile`: `betel_quid_user`, `smoking_status`, `alcohol_consumption`
- `Patient`: `date_of_birth` (for demographic age context)

---

## 3. Clinical Context Engine Waterfall Hierarchy

The engine evaluates conditions in a **strict waterfall order**:

```
Step 1: Tier 1 (Warning Signs)
        └── IF predicted_class == 'Oral Cancer' ──────────────────────> RESULT: 'critical' (Index: 100.00)
Step 2: Tier 2 (High Clinical Vigilance / Multiple Exposures)
        └── IF predicted_class == 'Oral Lichen Planus' OR
               active_exposure_count >= 2 ────────────────────────────> RESULT: 'high' (Index: 75.00)
Step 3: Tier 3 (Established Exposure / Active Tissue Pathology)
        └── IF predicted_class IN ('Gum Disease', 'Oral Thrush') OR
               active_exposure_count == 1 ────────────────────────────> RESULT: 'moderate' (Index: 50.00)
Step 4: Tier 4 (Age-Associated Context)
        └── IF patient_age >= 50 AND qualifying oral finding present ──> RESULT: 'moderate' (Index: 50.00)
Step 5: Tier 5 (No Flagged Context)
        └── All other benign/self-limiting presentations ─────────────> RESULT: 'low' (Index: 25.00)
```

---

## 4. Technical Role of `risk_score`

- `risk_score` is stored as an **ordinal technical tier index**:
  - `low`: `25.00`
  - `moderate`: `50.00`
  - `high`: `75.00`
  - `critical`: `100.00`
- It satisfies the database `NUMERIC(5, 2) NOT NULL` constraint without manufacturing unvalidated epidemiological disease probabilities or confusing model confidence with clinical risk.

---

## 5. YOLO & Localization Handling

- YOLO is strictly a **localization aid**.
- Changing YOLO detection count from 0 to 5 does **not** alter `risk_level` or `risk_score`.
- It is recorded factually in `contributing_factors`:
  - E.g. `"YOLO detector localized 2 discrete finding region(s) in screening images."`

---

## 6. Safe Missing-Data Handling

- **Missing AI Predictions**: Rejection with `HTTP 400 Bad Request`.
- **Missing `PatientMedicalProfile`**: Treated as unassessed lifestyle risk factors without penalty or imputation.
- **Missing Date of Birth**: Age-associated context tier skipped safely.

---

## 7. Clinical-Safety Disclaimer

> *"IMPORTANT CLINICAL NOTICE: This screening risk assessment and triage tier is an automated decision-support synthesis of preliminary AI image findings and self-reported patient context. It does NOT constitute a definitive medical or dental diagnosis, disease staging, or treatment plan. It is intended solely to assist in scheduling and prioritizing professional evaluation. Comprehensive clinical examination by a licensed dental professional is required."*

