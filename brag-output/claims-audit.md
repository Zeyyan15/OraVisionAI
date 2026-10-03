# Repository evidence and capture gates

This is a source audit plus validation of the real frontend against isolated synthetic fixtures. It is not end-to-end validation of production auth, persistence, inference, or clinical performance.

| Claim / visual | Executable source | Finding |
|---|---|---|
| Notes → photograph upload → analysis | frontend/src/pages/patient/NewScreeningPage.tsx; frontend/src/hooks/useScreening.ts | Three-step implemented wizard. Notes stored independently. |
| Seven-class image classifier | backend/app/services/ai_inference_service.py, EFFICIENTNET_CLASS_NAMES and classify_image | EfficientNetB0, image bytes only. No normal/healthy class. |
| Class list | same service | Canker Sore, Cold Sore, Gum Disease, Mucocele, Oral Cancer, Oral Lichen Planus, Oral Thrush. |
| YOLO localization | same service, detect_lesions and run_screening_inference | Separate invocation on the original image; normalized bounding boxes. Not a binary classifier gate; not severity/staging. |
| Model artifacts exist | ai_models/best_7teeth_efficientnetb0_verified.keras; ai_models/oravisionai_yolo.pt | Both files present. Successful inference has not yet been verified in this production run. |
| Results/confidence/probabilities | frontend/src/pages/patient/ScreeningResultsPage.tsx; components/screening/ProbabilityDistributionChart.tsx | Displayed UI wired to returned results. Confidence is class score, not clinical accuracy. |
| Bounding-box view | frontend/src/components/screening/YoloOverlayViewer.tsx | Real component captured with repository seeded detections, disclosed as synthetic. |
| Explainable AI | backend/app/services/xai_service.py; frontend/src/components/screening/XaiSection.tsx | Grad-CAM and occlusion user-facing methods; captured with existing repository validation overlays, disclosed as synthetic. |
| Risk prioritization | backend/app/services/risk_assessment_service.py, evaluate_clinical_context | Deterministic clinical context engine; low/moderate/high/critical; technical indices 25/50/75/100. YOLO is non-escalating localization evidence. |
| Approved dentist review request | frontend/src/components/screening/DentistReviewCard.tsx; backend/app/services/dentist_assessment_service.py, request_screening_review | Requires approved active dentist; establishes relationship and draft assessment. |
| Authorized case / pending review | same service, verify_dentist_access and pending-review query; frontend/src/pages/dentist/DentistScreeningReviewPage.tsx | Approval and case authority checked. |
| Separate professional assessment | frontend/src/components/dentist/DentistAssessmentForm.tsx; backend/app/services/dentist_assessment_service.py | Observations, preliminary clinical notes, recommendations, referral, draft/finalization. Captured using user-authorized synthetic demonstration text; no real clinician participated. |
| PDF compilation/download | backend/app/services/report_service.py; backend/app/services/pdf_report_renderer.py; frontend/src/components/screening/ReportActionCard.tsx | Snapshot and ReportLab PDF exist; use matching case, preferably after review. |
| Logo / visual identity | frontend/src/assets/logo.png; frontend/tailwind.config.js; frontend/index.html; Header.tsx | Preserve existing artwork, palette and Inter. User edits in Header/PublicLayout/assets existed before production. |
| University/FYP | user brief | Only permitted source outside repository. |

## Synthetic artifact provenance

external_xai_validation/phase10_xai_contact_sheet.png depicts synthetic circles on flat fields, not oral photographs. After explicit user authorization, the original/occlusion/Grad-CAM panels were cropped and used in the isolated demonstration. Persistent labeling reads SYNTHETIC DEMO / SEEDED RESULTS; the upload scene also identifies an illustrative repository test image.

The old sample PDF is not shown. Its source snapshot in scratch/validate_phase11.py supplies the seeded classification probabilities and detections. The demo replaces identities, calculates the current ordinal risk tier (LOW, technical index 25), records synthetic form entries, and generates a fresh PDF using app.services.pdf_report_renderer.PDFReportRenderer. The source renderer's formatting is preserved.

## Final verification status

- Source claims, classifier taxonomy and independent model roles: checked.
- Actual frontend capture, coherent synthetic case, seeded probabilities/detections, existing test XAI, review request, dentist form, finalization, PDF generation and download: captured successfully.
- Production backend integration and trained-model inference: not executed for this demonstration. No inference speed or clinical-performance claims are made.
- Full runtime, caption synchronization, readability, final render and poster: pending.
- No output should be described as clinically validated or diagnostically definitive.
