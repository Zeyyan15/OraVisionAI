# OraVisionAI — Local Run & Manual Verification Guide

**Document Version**: 1.0.0  
**Phase Target**: Phase 30.5 Environment Verification & Manual Runtime Testing  
**Applicability**: Local Development, Staging, and Final Year Project (FYP) Demonstration  

---

## 1. Purpose

This document is the authoritative, step-by-step operating guide for setting up, running, and manually verifying the **OraVisionAI** oral-health screening and telehealth platform locally.

### Context & Objectives
- **System Maturity**: The full architecture of OraVisionAI has been developed, hardened, and frozen across Phases 1 through 30.
- **Manual Verification Checkpoint**: Before initiating any subsequent development or evaluation, this guide enables an operator, evaluator, or developer to personally boot both the FastAPI backend and React frontend, populate test accounts, and manually execute every major clinical and administrative workflow.
- **Personal Runtime Verification**: A successful pass of this guide signifies that you have personally confirmed runtime behaviors on a live machine.

### Critical Methodological Demarcations
To preserve academic and engineering rigor, this guide enforces strict conceptual boundaries:
- **`IMPLEMENTED IN SOURCE CODE` vs. `VERIFIED MANUALLY AT RUNTIME`**: Static source code existence or unit/simulation tests prove code structure, but only manual execution against a live backend, database, and browser confirms operational runtime behavior.
- **Engineering Completeness vs. Clinical Approval**: Passing these manual runtime tests verifies technical and architectural completeness. It **does NOT** constitute clinical efficacy validation, medical-device certification (FDA 510(k), CE mark), or statutory production deployment approval.
- **Decision-Support Primacy**: The AI screening engine produces decision-support evidence only. It does not replace the independent professional assessment of a licensed dentist.

---

## 2. System Architecture Overview

```
                          ┌────────────────────────┐
                          │   React + Vite Client  │
                          │      (Port 5173)       │
                          └───────────┬────────────┘
                                      │
                         HTTP REST / Bearer Tokens
                                      │
                          ┌───────────▼────────────┐
                          │    FastAPI Backend     │
                          │      (Port 8000)       │
                          └─────┬────────────┬─────┘
                                │            │
                SQLAlchemy 2.0  │            │  Firebase Admin SDK
                                │            │
             ┌──────────────────▼──┐      ┌──▼──────────────────┐
             │ PostgreSQL Database │      │  Firebase Services  │
             │     (Port 5432)     │      │ (Auth / Cloud Store)│
             └─────────────────────┘      └─────────────────────┘
```

- **Frontend**: Single Page Application (SPA) built with **React 18**, **TypeScript**, **Vite**, and **Tailwind CSS**. State management is handled through React Context and hooks with zero external state-management libraries.
- **Backend**: Asynchronous REST API powered by **FastAPI** and **Python 3.12**, served via **Uvicorn** ASGI with strict Pydantic v2 validation models.
- **Database**: **PostgreSQL 14+** managed via **SQLAlchemy 2.0** (`asyncpg` for application runtime queries, `psycopg2` for Alembic migrations) with exactly 1 consolidated initial schema migration.
- **Authentication**: **Firebase Authentication** handles user identity and credential issuance (Email/Password). The backend verifies Firebase Bearer JWT tokens and maps them to internal PostgreSQL `users` UUID records.
- **Cloud Storage**: **Firebase Storage** stores uploaded screening oral photographs, generated XAI saliency overlays, and clinical reports.
- **AI Inference**: 
  - **Classification**: 7-class EfficientNetB0 neural network trained on the 7Teeth dataset.
  - **Lesion Localization**: Custom-trained YOLO object detector producing normalized spatial bounding boxes.
- **Explainable AI (XAI)**: Visual explanation pipeline supporting Occlusion Sensitivity, Grad-CAM, Grad-CAM++, LayerCAM, Score-CAM, and Integrated Gradients.
- **Clinical Reports**: Authenticated binary stream download of structured PDF reports dynamically compiled using ReportLab.
- **Communication & Messaging**: Direct patient-dentist asynchronous REST polling architecture with relationship validation.
- **Teleconsultation**: Lifecycle session container (`scheduled`, `active`, `ended`, `failed`) and duration timer.  
  *(Important: The consultation module manages session status, notes, and duration; it does not implement live WebRTC or Stream Video media streaming).*

---

## 3. Prerequisites

Verify that your host machine satisfies the following hardware and runtime requirements:

| Component | Minimum Required Version | Verified Local Baseline | Purpose |
|---|---|---|---|
| **Operating System** | Windows 10/11, macOS 12+, or Ubuntu 20.04+ | Windows 10/11 64-bit | Host environment |
| **Node.js** | Node.js v20.0.0 or higher | **v22.17.0** | Frontend build & dev server |
| **npm** | npm v10.0.0 or higher | **10.9.2** | Node package manager |
| **Python** | Python 3.11 or 3.12 | **Python 3.12.6** | Backend runtime environment |
| **PostgreSQL** | PostgreSQL 14.0 or higher | Local Service / Docker | Relational database |
| **Firebase Account** | Standard Google account | Active Project | Auth & Cloud Storage |
| **Web Browser** | Modern Chromium / Firefox / Safari | Chrome / Edge / Firefox | User interface client |

### Package Manifest Verification
- **Frontend**: Exactly 7 runtime dependencies defined in [`frontend/package.json`](file:///c:/Users/hp/Desktop/OravisionAI/frontend/package.json):
  `clsx`, `firebase`, `lucide-react`, `react`, `react-dom`, `react-router-dom`, `tailwind-merge`.
- **Backend**: Defined in [`backend/requirements.txt`](file:///c:/Users/hp/Desktop/OravisionAI/backend/requirements.txt):
  `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `sqlalchemy`, `alembic`, `asyncpg`, `psycopg2-binary`, `firebase-admin`, `tensorflow`, `ultralytics`, `reportlab`, etc.

---

## 4. Project Directory Structure

```text
c:/Users/hp/Desktop/OravisionAI/
├── backend/
│   ├── alembic/                    # Database migration environment
│   │   ├── versions/
│   │   │   └── 001_initial_database_schema.py  # Single initial schema migration
│   │   └── env.py
│   ├── app/
│   │   ├── api/                    # 12 FastAPI APIRouters (80 endpoints)
│   │   ├── core/                   # Config, Auth dependencies, Firebase Admin
│   │   ├── db/                     # Base and Async session management
│   │   ├── models/                 # 23 SQLAlchemy ORM entity models
│   │   ├── schemas/                # Pydantic validation schemas
│   │   ├── services/               # Clinical, AI, Storage, & Messaging services
│   │   └── main.py                 # FastAPI application factory & middleware
│   ├── .env.example                # Backend environment template
│   ├── alembic.ini                 # Alembic configuration
│   └── requirements.txt            # Backend Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/                    # API client and endpoints
│   │   ├── components/             # Reusable UI, layout, and domain components
│   │   ├── config/                 # Firebase and environment config
│   │   ├── context/                # AuthContext state provider
│   │   ├── hooks/                  # React custom hooks
│   │   ├── pages/                  # 28 view pages across roles
│   │   ├── routes/                 # ProtectedRoute & AppRoutes (33 routes)
│   │   └── types/                  # Domain, API, and Communication types
│   ├── .env.example                # Frontend environment template
│   ├── index.html                  # HTML entry point
│   ├── package.json                # 7 runtime npm dependencies
│   ├── tailwind.config.js          # Tailwind CSS styling configuration
│   └── vite.config.ts              # Vite bundler configuration
└── docs/
    ├── LOCAL_RUN_AND_MANUAL_VERIFICATION_GUIDE.md # This guide
    └── api_contract_reference.md   # API specification reference
```

---

## 5. Environment Configuration

### A. Backend Configuration (`backend/.env`)
Copy the backend template:
```powershell
cp backend/.env.example backend/.env
```

Open `backend/.env` in an editor and populate the following variables:

| Variable Name | Required? | Example / Default Value | Purpose |
|---|---|---|---|
| `APP_NAME` | Yes | `OraVisionAI` | Application branding identifier |
| `APP_VERSION` | Yes | `1.0.0` | API version string |
| `ENVIRONMENT` | Yes | `development` | Environment mode (`development` enables docs) |
| `DEBUG` | Yes | `true` | Enables verbose debug logging |
| `LOG_LEVEL` | Yes | `INFO` | Python log filter level |
| `DATABASE_URL` | **Yes** | `postgresql://postgres:password@localhost:5432/oravisionai` | PostgreSQL connection string |
| `FIREBASE_PROJECT_ID` | **Yes** | `your-project-id` | Firebase project identifier |
| `FIREBASE_CLIENT_EMAIL`| **Yes** | `firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com` | Service account email |
| `FIREBASE_PRIVATE_KEY` | **Yes** | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` | Service account private key string |
| `FIREBASE_STORAGE_BUCKET`| **Yes**| `your-project-id.appspot.com` | Cloud Storage bucket domain |
| `MAX_UPLOAD_SIZE_BYTES`| Yes | `15728640` | 15 MiB maximum upload size limit |
| `ALLOWED_IMAGE_MIME_TYPES`| Yes | `["image/jpeg","image/png","image/webp"]` | Permitted upload MIME formats |
| `ALLOWED_IMAGE_EXTENSIONS`| Yes | `[".jpg",".jpeg",".png",".webp"]` | Permitted file extensions |
| `AI_MODEL_DIR` | Yes | `ai_models` | Local directory for ML model weights |
| `CLASSIFIER_MODEL_PATH`| Yes | `ai_models/best_7teeth_efficientnetb0_verified.keras` | Keras classifier path |
| `YOLO_MODEL_PATH` | Yes | `ai_models/oravisionai_yolo.pt` | PyTorch YOLO detection model path |
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Allowed frontend origin for CORS |
| `CORS_ORIGINS` | Yes | `["http://localhost:5173","http://localhost:3000"]` | Permitted CORS browser origins |

> [!WARNING]
> **Secret Protection**: Never commit `backend/.env` to Git. Keep `FIREBASE_PRIVATE_KEY` wrapped in quotes with `\n` line endings.

### B. Frontend Configuration (`frontend/.env`)
Copy the frontend template:
```powershell
cp frontend/.env.example frontend/.env
```

Open `frontend/.env` and supply your Firebase Web App configuration:

| Variable Name | Required? | Example / Default Value | Where to Obtain |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | `http://localhost:8000` | Local FastAPI backend URL |
| `VITE_FIREBASE_API_KEY` | **Yes** | `AIzaSy...` | Firebase Console > Project Settings > General |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Yes** | `your-project.firebaseapp.com` | Firebase Console > Project Settings |
| `VITE_FIREBASE_PROJECT_ID` | **Yes** | `your-project-id` | Firebase Console > Project Settings |
| `VITE_FIREBASE_STORAGE_BUCKET` | **Yes**| `your-project-id.appspot.com` | Firebase Console > Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`| Yes | `123456789012` | Firebase Console > Cloud Messaging |
| `VITE_FIREBASE_APP_ID` | **Yes** | `1:123456789012:web:abcdef...` | Firebase Console > Project Settings |

---

## 6. Firebase Setup

OraVisionAI requires an active Google Firebase project to provide authentication and binary file storage.

### Step 1: Create Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it (e.g., `oravision-ai-local`). Disable Google Analytics if not needed.

### Step 2: Configure Firebase Authentication
1. In the Firebase sidebar, go to **Build > Authentication** and click **Get Started**.
2. Under the **Sign-in method** tab, select **Email/Password**.
3. Enable **Email/Password** and click **Save**. *(Do not enable Email link / passwordless)*.

### Step 3: Register Web Application
1. In Project Overview, click the **Web icon (`</>`)** to add a web application.
2. Give it a nickname (e.g., `OraVision Web`).
3. Copy the values from the generated `firebaseConfig` object into your `frontend/.env` file.

### Step 4: Configure Firebase Storage
1. In the Firebase sidebar, go to **Build > Storage** and click **Get Started**.
2. Select **Start in test mode** for local verification.
3. Choose a geographic bucket region closest to you.

### Step 5: Generate Admin SDK Service Account Credentials
1. Go to **Project Settings (gear icon) > Service accounts**.
2. Select **Python** and click **Generate new private key**.
3. Download the JSON key file.
4. Extract `project_id`, `client_email`, and `private_key` from the downloaded JSON file into `backend/.env`.

---

## 7. PostgreSQL Database Setup

### Step 1: Create Database
Connect to your local PostgreSQL server (via `psql`, pgAdmin, or Docker) and create the database:
```sql
CREATE DATABASE oravisionai;
```

If using a dedicated application user:
```sql
CREATE USER oravision_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE oravisionai TO oravision_user;
```

Ensure your `DATABASE_URL` in `backend/.env` reflects your credentials:
```text
DATABASE_URL=postgresql://postgres:password@localhost:5432/oravisionai
```

### Step 2: Execute Alembic Database Migration
From the project root, navigate to the `backend/` directory and run the initial migration:
```powershell
cd c:\Users\hp\Desktop\OravisionAI\backend
alembic upgrade head
```

### Step 3: Verify Schema Creation
Confirm that the migration successfully created all 23 database tables:
```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Expected result: 24 (23 application tables + 1 alembic_version table)
```

The 23 application tables created are:
`users`, `patients`, `dentists`, `patient_medical_profiles`, `patient_dentist_relationships`, `dentist_verifications`, `dentist_availabilities`, `screenings`, `screening_images`, `ai_models`, `ai_predictions`, `prediction_probabilities`, `yolo_detections`, `xai_visualizations`, `risk_assessments`, `clinical_reports`, `dentist_assessments`, `appointments`, `consultations`, `conversations`, `messages`, `notifications`, `audit_logs`.

---

## 8. Backend Installation & Startup

Open a terminal window dedicated to the backend service.

```powershell
# 1. Navigate to backend directory
cd c:\Users\hp\Desktop\OravisionAI\backend

# 2. Create Python virtual environment (if not already created)
python -m venv venv

# 3. Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# (On macOS/Linux: source venv/bin/activate)

# 4. Upgrade pip and install backend dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 5. Run database migrations
alembic upgrade head

# 6. Start the FastAPI Uvicorn ASGI server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

---

## 9. Backend Verification

Keep the backend terminal running. Open a browser or secondary terminal to verify the service:

| Verification Target | Target URL | Expected Response |
|---|---|---|
| **Root Status** | `http://127.0.0.1:8000/` | HTTP 200: `{"application": "OraVisionAI", "status": "online", "version": "1.0.0"}` |
| **Health Check** | `http://127.0.0.1:8000/health` | HTTP 200: `{"status": "healthy"}` |
| **Interactive API Docs** | `http://127.0.0.1:8000/docs` | Swagger UI rendering 80 endpoints across 12 tags |
| **Alternative API Docs** | `http://127.0.0.1:8000/redoc` | ReDoc API documentation page |
| **OpenAPI Specification** | `http://127.0.0.1:8000/openapi.json` | JSON schema containing full OpenAPI 3.1 contract |
| **Unauthenticated Auth Test**| `http://127.0.0.1:8000/api/users/me`| HTTP 401 Unauthorized: `{"detail": "Authentication required"}` |

---

## 10. Frontend Installation & Startup

Open a **second terminal window** dedicated to the frontend service.

```powershell
# 1. Navigate to frontend directory
cd c:\Users\hp\Desktop\OravisionAI\frontend

# 2. Install npm dependencies
npm install

# 3. Start the Vite development server
npm run dev
```

The terminal will report:
```text
  VITE v5.4.3  ready in ... ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## 11. Frontend Verification

1. Open `http://localhost:5173` in your web browser.
2. **Landing Page**: Verify that the OraVisionAI navigation header, platform feature overview, and Call-to-Action buttons render cleanly.
3. **Login View**: Click **Sign In** and verify navigation to `/login`.
4. **Register View**: Click **Create Account** and verify navigation to `/register`.
5. **Route Protection**: Attempt to navigate directly to `http://localhost:5173/patient/dashboard`. Verify that you are immediately redirected to `/login?from=%2Fpatient%2Fdashboard`.

---

## 12. Startup Order

Always start the platform components in this strict sequence:

```
[1. PostgreSQL Database] ──► [2. Firebase Services] ──► [3. FastAPI Backend] ──► [4. React Frontend]
```

### Why Order Matters:
1. **PostgreSQL** must be running before the backend boots so database connection pools and Alembic migrations can connect.
2. **Firebase** must be configured so the backend can initialize the Admin SDK and verify incoming Bearer JWT tokens.
3. **Backend** must be operational on port 8000 before the frontend attempts to sync user profiles or load clinical records.
4. **Frontend** is launched last to connect to the verified backend API.

---

## 13. Test Account Strategy

Three distinct accounts representing the three platform roles (`patient`, `dentist`, `admin`) are required for full manual verification.

### Account 1: Patient (`patient@oravision.test`)
1. In the browser, navigate to `http://localhost:5173/register`.
2. Select the **Patient** role tab.
3. Enter:
   - First Name: `Jane`
   - Last Name: `Patient`
   - Email: `patient@oravision.test`
   - Password: `Password123!`
4. Click **Create Patient Account**.
5. **System Identity Mapping**:
   - Account is created in Firebase Auth.
   - Frontend calls `GET /api/users/me` with the Firebase ID token.
   - Backend automatically creates a linked PostgreSQL `users` row (`role='patient'`) and an associated `patients` record.

### Account 2: Dentist (`dentist@oravision.test`)
1. In the browser, navigate to `http://localhost:5173/register`.
2. Select the **Dentist** role tab.
3. Enter:
   - First Name: `Arthur`
   - Last Name: `Dentist`
   - Email: `dentist@oravision.test`
   - Password: `Password123!`
4. Click **Create Dentist Account**.
5. **Initial Pending State**:
   - Backend creates `users` (`role='dentist'`) and a `dentists` profile with `verification_status='pending'`.
   - Logging in as this dentist will display a pending verification banner.
6. **Credential Verification Submission**:
   - Log in as the dentist and go to `/dentist/profile`.
   - In the **Professional Credential Verification** card, enter:
     - Document Type: `State Dental Board License`
     - Document URL: `https://verification.state.gov/license/DEN-98765`
     - File Name: `License_Certificate_DEN98765.pdf`
   - Click **Submit Credential Metadata**.
   *(Note: This submits JSON metadata; no binary file upload is used).*

### Account 3: Administrator (`admin@oravision.test`)
For security reasons, **Admin registration is disabled on the public registration page**. To establish the administrator account:
1. Register an account at `http://localhost:5173/register` using email `admin@oravision.test` and password `Password123!`.
2. Promote the user to `admin` directly in PostgreSQL:
   ```sql
   UPDATE users 
   SET role = 'admin' 
   WHERE email = 'admin@oravision.test';
   ```
3. Refresh the browser or sign out and sign back in. The user now has full administrative access to `/admin/*`.

### Approving the Dentist Account
1. Log in as the administrator (`admin@oravision.test`).
2. Navigate to `/admin/dashboard`.
3. Locate the pending verification for `Dr. Arthur Dentist` and click **Approve**.
4. Log back in as `dentist@oravision.test`. The full clinical review suite is now unlocked.

---

## 14. Role-by-Role Manual Verification Checklists

*Instructions: Do NOT pre-fill checkmarks. Record your personal manual results during runtime testing.*

### Patient Manual Checklist
- [ ] NOT TESTED — Registration via `/register` (Patient tab)
- [ ] NOT TESTED — Login via `/login`
- [ ] NOT TESTED — Redirection to `/patient/dashboard`
- [ ] NOT TESTED — Medical Profile creation/update
- [ ] NOT TESTED — New screening intake form navigation (`/patient/screenings/new`)
- [ ] NOT TESTED — Image upload validation (<15 MiB, valid format)
- [ ] NOT TESTED — AI inference trigger & progress feedback
- [ ] NOT TESTED — 7Teeth AI probability results inspection
- [ ] NOT TESTED — YOLO lesion bounding box display
- [ ] NOT TESTED — XAI heatmap overlay inspection
- [ ] NOT TESTED — Deterministic risk assessment tier review (25, 50, 75, or 100)
- [ ] NOT TESTED — Clinical PDF report generation and download
- [ ] NOT TESTED — Screening history list review (`/patient/screenings`)
- [ ] NOT TESTED — Consultation appointment booking
- [ ] NOT TESTED — Consultation session room navigation
- [ ] NOT TESTED — Asynchronous messaging thread with treating dentist
- [ ] NOT TESTED — Notification feed and unread badge update
- [ ] NOT TESTED — Logout and session clearance

### Dentist Manual Checklist
- [ ] NOT TESTED — Registration via `/register` (Dentist tab)
- [ ] NOT TESTED — Login and unverified status banner presentation
- [ ] NOT TESTED — Credential verification metadata submission
- [ ] NOT TESTED — Clinical dashboard unlock following admin approval
- [ ] NOT TESTED — Availability window schedule creation
- [ ] NOT TESTED — Appointment request confirmation
- [ ] NOT TESTED — Patient screening review interface (`/dentist/screenings/:id/review`)
- [ ] NOT TESTED — Inspection of AI probabilities, YOLO boxes, and XAI maps
- [ ] NOT TESTED — Clinical Decision-Support Disclaimer visibility
- [ ] NOT TESTED — Draft clinical assessment save and update
- [ ] NOT TESTED — Assessment finalization and UI form lock
- [ ] NOT TESTED — HTTP 409 Conflict check upon post-finalization edit attempt
- [ ] NOT TESTED — Teleconsultation session hosting (start, timer, end with summary)
- [ ] NOT TESTED — Patient follow-up messaging thread interaction
- [ ] NOT TESTED — Notifications review and badge clear

### Admin Manual Checklist
- [ ] NOT TESTED — Login as promoted administrator
- [ ] NOT TESTED — Platform KPI overview card metrics
- [ ] NOT TESTED — User status toggling (deactivation/reactivation)
- [ ] NOT TESTED — Dentist credential verification review & approval
- [ ] NOT TESTED — Audit log explorer filtering and pagination
- [ ] NOT TESTED — Screening volume time-series analytics
- [ ] NOT TESTED — AI model telemetry inspection
- [ ] NOT TESTED — Telehealth session analytics
- [ ] NOT TESTED — AI Model Registry metadata review
- [ ] NOT TESTED — Confirmation of clinical privacy guardrails (Admin blocked from patient chats)

---

## 15. Patient Screening Test

Follow this exact sequence to verify the end-to-end AI screening workflow:

1. **Sign In**: Log in as `patient@oravision.test`.
2. **Navigate**: Click **New Screening** or go to `/patient/screenings/new`.
3. **Select Image**: Choose a clear dental photograph (JPEG, PNG, or WebP under 15 MiB).
4. **Intake Context**: Fill in any optional symptoms (e.g., pain scale, duration, smoking context).
5. **Upload & Run**: Click **Submit Screening**. Verify upload progress indicator.
6. **Inspect Classification**:
   - Verify that primary classification displays one of the **authoritative 7 classes**:
     - `CaS` — Canker Sore
     - `CoS` — Cold Sore
     - `Gum` — Gum Disease
     - `MC` — Mucocele
     - `OC` — Oral Cancer
     - `OLP` — Oral Lichen Planus
     - `OT` — Oral Thrush
7. **Probability Distribution**: Confirm that probabilities sum to 1.0 (100%) and represent statistical model confidences.
8. **Spatial Localizations**: If detections are present, confirm bounding boxes outline suspected lesions with class labels.
9. **Explainable AI (XAI)**: Toggle between the original oral image and the Grad-CAM saliency heatmap overlay.
10. **Triage Risk Assessment**:
    - Review the synthesized risk level badge.
    - **CRITICAL**: Verify that risk is displayed as an ordinal technical tier rank (**25**, **50**, **75**, or **100**), NOT as a disease percentage or certainty score.
11. **Download Report**: Click **Download Clinical Report**. Verify that a PDF compiled by ReportLab downloads to your machine and that the browser blob URL is revoked.

---

## 16. Dentist Manual Verification

1. **Sign In**: Log in as the verified `dentist@oravision.test`.
2. **Open Screening**: Navigate to `/dentist/appointments` and select a patient with a completed screening.
3. **Screening Review**: Open `/dentist/screenings/:id/review`.
4. **Clinical Primacy Disclaimer**: Confirm the presence of the required disclaimer:
   > *"The treating dentist performs an independent professional clinical assessment; the AI output is decision-support evidence and does not replace the dentist's professional assessment."*
5. **Draft Assessment**: Enter provisional clinical notes and diagnosis. Click **Save Draft**. Confirm draft remains editable.
6. **Finalize Assessment**: Click **Finalize Assessment**. Confirm the warning notice:
   > *"Locks the assessment form after finalization; finalized assessments cannot be edited through this system."*
7. **Verify Immutability**:
   - Confirm that all form fields lock in read-only mode.
   - Attempting to submit a modification triggers an HTTP 409 Conflict response from the backend.

---

## 17. Admin Manual Verification

1. **Sign In**: Log in as `admin@oravision.test`.
2. **KPI Dashboard**: View active counts for Users, Screenings, Appointments, and Verifications.
3. **Audit Explorer**: Navigate to `/admin/audit-logs`. Confirm immutable audit entries recording user logins, assessments, and status updates.
4. **Analytics Semantics Verification**:
   - **Screening Analytics**: Confirm cohorts are anchored strictly to `Screening.created_at`.
   - **AI Telemetry**: Confirm telemetry displays average confidence (which is **NOT** clinical accuracy) and YOLO detection counts (which are **NOT** confirmed diagnoses).
   - **Model Registry**: Inspect active model version info; verify that internal server file paths and `weights_path` are never exposed to the client.
5. **Clinical Privacy Enforcement**:
   - Attempt to navigate directly to `/patient/messages/any-id`.
   - Confirm that the action URL resolver safely redirects you to `/admin/audit-logs`. Admins cannot access private clinical conversation threads.

---

## 18. Appointment Test

1. **Patient Booking**:
   - Sign in as patient. Go to `/patient/consultations`.
   - Select `Dr. Arthur Dentist`, choose an available slot, and click **Book Appointment**.
   - Verify appointment status is `requested`.
2. **Dentist Confirmation**:
   - Sign in as dentist. Go to `/dentist/appointments`.
   - Locate the appointment and click **Confirm**.
   - Status transitions to `confirmed`.
3. **Relationship Creation**:
   - Confirm that booking an appointment creates an active `PatientDentistRelationship` between the patient and dentist.
4. **Supported Lifecycle Statuses**:
   Verify that appointments only traverse valid frozen statuses:
   `requested` ➔ `confirmed` ➔ `in_progress` ➔ `completed` (or `cancelled`, `rescheduled`, `no_show`).

---

## 19. Consultation Test

> [!NOTE]
> **Consultation Container**: The consultation module provides session metadata, lifecycle transitions, duration timing, and clinical summary notes. It **does NOT** transmit live video or audio streams.

1. **Start Consultation**:
   - Sign in as dentist for a `confirmed` appointment.
   - Navigate to `/dentist/consultations/:id`.
   - Click **Start Session**. Status transitions from `scheduled` to `active`.
2. **Active Duration Timer**:
   - Confirm the elapsed seconds timer increments once per second.
   - Confirm background polling polls at a 4-second interval.
3. **End Session**:
   - Enter a clinical summary note and click **End Consultation**.
   - Status transitions to `ended`.
   - Confirm polling stops immediately upon reaching the terminal `ended` state.

---

## 20. Messaging Test

> [!NOTE]
> **Asynchronous REST Messaging**: Communication operates via HTTP REST polling. It is **NOT** a live WebSocket or Stream Chat service.

1. **Relationship Check**:
   - Verify that messaging requires an active `PatientDentistRelationship`. Patients cannot initiate conversations with arbitrary dentists.
2. **Patient to Dentist**:
   - Sign in as patient. Open `/patient/messages/:conversationId`.
   - Send message: `"Dr. Dentist, I have a question regarding my screening."`
   - Verify message appears with status indicator: **Sent**.
3. **Dentist to Patient**:
   - Sign in as dentist. Open `/dentist/messages/:conversationId`.
   - View the patient's message.
   - Send reply: `"I have reviewed your screening and will discuss it during consultation."`
   - Patient's view updates message indicator to **Read** upon polling tick.

---

## 21. Notification Test

Verify that in-app notifications are generated and delivered for the **exact 9 supported types**:

| Notification Type | Trigger Event | Target Recipient |
|---|---|---|
| `screening_completed` | AI analysis completes successfully | Patient |
| `screening_failed` | Image processing error | Patient |
| `appointment_booked` | Patient requests consultation | Dentist |
| `appointment_confirmed` | Dentist accepts consultation | Patient |
| `appointment_cancelled` | Cancellation by either party | Opposite party |
| `dentist_verified` | Admin approves credentials | Dentist |
| `dentist_assessment_added` | Dentist finalizes clinical review | Patient |
| `new_message` | Incoming direct message | Recipient user |
| `system_alert` | Platform-wide maintenance/notice | User |

Verify that clicking a notification navigates safely via `resolveNotificationActionUrl` to the appropriate dashboard or record.

---

## 22. Security & Negative Testing Checklist

Execute these negative test scenarios to verify security boundaries and error handling:

| Test ID | Action / Input | Expected Behavior | Expected Status | Result |
|---|---|---|---|---|
| **SEC-01** | Patient attempts to navigate to `/dentist/dashboard` | Redirects to `/unauthorized` | 403 Forbidden | [ ] NOT TESTED |
| **SEC-02** | Patient attempts to navigate to `/admin/dashboard` | Redirects to `/unauthorized` | 403 Forbidden | [ ] NOT TESTED |
| **SEC-03** | Dentist attempts to access another patient's screening without a relationship | Access denied alert | 403 Forbidden | [ ] NOT TESTED |
| **SEC-04** | Admin attempts to access patient conversation thread | Redirected to `/admin/audit-logs` | Redirection | [ ] NOT TESTED |
| **SEC-05** | Unauthenticated user calls `/api/users/me` | Rejection with WWW-Authenticate | 401 Unauthorized | [ ] NOT TESTED |
| **SEC-06** | Deactivated user attempts to access any protected route | Redirects to `/deactivated` | 403 Forbidden | [ ] NOT TESTED |
| **SEC-07** | Upload image exceeding 15 MiB | Client validation blocks upload | Client Alert | [ ] NOT TESTED |
| **SEC-08** | Upload non-image file (`.exe` or `.txt`) | Client validation blocks upload | Client Alert | [ ] NOT TESTED |
| **SEC-09** | Attempt to modify a finalized dentist assessment | Form locked; API rejects edit | 409 Conflict | [ ] NOT TESTED |
| **SEC-10** | Attempt to book overlapping appointment slot | Validation error alert | 409 Conflict | [ ] NOT TESTED |
| **SEC-11** | Direct URL tampering with directory traversal (`/patient/..`) | Action resolver normalizes safely | Redirection | [ ] NOT TESTED |
| **SEC-12** | Protocol injection in notification (`javascript:alert(1)`) | Action resolver rejects URL | Fallback to `/` | [ ] NOT TESTED |

---

## 23. API Contract Spot Check

Verify endpoints manually or via Swagger UI (`http://127.0.0.1:8000/docs`):

- **Auth**: `POST /api/auth/verify-token`
- **Users**: `GET /api/users/me`, `GET /api/users/me/patient-access`, `GET /api/users/me/dentist-access`, `GET /api/users/me/admin-access`
- **Patients**: `GET /api/patients/me`, `PUT /api/patients/me/medical-profile`
- **Dentists**: `GET /api/dentists`, `GET /api/dentists/{id}`, `POST /api/dentists/me/verification`, `POST /api/dentists/me/availability`
- **Screenings**: `POST /api/screenings`, `POST /api/screenings/{id}/images`, `POST /api/screenings/{id}/run-ai`, `POST /api/screenings/{id}/risk-assessment`
- **XAI**: `GET /api/xai/methods`, `POST /api/screenings/{id}/xai`
- **Reports**: `GET /api/reports/{id}`, `GET /api/reports/{id}/download`
- **Appointments**: `POST /api/appointments`, `GET /api/appointments/{id}`, `PATCH /api/appointments/{id}/status`
- **Consultations**: `GET /api/consultations/{id}`, `POST /api/consultations/{id}/start`, `POST /api/consultations/{id}/end`
- **Conversations**: `GET /api/conversations`, `POST /api/conversations`, `POST /api/conversations/{id}/messages`
- **Notifications**: `GET /api/notifications`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/read-all`
- **Admin**: `GET /api/admin/kpis`, `GET /api/admin/audit-logs`, `GET /api/admin/analytics/screenings`, `POST /api/admin/dentist-verifications/{id}/approve`

---

## 24. Storage Verification

### Runtime Storage Path Invariants
Files uploaded to Firebase Storage adhere to these structured paths:
- **Screening Photos**: `screenings/{patient_id}/{screening_id}/{safe_uuid}.{ext}`
- **XAI Heatmaps**: `xai/{patient_id}/{screening_id}/{prediction_id}/{method}/heatmap_{safe_hash}.png`
- **XAI Overlays**: `xai/{patient_id}/{screening_id}/{prediction_id}/{method}/overlay_{safe_hash}.png`
- **Clinical Reports**: `reports/{patient_id}/{screening_id}/{safe_report_num}.pdf`

### Storage Access Rules
- Private screening photos and XAI overlays are restricted by cloud storage rules.
- Clinical report PDFs are streamed directly from the authenticated FastAPI backend via `GET /api/reports/{id}/download`. Direct public browser URLs to storage are never exposed.

---

## 25. Expected UI / Route Map

All 33 application routes defined in [`AppRoutes.tsx`](file:///c:/Users/hp/Desktop/OravisionAI/frontend/src/routes/AppRoutes.tsx):

### Public Routes (5 routes)
- `/` — Landing Page
- `/login` — User Sign In
- `/register` — Account Registration
- `/unauthorized` — Role Access Denied
- `/deactivated` — Suspended Account Notice

### Patient Shell (`/patient/*` — 10 routes)
- `/patient/dashboard` — Patient Summary Dashboard
- `/patient/screenings` — Screening History List
- `/patient/screenings/new` — New Oral Screening Intake
- `/patient/screenings/:screeningId` — Screening AI & XAI Results
- `/patient/consultations` — Appointment Booking & Telehealth Sessions
- `/patient/consultations/:consultationId` — Patient Consultation Room
- `/patient/messages` — Conversation Thread List
- `/patient/messages/:conversationId` — Active Messaging Thread
- `/patient/notifications` — In-App Notifications Feed
- `/patient` — Index redirect to `/patient/dashboard`

### Dentist Shell (`/dentist/*` — 9 routes)
- `/dentist/dashboard` — Practitioner Dashboard
- `/dentist/appointments` — Appointment Schedule Management
- `/dentist/screenings/:screeningId/review` — Clinical Screening Review & Assessment
- `/dentist/consultations/:consultationId` — Dentist Consultation Room
- `/dentist/profile` — Professional Profile & Verification Status
- `/dentist/messages` — Patient Direct Conversations
- `/dentist/messages/:conversationId` — Patient Messaging Thread
- `/dentist/notifications` — Notification Alerts Feed
- `/dentist` — Index redirect to `/dentist/dashboard`

### Admin Shell (`/admin/*` — 8 routes)
- `/admin/dashboard` — Platform Oversight & KPI Metrics
- `/admin/audit-logs` — Immutable Audit Trail Explorer
- `/admin/analytics/screenings` — Screening Volume Time-Series
- `/admin/analytics/ai-telemetry` — AI Model Telemetry & Confidence
- `/admin/analytics/telehealth` — Consultation Session Analytics
- `/admin/ai-models` — AI Model Registry & Version Inspector
- `/admin/notifications` — Administrative Notifications
- `/admin` — Index redirect to `/admin/dashboard`

### Catch-All Route (1 route)
- `*` — 404 Page Not Found

---

## 26. Troubleshooting Guide

| Symptom | Likely Cause | What to Check | Safe Corrective Action |
|---|---|---|---|
| **Backend will not start** | Missing virtual environment or uninstalled dependencies | Terminal output | Run `pip install -r requirements.txt` inside activated virtual environment. |
| **Port 8000 already in use** | Stray Python process holding the port | `netstat -ano \| findstr :8000` | Terminate old process (`taskkill /PID <PID> /F`) or use `--port 8001` (update `VITE_API_BASE_URL`). |
| **Frontend will not start** | Node modules missing or Vite port blocked | Terminal output | Run `npm install`. Check if port 5173 is occupied. |
| **Database connection error** | PostgreSQL service stopped or invalid password | `backend/.env` `DATABASE_URL` | Start PostgreSQL service. Verify credentials via `psql` or pgAdmin. |
| **Alembic migration fails** | Database does not exist or invalid schema version | Alembic error log | Ensure `CREATE DATABASE oravisionai;` was executed. Check `alembic current`. |
| **Firebase Auth fails** | Missing or incorrect Firebase Web config | Browser DevTools Console | Verify `VITE_FIREBASE_API_KEY` and project ID in `frontend/.env`. Ensure Email/Password provider is enabled. |
| **CORS error in browser** | Backend `CORS_ORIGINS` does not include frontend origin | Browser Network tab | In `backend/.env`, set `CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]`. |
| **HTTP 401 Unauthorized** | Expired or missing Firebase ID token | Request Authorization header | Ensure user is signed in. Check Firebase token freshness. |
| **HTTP 403 Forbidden** | Role mismatch or unapproved dentist | User role in database | Verify user role matches route. Ensure dentist has `verification_status='approved'`. |
| **HTTP 409 Conflict** | Assessment already finalized or slot double-booked | Response error message | Finalized assessments cannot be edited. Choose an unoccupied consultation slot. |
| **HTTP 422 Validation Error** | Request payload violates Pydantic schema | Response detail array | Inspect field validation requirements in `/docs` Swagger UI. |
| **AI models fail to load** | Missing model weight files in `ai_models/` | Backend logs | Ensure `.keras` and `.pt` files exist in `backend/ai_models/` or mock inference is enabled. |
| **Report download fails** | Backend report generation error | Backend terminal output | Ensure ReportLab is installed (`pip install reportlab`). Check file write permissions. |

---

## 27. Manual Verification Record

Fill in this record during your manual verification session:

```text
===========================================================================
ORAVISIONAI MANUAL RUNTIME VERIFICATION RECORD
===========================================================================
Verification Date: ____________________
Operator Name:     ____________________
Operating System:  ____________________
Python Version:    ____________________
Node Version:      ____________________
npm Version:       ____________________
PostgreSQL Ver:    ____________________
Browser & Version: ____________________
Backend URL:       http://127.0.0.1:8000
Frontend URL:      http://localhost:5173

--- Patient Journey Verification ---
[ ] NOT TESTED : Registration & Login
[ ] NOT TESTED : Profile & Medical History Form
[ ] NOT TESTED : New Screening Intake & Upload
[ ] NOT TESTED : 7Teeth AI Classification Results
[ ] NOT TESTED : YOLO Lesion Localization Bounding Boxes
[ ] NOT TESTED : XAI Grad-CAM Heatmap Overlays
[ ] NOT TESTED : Risk Triage Tier Display (25/50/75/100)
[ ] NOT TESTED : Clinical Report PDF Download
[ ] NOT TESTED : Consultation Booking
[ ] NOT TESTED : Patient Consultation Room
[ ] NOT TESTED : Asynchronous Messaging
[ ] NOT TESTED : Notification Feed

--- Dentist Journey Verification ---
[ ] NOT TESTED : Dentist Registration & Unverified Banner
[ ] NOT TESTED : Credential Verification Metadata Submit
[ ] NOT TESTED : Unlocking Clinical Suite after Approval
[ ] NOT TESTED : Availability Schedule Creation
[ ] NOT TESTED : Appointment Confirmation
[ ] NOT TESTED : Screening Review Interface
[ ] NOT TESTED : Clinical Primacy Disclaimer
[ ] NOT TESTED : Draft Assessment Save
[ ] NOT TESTED : Assessment Finalization & Form Locking
[ ] NOT TESTED : Verification of HTTP 409 on Edit Attempt
[ ] NOT TESTED : Teleconsultation Session Lifecycle
[ ] NOT TESTED : Dentist-to-Patient Messaging

--- Admin Journey Verification ---
[ ] NOT TESTED : Admin Promotion & Dashboard Login
[ ] NOT TESTED : Platform KPI Oversight
[ ] NOT TESTED : User Deactivation / Reactivation
[ ] NOT TESTED : Dentist Credential Approval
[ ] NOT TESTED : Audit Log Explorer & Filtering
[ ] NOT TESTED : Screening Volume Analytics
[ ] NOT TESTED : AI Model Telemetry Inspection
[ ] NOT TESTED : Telehealth Analytics
[ ] NOT TESTED : AI Model Registry Inspection
[ ] NOT TESTED : Clinical Privacy Isolation (No Chat Access)

--- Security & Invariants Verification ---
[ ] NOT TESTED : Role Guard Redirections (Patient -> Dentist)
[ ] NOT TESTED : Role Guard Redirections (Patient -> Admin)
[ ] NOT TESTED : Role Guard Redirections (Dentist -> Patient)
[ ] NOT TESTED : Deactivated Account Redirection
[ ] NOT TESTED : File Upload Restrictions (>15 MiB blocked)
[ ] NOT TESTED : Non-image File Type Blocked
[ ] NOT TESTED : Double Booking Rejection (HTTP 409)
[ ] NOT TESTED : Finalized Assessment Rejection (HTTP 409)

OVERALL VERIFICATION OUTCOME:
[ ] NOT TESTED
[ ] PASS — Full Runtime Verification Successful
[ ] PASS WITH NOTES — Non-blocking observations recorded
[ ] FAIL — Blocking issue identified

Operator Signature: _______________________ Date: ______________
===========================================================================
```

---

## 28. Optional Automated Pre-Flight

Before launching the manual verification session, you may run the existing automated static validation suites to confirm codebase baseline integrity:

```powershell
# 1. Frontend TypeScript Compilation Check (0 errors expected)
cd c:\Users\hp\Desktop\OravisionAI\frontend
npm run typecheck

# 2. Frontend Production Build Check (Clean bundle expected)
npm run build

# 3. Phase 30 Static Baseline & Semantic Integrity Script
python C:\Users\hp\.gemini\antigravity\brain\30e7f4e6-8cb3-4702-857a-3a9ca5c60c11\scratch\validate_phase30.py
```

> [!IMPORTANT]
> **AUTOMATED STATIC VALIDATION ONLY**: These automated scripts test source syntax, file counts, and schema ASTs. They **do NOT** replace the manual runtime verification outlined in this guide.

---

## 29. Final Repository State Verification

This guide was generated under the strict Phase 30.5 constraint:
- **Modified Production Files**: Exactly **0**
- **Modified Backend Files**: Exactly **0**
- **Database / Schema Changes**: Exactly **0**
- **Dependency Changes**: Exactly **0**
- **Created Documentation File**: Exactly **1** (`docs/LOCAL_RUN_AND_MANUAL_VERIFICATION_GUIDE.md`)

The OraVisionAI codebase remains 100% frozen, integral, and prepared for your manual runtime verification.

