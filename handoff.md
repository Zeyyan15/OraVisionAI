# OraVisionAI `/brag` video handoff

## Resumed production status (2026-10-03)

The capture and composition work below has now been completed. The real frontend was exercised through notes, upload, loading, results, review request, dentist draft/finalization, and PDF generation/download using the isolated synthetic API. `brag-output/composition/index.html` is the completed 60-second composition, not the starter. `brag-output/captions.srt` contains measured narration timings. `brag-output/validation.json` records a passing HyperFrames check with no errors; structural timeline warnings remain informational for this flat composition.

The reproducible build entry is `node brag-output/demo/build-video.mjs`. After rebuilding, run the audio carve command documented in the audio skill, then the HyperFrames check/render. `node brag-output/demo/finalize-video.mjs` performs the delivery pass: persistent synthetic-demo header, selected poster at frame zero, audio copy, and MP4 stream verification. Final target: `brag-output/brag.mp4`. The intermediate render is preserved as `brag-output/brag-render.mp4`.

The current capture wrapper fixes Tailwind resolution with `process.chdir(frontendRoot)`. Use `backend/venv/Scripts/python.exe brag-output/demo/server.py` for the fixture API if global Python lacks dependencies. Safe capture detail refresh is in `brag-output/demo/capture-details.mjs`. The sample image is a repository synthetic test pattern, and the model outputs are seeded: the video is not a demonstration of live trained-model inference.

Earlier next-step sections below are historical context; do not repeat completed capture or narration generation.

This repository is being prepared for a polished, approximately 60-second HyperFrames launch/explainer video. Continue using the `brag` skill and the HyperFrames skills. The video must remain faithful to the executable application and must use synthetic/demo data only.

## User constraints

- Do not use real patient records, PII, production databases, cloud auth, or production data.
- The user explicitly authorized local-development-only synthetic fixtures: one demo patient, one approved demo dentist, and one synthetic screening case.
- Use the actual OraVisionAI UI and implemented routes/components. Do not invent screens, workflows, medical claims, statistics, integrations, or model behavior.
- The only non-repository facts permitted in the video are: Final Year Project, BS Artificial Intelligence, Air University, Islamabad.
- Present the system as AI-assisted preliminary oral-health screening and clinical decision support, never as definitive diagnosis, cancer confirmation/staging, autonomous treatment, or a dentist replacement.
- Final output should have professional English narration, readable synchronized captions, restrained healthcare-tech music, and a polished MP4 close to 60 seconds.

## What has already been done

- Read the `brag` and HyperFrames skill instructions.
- Inspected the repository source, routes, components, backend services, model files, report renderer, assets, and relevant documentation.
- Verified the strongest story: patient screening -> image analysis -> results/XAI/risk prioritization -> dentist review -> report.
- Confirmed the implemented model description:
  - EfficientNetB0 performs seven-condition image classification.
  - YOLO independently localizes visible findings with bounding boxes.
  - The seven classifier labels are Canker Sore, Cold Sore, Gum Disease, Mucocele, Oral Cancer, Oral Lichen Planus, and Oral Thrush.
  - There is no Healthy/Normal classifier class.
- Confirmed actual patient flow in the frontend:
  - `/patient/dashboard`
  - `/patient/screenings/new`
  - notes -> image selection/preview -> upload/run analysis -> `/patient/screenings/{id}`
  - results contain primary finding/confidence, probability distribution, YOLO overlay, XAI, clinical risk card, dentist review, and report actions.
- Confirmed actual dentist flow:
  - `/dentist/dashboard`
  - `/dentist/screenings/{id}/review`
  - professional observations, diagnosis notes, treatment recommendation, save draft, finalize assessment, and report generation.
- Confirmed the source PDF renderer is `backend/app/services/pdf_report_renderer.py` and can render the synthetic report fixture locally.
- Generated narration at `brag-output/narration.txt` and TTS audio at `brag-output/composition/assets/voiceover.wav`.
  - Voice: Kokoro `af_heart`
  - Speed: `0.95`
  - Measured duration: about 54.3 seconds, leaving roughly 5.7 seconds for the closing card.
- Copied the available polished music bed to `brag-output/composition/assets/music.mp3`.
- Copied the real logo to `brag-output/composition/assets/logo.png`.
- Cropped safe synthetic XAI validation assets to:
  - `synthetic-original.png`
  - `synthetic-occlusion.png`
  - `synthetic-gradcam.png`
- Captured at least the real patient dashboard to `brag-output/composition/assets/patient-dashboard.png`.
- Installed/inspected the registry `yt-feather-highlight` component; it can be adapted for restrained spotlight masks, but do not include its self-preview markup if it causes lint issues.
- Created a HyperFrames scaffold in `brag-output/composition`.

## Important files

- Project composition: `brag-output/composition/index.html`
- Composition metadata: `brag-output/composition/hyperframes.json`, `meta.json`, `package.json`
- Existing composition instructions: `brag-output/composition/AGENTS.md`, `CLAUDE.md`
- Demo auth shim: `brag-output/demo/AuthContext.tsx`
- Local Vite wrapper: `brag-output/demo/start.mjs`
- Local isolated fixture API: `brag-output/demo/server.py`
- Puppeteer capture script: `brag-output/demo/capture.mjs`
- Optional local transcription script: `brag-output/demo/transcribe.py`
- Research/verification notes:
  - `brag-output/BRIEF.md`
  - `brag-output/brag-plan.md`
  - `brag-output/composition-brief.md`
  - `brag-output/claims-audit.md`
  - `brag-output/narration.txt`

## Local demo architecture

The demo is intentionally isolated from the real backend and does not read `.env`, connect to a database, or call cloud services.

- Frontend wrapper runs the real frontend source with Vite and aliases `AuthContext.tsx` and Firebase config only for local capture.
- The fixture server exposes a small loopback API on `127.0.0.1:8000`.
- The frontend runs on `127.0.0.1:5173`.
- Demo identities are synthetic only:
  - `Demo Patient`, `patient@oravision.test`
  - `Demo Dentist`, `dentist@oravision.test`
- The screening uses the repository’s synthetic XAI validation fixture. It is not a real oral photograph and should be labeled in the video as `Synthetic demo` or `Illustrative test image`.
- The fixture’s seeded example is Mucocele with a seven-class probability vector and XAI assets. The fixture server recalculates the current application risk tier rather than relying on the old hardcoded sample value.
- The fixture server calls the application’s actual `RiskAssessmentService` and `PDFReportRenderer` where practical, while the AI result itself is intentionally seeded for deterministic screen capture.

## Running the capture environment

Use separate PowerShell sessions from the repository root:

```powershell
python brag-output/demo/server.py
node brag-output/demo/start.mjs
node brag-output/demo/capture.mjs
```

The capture script uses Puppeteer Core and Chrome at:

`C:\Program Files\Google\Chrome\Application\chrome.exe`

Its existing browser profile is under `brag-output/demo/browser-profile`. It has already successfully opened the wrapped patient dashboard. Do not expose or reuse any real browser profile.

## Immediate next steps

1. Inspect `brag-output/composition/assets/patient-dashboard.png` to confirm the capture quality.
2. Extend `brag-output/demo/capture.mjs` to complete and capture the deterministic workflow:
   - patient notes screen
   - image upload/preview
   - analysis/loading state
   - patient results, preferably with close captures of the probability chart, XAI/YOLO evidence, and risk card
   - dentist review request modal and submitted state
   - dentist dashboard/pending queue
   - dentist review form with synthetic professional observations and assessment
   - finalized/reviewed state and report action
   - generated report card or a rendered page of the actual synthetic PDF if time permits
3. Keep all captured UI clearly synthetic. A small persistent `SYNTHETIC DEMO` label is appropriate in the video; do not make the synthetic screenshot look like a real patient record.
4. Replace the starter `brag-output/composition/index.html` with one renderable HyperFrames composition.
5. Use the real screenshots as primary visual material. Add only restrained motion design: camera push-ins, crops, spotlight masks, subtle scan/highlight lines, probability-bar reveals, smooth transitions, and clean callouts.
6. Build approximately these beats, adjusting to the actual narration timing:
   - 0–6s: OraVisionAI logo and AI-assisted oral-health screening
   - 6–17s: patient notes and oral-photo upload
   - 17–27s: AI-assisted image analysis; EfficientNetB0 classification + independent YOLO localization
   - 27–40s: real results, probabilities, XAI, boxes, and risk prioritization
   - 40–51s: dentist request, queue, and professional review
   - 51–54s: report
   - 54–60s: branded end card and disclaimer
7. Add the voiceover and music as framework-owned audio. Keep music well under narration, approximately 0.12–0.15 gain, with fade in/out and voice ducking if supported.
8. Add captions from the narration/transcription. Captions must be readable and must not obscure important UI evidence.
9. Run HyperFrames lint/check, capture snapshots, render the MP4, inspect the rendered video, and fix any contrast/layout/timing issues.

## Suggested narration text

The current narration is in `brag-output/narration.txt`:

> OraVision AI supports preliminary oral-health screening, with professional clinical oversight.
> Patients begin by recording notes and uploading an oral photograph for AI-assisted image analysis.
> EfficientNet B zero classifies the image across seven oral conditions. Independently, YOLO localizes visible findings.
> Results bring together model confidence, class probabilities, explainable heatmaps, and clinical-risk prioritization. These are screening findings, not a confirmed diagnosis.
> Patients request an approved dentist's review. The dentist examines the original image and AI evidence, then records a separate professional assessment and recommendations.
> A consolidated report brings the findings together. OraVision AI combines artificial intelligence with clinical oversight, supporting structured oral-health assessment.

If correcting pronunciation markup, preserve the meaning and the seven-condition/model-role accuracy. Do not add claims about accuracy, outcomes, clinical validation, or cancer diagnosis.

## Composition design guidance

- Use 1920×1080, Inter or a locally available equivalent, and the existing white/light clinical palette with navy, blue, teal, and emerald accents.
- Preserve the actual logo; do not redraw it.
- Use a light clinical background, dark navy text, rounded white UI frames, subtle shadows, and restrained blue/teal glows.
- Use a consistent small `SYNTHETIC DEMO` or `Illustrative test image` marker.
- Keep the end card readable long enough to include:
  - `OraVisionAI`
  - `AI-Assisted Oral Health Screening & Clinical Decision Support`
  - `Final Year Project`
  - `BS Artificial Intelligence`
  - `Air University, Islamabad`
  - `For preliminary screening and clinical decision support. Not a definitive medical diagnosis.`
- Avoid fake stats, fake dashboards, stock footage, frightening imagery, excessive text, and sci-fi treatment.

## HyperFrames command notes

- `npx.ps1` is blocked by PowerShell execution policy; use `npx.cmd` or invoke the installed HyperFrames CLI directly.
- The project was initialized with HyperFrames 0.8.x. The currently available npm install was 0.8.112; keep the project package/lock versions consistent if updating them.
- Puppeteer Core is available in the npx cache at:
  `D:\npm-cache\_npx\702923228c2ce1e6\node_modules\puppeteer-core\lib\puppeteer\puppeteer-core.js`
- If a browser/Chrome command times out in the sandbox, rerun that specific capture/render command with the appropriate escalation approval.
- Keep HyperFrames timelines deterministic: one paused GSAP timeline, no wall-clock reads, random values, or unregistered timers.
- Do not commit or alter the user’s unrelated pre-existing changes in `frontend/src/components/layout/Header.tsx`, `frontend/src/components/layout/PublicLayout.tsx`, or `frontend/src/assets/logo.png`.

## Acceptance checklist

- [ ] Actual OraVisionAI UI is the primary visual source.
- [ ] All demonstrated screens/routes exist in the source.
- [ ] Synthetic demo data is clearly local-only and not presented as a real patient.
- [ ] Seven classifier classes are correct and no Healthy/Normal class is shown.
- [ ] EfficientNetB0 and YOLO roles are accurately separated.
- [ ] AI output, model confidence, YOLO boxes, risk tier, and dentist assessment are not conflated.
- [ ] Dentist review is visibly human-authored and distinct from AI output.
- [ ] No unsupported Google auth, live teleconsultation, medical-profile editing, file attachments, WebSocket messaging, performance metrics, or clinical-certification claims appear.
- [ ] Voiceover, music, and captions are synchronized and intelligible.
- [ ] Runtime is approximately 60 seconds.
- [ ] HyperFrames check/lint passes.
- [ ] Final MP4 and editable composition are saved under `brag-output`.
