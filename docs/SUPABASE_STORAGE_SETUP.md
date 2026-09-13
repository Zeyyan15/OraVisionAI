# OraVisionAI — Supabase Storage Setup Guide (Phase 31)

This document details the configuration and operational setup for Supabase Storage as the application's artifact storage provider.

---

## Architectural Role & Boundaries

| Component | Status | Purpose |
| :--- | :--- | :--- |
| **Firebase Authentication** | **RETAINED** | User authentication, identity management, Firebase ID tokens, and session verification. |
| **Firebase Cloud Storage** | **REMOVED** | Deprecated and decommissioned due to project-level provisioning limitations. |
| **Supabase Storage** | **NEW ARTIFACT PROVIDER** | Private object storage for screening photos, XAI heatmaps, XAI overlays, and clinical report PDFs. |

---

## Step-by-Step Supabase Storage Configuration

### 1. Create Supabase Project
1. Log in to your Supabase Dashboard (https://supabase.com/dashboard).
2. Click **New project** and select your organization.
3. Enter a project name (e.g., oravisionai) and secure database password.
4. Select your preferred deployment region.

### 2. Create Private Storage Bucket
1. In the Supabase Project sidebar, navigate to **Storage**.
2. Click **New bucket**.
3. Set the **Bucket name** to: oravisionai.
4. Ensure the **Public bucket** toggle is **OFF** (the bucket MUST be **PRIVATE**).
5. Click **Save**.

### 3. Obtain Project URL and Service-Role Key
1. Navigate to **Project Settings** (gear icon) > **API**.
2. Copy the **Project URL** (format: https://<project-ref>.supabase.co).
3. Under **Project API keys**, find the **service_role (secret)** key.
   > The service_role key bypasses Row Level Security and has full administrative access. It must **NEVER** be committed to Git, exposed in frontend source code, or shared via client applications.

### 4. Configure Backend Environment (ackend/.env)
Add the following variables to ackend/.env:

`env
# --- Supabase Storage ---
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>
SUPABASE_STORAGE_BUCKET=oravisionai
`

### 5. Verify Security Rules
- Ensure SUPABASE_SERVICE_ROLE_KEY exists **only** in ackend/.env.
- Ensure ackend/.env is included in .gitignore.
- Do **NOT** set any VITE_SUPABASE_* environment variables in rontend/.env.
- Frontend clients never communicate directly with Supabase Storage; all access is brokered via authenticated FastAPI endpoints that verify user identity, role, and clinical ownership.

---

## Application Storage Paths (Frozen)

OraVisionAI stores all artifacts under standardized, collision-resistant paths:

- **Screening Photographs**: screenings/{patient_id}/{screening_id}/{safe_uuid}.{ext}
- **XAI Heatmaps**: xai/{patient_id}/{screening_id}/{prediction_id}/{method}/heatmap_{safe_hash}.png
- **XAI Overlays**: xai/{patient_id}/{screening_id}/{prediction_id}/{method}/overlay_{safe_hash}.png
- **Clinical Report PDFs**: 
eports/{patient_id}/{screening_id}/{safe_report_num}.pdf

---

## Artifact Access Flow

`
Frontend (React)
    │
    │ 1. Request Signed URL (with Firebase Bearer Token)
    ▼
FastAPI Backend (GET /api/screenings/{id}/artifacts/signed-url?path=...)
    │
    │ 2. Verify Firebase Identity & Active Status
    │ 3. Enforce Ownership / Treating Dentist Access Rule
    │ 4. Validate Path against Screening DB Records (Prevent Traversal)
    │ 5. Call Supabase Storage REST API (POST /storage/v1/object/sign/...)
    ▼
Supabase Storage
    │
    │ 6. Generate 15-Minute Signed URL
    ▼
Frontend displays artifact (<img src={signed_url} />)
`
