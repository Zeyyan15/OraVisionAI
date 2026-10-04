# OraVisionAI mobile

React Native + Expo app for patients and dental practitioners. Uses the **same Firebase project, FastAPI backend and PostgreSQL database** as the website. No separate mobile database or account system.

## Included

- Shared account login, patient/doctor signup, persistent native authentication and recovery when backend synchronization fails.
- Patient home, image capture/upload, AI screening, explanations, professional review requests and PDF reports.
- Doctor case review, draft/final clinical assessments, professional profile, verification submissions and weekly availability.
- Appointment booking and confirmation/cancellation, consultation waiting room, live Stream audio/video, session controls and clinical summary.
- Conversations, image/PDF attachments, doctor report sharing and notifications.
- Mint/teal theme, animated entrances with reduced-motion support, and consistent rounded buttons that grow with their labels.

## Local setup

```powershell
cd D:\ISSM\OravisionAI\mobile
npm.cmd ci
Copy-Item .env.example .env # only when .env does not already exist
```

Populate `EXPO_PUBLIC_FIREBASE_*` using the corresponding `VITE_FIREBASE_*` values from `frontend/.env`. These are public client settings. **Never copy Firebase service-account credentials, database passwords or STREAM_API_SECRET into the mobile project.** The existing local `.env` is already populated with this project's Firebase settings.

Set `EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:8000` for a physical phone on the same network. Android emulator: `http://10.0.2.2:8000`. A blank URL infers the Expo development server host; deployed builds must set the existing HTTPS backend URL.

Start the backend from `backend/`:

```powershell
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m alembic upgrade head
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The backend's existing Firebase credentials and PostgreSQL configuration must be working. The teleconsultation code was merged from `origin/main`. Live calls require **STREAM_API_KEY and STREAM_API_SECRET on the backend**; the mobile app fetches short-lived user tokens from `/api/consultations/{id}/stream-token`.

In this local workspace, PostgreSQL runs in Docker as `oravisionai-postgres-dev` on port 5433, using the original project's data volume. Keep Docker Desktop running before signing in. The chat/report migration has been applied after a local backup.

## Run Android / iOS

Expo Go can preview login, screens, appointments, screening, and messaging. Live calls
use native WebRTC modules and require an OraVisionAI development build on phones.
The consultation screen shows an explanatory notice in Expo Go without importing
the unsupported module. Browser calls work on localhost or HTTPS.

Photo and message uploads use actual file bytes in multipart FormData. SDK 57's
Expo fetch rejects the older React Native `{ uri, name, type }` upload objects;
keep native file conversion in `src/utils/uploadFile.native.ts`.

Screening shows three real stages: image upload, analysis, and explanations/report.
Saved findings appear during processing, and missing optional outputs do not hide
successful results. Cancel aborts phone requests and terminates the backend worker;
completed results remain readable. Closing the screening screen also stops its work.
The local workflow registry requires **one Uvicorn API worker**. Each screening runs
in a separate stoppable process (maximum two at once). Do not deploy this workflow
with multiple API workers until job ownership/cancellation is moved to a shared queue.

```powershell
# Preview in Expo Go (native live calls unavailable)
npm.cmd run go -- --clear

# Android, with Android Studio/JDK and a connected device or emulator
npm.cmd run android

# Once a development build is installed
npm.cmd start

# Web preview including browser audio/video calls
npm.cmd run web
```

iOS local builds require macOS/Xcode (`npm run ios`). To build on Windows using your Expo/EAS account:

```powershell
npx.cmd eas-cli@latest build --profile development --platform android
npx.cmd eas-cli@latest build --profile development --platform ios
```

`eas.json` includes a `preview` profile producing an Android APK. Configure your EAS project, signing credentials and hosted `EXPO_PUBLIC_API_URL` before distributing builds. Distribution builds require an HTTPS backend URL; local HTTP is enabled only for development configuration. Live media should be verified with two physical devices, including a website-to-mobile call. Camera/microphone are initially off; leaving a call does not end the clinical consultation.

## Local demo data

To populate your existing patient account with three clearly labelled demo doctors,
six upcoming appointments, three conversations, six messages, and three notifications:

```powershell
cd D:\ISSM\OravisionAI\backend
venv\Scripts\python.exe scripts/seed_mobile_demo.py --email YOUR_PATIENT_EMAIL
```

The seed requires a local development database and an existing patient account.
Data templates live in `backend/scripts/seed_data/mobile_demo.json`.
It is safe to rerun: existing records are preserved and duplicate demo records are skipped.
Demo doctors initially have no Firebase login or real clinician attached. To create
their Firebase logins while retaining the seeded doctor profiles, run from `backend/`:

```powershell
venv\Scripts\python.exe scripts/provision_demo_doctors.py
```

This creates three accounts in the configured Firebase project and prints randomly
generated passwords once. It preserves existing logins and passwords when rerun.
Messages are inserted only into the local database. Refresh the mobile preview after
running the seed.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx.cmd expo-doctor
npx.cmd expo export --platform all
npm.cmd run test:ui
```

Shared API contracts are imported from `../frontend/src/types` and Metro watches that folder. Keep this app inside the repository. Native folders are generated by Expo; configuration lives in `app.json` and config plugins.

Browser calls work on localhost or HTTPS, with camera/microphone permission granted.
Both participants must join the same consultation using separate signed-in browser
sessions. A phone browser opened through a plain HTTP LAN address cannot use camera
or microphone; use HTTPS or the installed native development app.

The UI check requires an exported web bundle and a local Chrome installation (`CHROME_PATH` can override the executable path). It checks both roles using synthetic Firebase/API responses; it never modifies real accounts or clinical records. Screenshots are saved under the ignored `.expo/verification/` folder. These checks do not replace two-device testing of native audio/video.
