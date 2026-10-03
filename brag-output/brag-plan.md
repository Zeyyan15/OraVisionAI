# OraVisionAI — 60-second film plan

## Planning rubric

1. App: AI-assisted preliminary oral-health screening with image classification, localization, explanations, urgency prioritization and authorized dentist assessment.
2. Strongest supported capability: the original image and AI evidence accompany a separate professional assessment.
3. Visual hook: actual blue/teal tooth-and-network logo, followed by the real screening workflow.
4. UI: NewScreeningPage, ScreeningResultsPage, DentistReviewCard, DentistScreeningReviewPage and ReportActionCard.
5. Duration: 60 seconds, explicitly requested; six scenes.
6. Tone: polished; modern medical AI product explainer; calm movement, precise crops, readable holds.
7. Audio: neutral English voice, subdued professional music, at most three quiet interaction accents.
8. Share copy: repository-grounded FYP introduction with preliminary-screening disclaimer.
9. Flow: submit an oral photograph → inspect model evidence → request dentist assessment and access a consolidated report.

## Storyboard

| Time | Real source and choreography | Overlay / interpretation boundary |
|---|---|---|
| 0–6 | Original logo resolves on white; clinical blue rule draws beneath the lockup. Smooth push toward patient portal. | AI-Assisted Oral Health Screening |
| 6–17 | Dashboard briefly, then actual New Oral Cavity Screening. Focus on optional notes; transition to real photograph upload and preview. Show actual button progression. | Upload an oral photograph. Notes are recorded; do not imply classifier input. |
| 17–27 | Actual Analyzing Oral Photograph state; restrained two-branch diagram over the source screen, one image feeding both independent models. | EfficientNetB0: 7-condition classification. YOLO: finding localization. |
| 27–40 | Genuine result page: settle on primary finding/confidence, travel to seven-class chart, then image with actual bounding boxes, genuine XAI and urgency card. Reveal existing chart bars with a visual mask; never change their values. | Preliminary AI findings. Confidence ≠ clinical accuracy. Risk tier ≠ disease probability. |
| 40–51 | Actual request-review modal → dentist pending queue → authorized case and original image → professional assessment fields. Pause on authorship and separation from AI. | Professional Dentist Review. AI + Clinical Expertise. |
| 51–54 | Real report-generation/download controls and brief genuine PDF crop, only if matching the selected case. | Consolidated Clinical Report |
| 54–60 | Branded end card with all project credits visible throughout; quiet final hold. | OraVisionAI; AI-Assisted Oral Health Screening & Clinical Decision Support; Final Year Project; BS Artificial Intelligence; Air University, Islamabad; For preliminary screening and clinical decision support. Not a definitive medical diagnosis. |

## Visual identity

- Logo: frontend/src/assets/logo.png, preserve original aspect and artwork.
- Canvas #ffffff / #f8fafc; ink #0f172a / #082f49.
- Clinical blue #0369a1, deeper #075985; emerald accents as in the source UI.
- Inter 400/500/600/700 from the application's index.html and Tailwind config.
- Camera moves on captured screen wrappers; readable poses hold before moving on.
- Restrained shadow depth and clinical rules. No stock photography or fictional interface.

## Voiceover script

OraVision AI supports preliminary oral-health screening, with professional clinical oversight.

Patients begin by recording notes and uploading an oral photograph for AI-assisted image analysis.

EfficientNet B zero classifies the image across seven oral conditions. Independently, YOLO localizes visible findings.

Results bring together model confidence, class probabilities, explainable heatmaps, and clinical-risk prioritization. These are screening findings, not a confirmed diagnosis.

Patients request an approved dentist's review. The dentist examines the original image and AI evidence, then records a separate professional assessment and recommendations.

A consolidated report brings the findings together. OraVision AI combines artificial intelligence with clinical oversight, supporting structured oral-health assessment.

## Music cue guidance

Vol. 12, 117.36 seconds, supplied estimated tempo 109.96 BPM. Cue preset reviewed. Early cues at 6.00, 13.11 and 17.47 can support the handoffs only when narration and reading time permit. The narration governs timing; no forced beat cuts. Audio-reactivity, if used, is limited to a very slight frame-edge accent and requires extracted audio data.

## Current state

Claims and source structure inspected; capture awaits an approved actual demo case. This plan is not evidence that the full app was run end to end. No final video should be issued with fabricated data or synthetic validation art standing in for a real case.
