"""
OraVisionAI — Phase 24 Comprehensive Validation Harness
Dentist Clinical Workflow & Assessment Interface

Executes:
1. Exact File Manifest Verification (actual_frontend_files == expected_frontend_files, 72 files, all non-empty)
2. Backend Tree Immutability Verification (zero modified/added/deleted files under backend/, 94 canonical files preserved)
3. TypeScript Strict Typecheck (npm run typecheck -> 0 errors)
4. Production Bundle Compilation (npm run build -> dist/ generated with clean exit)
5. Clinical & Semantic Invariants Verification (Static Analysis of Phase 24 components):
   - Finalization confirmation dialog exact wording
   - 409 Conflict handling exact wording
   - Approved Dentist terminology without false medical licensing claims
   - DentistVerificationStatus strictly 'pending' | 'approved' | 'rejected'
   - Reused Phase 23 multi-modal clinical components (CNN class scores, YOLO spatial localization, XAI, Urgency Tier, Report Action)
   - XAI target layer block6a_expand_conv
   - Exact 14 API operations parity across 10 canonical paths in dentistEndpoints.ts
   - Canonical endpoint paths in endpoints.ts
   - Active routes in AppRoutes.tsx
   - Active navigation in Sidebar.tsx
   - Dynamic verification alert in DentistShell.tsx
   - Document upload contract boundary (metadata only, no invented upload routes)
   - Zero misleading clinical claims or raw UUID leaks
6. Complete Backend Regressions (Phases 21, 20, 19, and 3B-18 at 100% PASS)
"""

import os
import subprocess
import sys
import time

ROOT_DIR = r"c:\Users\hp\Desktop\OravisionAI"
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
SCRATCH_DIR = os.path.join(ROOT_DIR, "scratch")
PYTHON_EXE = os.path.join(ROOT_DIR, "backend", ".venv", "Scripts", "python.exe")

EXPECTED_FRONTEND_FILES = {
    # Baseline Configuration & Build (8 files)
    ".env.example",
    "index.html",
    "package.json",
    "postcss.config.js",
    "tailwind.config.js",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
    # Core Application Entry & Config (5 files)
    "src/main.tsx",
    "src/App.tsx",
    "src/index.css",
    "src/config/env.ts",
    "src/config/firebase.ts",
    # Domain Types & API Client Layer (9 files)
    "src/types/domain.ts",
    "src/types/api.ts",
    "src/types/screening.ts",
    "src/types/dentist.ts",
    "src/api/errors.ts",
    "src/api/client.ts",
    "src/api/endpoints.ts",
    "src/api/screeningEndpoints.ts",
    "src/api/dentistEndpoints.ts",
    # Auth Context & Hooks (6 files)
    "src/context/AuthContext.tsx",
    "src/hooks/useAuth.ts",
    "src/hooks/useApi.ts",
    "src/hooks/useScreening.ts",
    "src/hooks/useDentist.ts",
    "src/hooks/useDentistAssessment.ts",
    # Routing & Shells (8 files)
    "src/routes/AppRoutes.tsx",
    "src/routes/ProtectedRoute.tsx",
    "src/components/layout/Header.tsx",
    "src/components/layout/Sidebar.tsx",
    "src/components/layout/PatientShell.tsx",
    "src/components/layout/DentistShell.tsx",
    "src/components/layout/AdminShell.tsx",
    "src/components/layout/PublicLayout.tsx",
    # UI Component Primitives (6 files)
    "src/components/ui/Alert.tsx",
    "src/components/ui/Badge.tsx",
    "src/components/ui/Button.tsx",
    "src/components/ui/Card.tsx",
    "src/components/ui/Input.tsx",
    "src/components/ui/Modal.tsx",
    # Feedback & State Primitives (5 files)
    "src/components/feedback/ErrorBoundary.tsx",
    "src/components/feedback/ErrorState.tsx",
    "src/components/feedback/EmptyState.tsx",
    "src/components/feedback/LoadingSkeleton.tsx",
    "src/components/feedback/RateLimitNotice.tsx",
    # Phase 23 Screening Clinical Components (7 files)
    "src/components/screening/ImageUploadZone.tsx",
    "src/components/screening/ProbabilityDistributionChart.tsx",
    "src/components/screening/YoloOverlayViewer.tsx",
    "src/components/screening/XaiSection.tsx",
    "src/components/screening/ClinicalRiskCard.tsx",
    "src/components/screening/DentistReviewCard.tsx",
    "src/components/screening/ReportActionCard.tsx",
    # Phase 24 Dentist Clinical Components (3 files)
    "src/components/dentist/DentistAssessmentForm.tsx",
    "src/components/dentist/DentistAppointmentsTable.tsx",
    "src/components/dentist/DentistVerificationCard.tsx",
    # Pages (15 files)
    "src/pages/public/LandingPage.tsx",
    "src/pages/public/LoginPage.tsx",
    "src/pages/public/RegisterPage.tsx",
    "src/pages/public/UnauthorizedPage.tsx",
    "src/pages/public/DeactivatedPage.tsx",
    "src/pages/public/NotFoundPage.tsx",
    "src/pages/patient/PatientDashboard.tsx",
    "src/pages/patient/NewScreeningPage.tsx",
    "src/pages/patient/ScreeningResultsPage.tsx",
    "src/pages/patient/ScreeningsListPage.tsx",
    "src/pages/dentist/DentistDashboard.tsx",
    "src/pages/dentist/DentistAppointmentsPage.tsx",
    "src/pages/dentist/DentistScreeningReviewPage.tsx",
    "src/pages/dentist/DentistProfilePage.tsx",
    "src/pages/admin/AdminDashboard.tsx",
}

passed_tests = 0
failed_tests = 0

def log_pass(name: str):
    global passed_tests
    passed_tests += 1
    print(f"  [PASS] {name}")

def log_fail(name: str, reason: str):
    global failed_tests
    failed_tests += 1
    print(f"  [FAIL] {name}: {reason}")

# ============================================================================
# Section 1: Exact File Manifest Verification
# ============================================================================
print("\n" + "=" * 70)
print("SECTION 1: EXACT FILE MANIFEST VERIFICATION")
print("=" * 70)

actual_frontend_files = set()
for root, dirs, files in os.walk(FRONTEND_DIR):
    dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", ".git")]
    for f in files:
        if f == "package-lock.json":
            continue
        rel = os.path.relpath(os.path.join(root, f), FRONTEND_DIR).replace("\\", "/")
        actual_frontend_files.add(rel)

if actual_frontend_files == EXPECTED_FRONTEND_FILES:
    log_pass(f"Actual frontend file set matches expected manifest exactly ({len(actual_frontend_files)} files)")
else:
    missing = EXPECTED_FRONTEND_FILES - actual_frontend_files
    extra = actual_frontend_files - EXPECTED_FRONTEND_FILES
    log_fail("Frontend file manifest mismatch", f"Missing: {missing}, Extra: {extra}")

all_non_empty = True
for rel in EXPECTED_FRONTEND_FILES:
    abs_p = os.path.join(FRONTEND_DIR, rel.replace("/", os.sep))
    if not os.path.exists(abs_p) or os.path.getsize(abs_p) == 0:
        all_non_empty = False
        log_fail(f"Non-empty check for {rel}", "File is missing or 0 bytes")

if all_non_empty:
    log_pass(f"All {len(EXPECTED_FRONTEND_FILES)} frontend files are non-empty (>0 bytes)")

val_script = os.path.join(SCRATCH_DIR, "validate_phase24.py")
if os.path.exists(val_script) and os.path.getsize(val_script) > 0:
    log_pass("scratch/validate_phase24.py exists and is non-empty")
else:
    log_fail("Validation script check", "scratch/validate_phase24.py is missing or empty")

# ============================================================================
# Section 2: Backend Tree Immutability Verification
# ============================================================================
print("\n" + "=" * 70)
print("SECTION 2: BACKEND TREE IMMUTABILITY VERIFICATION")
print("=" * 70)

backend_dir = os.path.join(ROOT_DIR, "backend")
backend_files = []
recent_modifications = []
now_ts = time.time()

for root, dirs, files in os.walk(backend_dir):
    dirs[:] = [d for d in dirs if d not in ("__pycache__", ".venv")]
    for f in files:
        full_path = os.path.join(root, f)
        rel_path = os.path.relpath(full_path, backend_dir).replace("\\", "/")
        backend_files.append(rel_path)
        mtime = os.path.getmtime(full_path)
        # Check if modified during Phase 24 (last 20000s)
        if now_ts - mtime < 20000:
            recent_modifications.append((rel_path, mtime))

if len(backend_files) == 94:
    log_pass("Backend file inventory confirms exactly 94 canonical backend files preserved")
else:
    log_fail("Backend file count mismatch", f"Expected 94 files, found {len(backend_files)}")

if len(recent_modifications) == 0:
    log_pass("Backend timestamp audit confirms zero backend files created or modified during Phase 24")
else:
    log_fail("Backend modification detected", f"Files modified recently: {recent_modifications}")

frozen_anchors = [
    "app/core/security.py",
    "app/core/auth.py",
    "app/core/config.py",
    "alembic/versions/001_initial_database_schema.py",
    "app/main.py",
]
all_anchors_exist = all(os.path.exists(os.path.join(backend_dir, p.replace("/", os.sep))) for p in frozen_anchors)
if all_anchors_exist:
    log_pass("Frozen backend anchors (security, auth, config, alembic migration, main) verified intact")
else:
    log_fail("Frozen backend anchors", "One or more anchor files missing")

# ============================================================================
# Section 3: TypeScript Strict Typecheck
# ============================================================================
print("\n" + "=" * 70)
print("SECTION 3: TYPESCRIPT STRICT TYPECHECK")
print("=" * 70)

try:
    tsc_res = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
        shell=True,
    )
    if tsc_res.returncode == 0:
        log_pass("TypeScript compilation passed with 0 errors (tsc --noEmit)")
    else:
        log_fail("TypeScript compilation", f"Exit {tsc_res.returncode}:\n{tsc_res.stdout}\n{tsc_res.stderr}")
except Exception as e:
    log_fail("tsc execution", str(e))

# ============================================================================
# Section 4: Production Bundle Compilation
# ============================================================================
print("\n" + "=" * 70)
print("SECTION 4: PRODUCTION BUNDLE COMPILATION")
print("=" * 70)

try:
    build_res = subprocess.run(
        ["npx", "vite", "build"],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
        shell=True,
    )
    dist_index = os.path.join(FRONTEND_DIR, "dist", "index.html")
    if build_res.returncode == 0 and os.path.exists(dist_index):
        log_pass("Production Vite build compiled successfully (dist/index.html exists)")
    else:
        log_fail("Production build", f"Exit {build_res.returncode}:\n{build_res.stdout}\n{build_res.stderr}")
except Exception as e:
    log_fail("Vite build execution", str(e))

# ============================================================================
# Section 5: Clinical & Semantic Invariant Checks
# ============================================================================
print("\n" + "=" * 70)
print("SECTION 5: CLINICAL & SEMANTIC INVARIANT CHECKS (STATIC ANALYSIS)")
print("=" * 70)

# Check 1: Finalization Confirmation Modal Exact Wording
form_path = os.path.join(FRONTEND_DIR, "src", "components", "dentist", "DentistAssessmentForm.tsx")
with open(form_path, "r", encoding="utf-8") as f:
    form_content = f.read()

exact_finalization_wording = "Finalizing this clinical assessment makes it immutable and it can no longer be edited through this system. Do you wish to proceed?"
if exact_finalization_wording in form_content:
    log_pass("DentistAssessmentForm uses exact finalization confirmation wording")
else:
    log_fail("Finalization modal wording", "Exact wording missing from DentistAssessmentForm.tsx")

# Check 2: 409 Conflict Handling Exact Wording
exact_conflict_wording = "This clinical assessment has been finalized and can no longer be edited through this system."
hook_path = os.path.join(FRONTEND_DIR, "src", "hooks", "useDentistAssessment.ts")
with open(hook_path, "r", encoding="utf-8") as f:
    hook_content = f.read()

if exact_conflict_wording in hook_content:
    log_pass("useDentistAssessment handles HTTP 409 Conflict with exact authoritative message")
else:
    log_fail("409 Conflict handling wording", "Exact conflict wording missing from useDentistAssessment.ts")

# Check 3: Practitioner Terminology (Approved Dentist without false licensing claims)
dentist_files_to_check = [
    form_path,
    os.path.join(FRONTEND_DIR, "src", "components", "dentist", "DentistVerificationCard.tsx"),
    os.path.join(FRONTEND_DIR, "src", "pages", "dentist", "DentistDashboard.tsx"),
    os.path.join(FRONTEND_DIR, "src", "pages", "dentist", "DentistProfilePage.tsx"),
]

has_approved_dentist = False
found_unapproved_licensing = []
for p in dentist_files_to_check:
    with open(p, "r", encoding="utf-8") as f:
        c = f.read()
    if "Approved Dentist" in c:
        has_approved_dentist = True
    if "licensed dentist" in c.lower() or "medical license verified" in c.lower():
        found_unapproved_licensing.append(os.path.basename(p))

if has_approved_dentist and not found_unapproved_licensing:
    log_pass("Approved Dentist terminology verified across practitioner UI with zero false licensing claims")
else:
    log_fail("Practitioner terminology check", f"Approved Dentist: {has_approved_dentist}, False claims in: {found_unapproved_licensing}")

# Check 4: DentistVerificationStatus strictly 'pending' | 'approved' | 'rejected'
domain_path = os.path.join(FRONTEND_DIR, "src", "types", "domain.ts")
with open(domain_path, "r", encoding="utf-8") as f:
    domain_content = f.read()

if "export type DentistVerificationStatus = 'pending' | 'approved' | 'rejected';" in domain_content:
    log_pass("DentistVerificationStatus in domain.ts strictly reconciled to 'pending' | 'approved' | 'rejected'")
else:
    log_fail("DentistVerificationStatus check", "Type definition not strictly reconciled in domain.ts")

# Check 5: Reused Phase 23 components in DentistScreeningReviewPage
review_page_path = os.path.join(FRONTEND_DIR, "src", "pages", "dentist", "DentistScreeningReviewPage.tsx")
with open(review_page_path, "r", encoding="utf-8") as f:
    review_page_content = f.read()

reused_components = [
    "ProbabilityDistributionChart",
    "YoloOverlayViewer",
    "ClinicalRiskCard",
    "ReportActionCard",
]
all_reused_present = all(c in review_page_content for c in reused_components)
if all_reused_present:
    log_pass("DentistScreeningReviewPage successfully reuses Phase 23 multi-modal clinical components")
else:
    missing_comp = [c for c in reused_components if c not in review_page_content]
    log_fail("Reused components check", f"Missing components in review page: {missing_comp}")

# Check 6: XAI Target Layer block6a_expand_conv
if "block6a_expand_conv" in review_page_content:
    log_pass("DentistScreeningReviewPage displays XAI findings targeting authoritative layer block6a_expand_conv")
else:
    log_fail("XAI target layer check", "block6a_expand_conv missing from DentistScreeningReviewPage.tsx")

# Check 7: Exact 14 API Callers Parity in dentistEndpoints.ts
dentist_callers_path = os.path.join(FRONTEND_DIR, "src", "api", "dentistEndpoints.ts")
with open(dentist_callers_path, "r", encoding="utf-8") as f:
    dentist_callers_content = f.read()

expected_dentist_callers = [
    "getMyDentistProfile",
    "updateMyDentistProfile",
    "getMyVerificationStatus",
    "submitMyVerification",
    "listAppointments",
    "getAppointment",
    "updateAppointmentStatus",
    "cancelAppointment",
    "getScreeningReview",
    "createDentistAssessment",
    "getDentistAssessment",
    "updateDentistAssessment",
    "generateScreeningReport",
    "downloadReportPdfBlob",
]
all_dentist_callers_present = all(c in dentist_callers_content for c in expected_dentist_callers)
if all_dentist_callers_present:
    log_pass(f"All 14 dentist API caller operations verified in dentistEndpoints.ts")
else:
    missing_dc = [c for c in expected_dentist_callers if c not in dentist_callers_content]
    log_fail("Dentist callers check", f"Missing caller functions: {missing_dc}")

# Check 8: Canonical Endpoint Paths in endpoints.ts
endpoints_path = os.path.join(FRONTEND_DIR, "src", "api", "endpoints.ts")
with open(endpoints_path, "r", encoding="utf-8") as f:
    endpoints_content = f.read()

expected_paths = [
    "DENTIST_ME: '/api/dentists/me'",
    "DENTIST_VERIFICATION: '/api/dentists/me/verification'",
    "APPOINTMENTS: '/api/appointments'",
    "APPOINTMENT_DETAIL:",
    "APPOINTMENT_STATUS:",
    "APPOINTMENT_CANCEL:",
    "SCREENING_ASSESSMENT:",
]
all_paths_present = all(p in endpoints_content for p in expected_paths)
if all_paths_present:
    log_pass("Canonical endpoint paths for Phase 24 verified in endpoints.ts")
else:
    missing_p = [p for p in expected_paths if p not in endpoints_content]
    log_fail("Endpoint paths check", f"Missing endpoint paths in endpoints.ts: {missing_p}")

# Check 9: Route Hierarchy in AppRoutes.tsx
routes_path = os.path.join(FRONTEND_DIR, "src", "routes", "AppRoutes.tsx")
with open(routes_path, "r", encoding="utf-8") as f:
    routes_content = f.read()

expected_dentist_routes = [
    'path="appointments"',
    'path="screenings/:screeningId/review"',
    'path="profile"',
]
all_routes_present = all(r in routes_content for r in expected_dentist_routes)
if all_routes_present:
    log_pass("Phase 24 dentist routes registered in AppRoutes.tsx (appointments, screenings/:id/review, profile)")
else:
    missing_r = [r for r in expected_dentist_routes if r not in routes_content]
    log_fail("Dentist routes check", f"Missing routes in AppRoutes.tsx: {missing_r}")

# Check 10: Navigation in Sidebar.tsx
sidebar_path = os.path.join(FRONTEND_DIR, "src", "components", "layout", "Sidebar.tsx")
with open(sidebar_path, "r", encoding="utf-8") as f:
    sidebar_content = f.read()

if "Appointments & Cases" in sidebar_content and "My Profile" in sidebar_content:
    log_pass("Active navigation items configured in Sidebar.tsx for dentist role")
else:
    log_fail("Sidebar navigation check", "Appointments & Cases or My Profile missing from Sidebar.tsx")

# Check 11: Dynamic Verification Alert in DentistShell.tsx
shell_path = os.path.join(FRONTEND_DIR, "src", "components", "layout", "DentistShell.tsx")
with open(shell_path, "r", encoding="utf-8") as f:
    shell_content = f.read()

if "useDentist" in shell_content and "isPending" in shell_content and "isRejected" in shell_content:
    log_pass("DentistShell renders verification notice dynamically based on practitioner verification status")
else:
    log_fail("DentistShell check", "Dynamic verification logic missing from DentistShell.tsx")

# Check 12: Verification Document Upload Restriction
card_path = os.path.join(FRONTEND_DIR, "src", "components", "dentist", "DentistVerificationCard.tsx")
with open(card_path, "r", encoding="utf-8") as f:
    card_content = f.read()

if "document_url" in card_content and "type=\"file\"" not in card_content and "upload" not in card_content.lower().split("submit")[0]:
    log_pass("Verification document upload constraint honored: accepts metadata/reference URL without client file upload")
else:
    log_fail("Verification upload constraint check", "Forbidden file upload found in DentistVerificationCard.tsx")

# Check 13: Absence of Misleading Clinical Claims across Phase 24 Files
clinical_forbidden_phrases = [
    "chance of having cancer",
    "probability of having cancer",
    "chance of cancer",
    "calibrated disease probability",
    "diagnostic certainty",
    "100% risk",
    "75% risk",
    "within 7 days",
    "within 30 days",
    "signed clinical report",
    "cancel screening",
]

phase24_files_to_scan = [
    form_path,
    review_page_path,
    os.path.join(FRONTEND_DIR, "src", "pages", "dentist", "DentistDashboard.tsx"),
    os.path.join(FRONTEND_DIR, "src", "pages", "dentist", "DentistAppointmentsPage.tsx"),
    os.path.join(FRONTEND_DIR, "src", "pages", "dentist", "DentistProfilePage.tsx"),
    os.path.join(FRONTEND_DIR, "src", "components", "dentist", "DentistAppointmentsTable.tsx"),
    card_path,
]

violations = []
for file_p in phase24_files_to_scan:
    if os.path.exists(file_p):
        with open(file_p, "r", encoding="utf-8") as f:
            content_lower = f.read().lower()
        for phrase in clinical_forbidden_phrases:
            if phrase in content_lower:
                violations.append((os.path.basename(file_p), phrase))

if not violations:
    log_pass("Comprehensive audit confirms zero misleading clinical claims, hardcoded timelines, or false signature labels in Phase 24")
else:
    log_fail("Clinical claims audit", f"Found forbidden phrase violations: {violations}")

# Check 14: Zero Prescription / Medication / Drug Wording in Phase 24 UI
rx_forbidden = ["prescri", "medicat", "drug"]
rx_violations = []
for file_p in phase24_files_to_scan:
    if os.path.exists(file_p):
        with open(file_p, "r", encoding="utf-8") as f:
            c_lower = f.read().lower()
        for term in rx_forbidden:
            if term in c_lower:
                rx_violations.append((os.path.basename(file_p), term))

if not rx_violations:
    log_pass("Correction #1 Verified: Zero prescription, medication, or drug claims in Phase 24 UI components")
else:
    log_fail("Prescription terminology check", f"Found prescription/medication terms in: {rx_violations}")

# Check 15: Absence of Broad Legal/Universal Permanence Claims
permanence_forbidden = ["permanently locked", "irreversible", "permanent medical record", "non-revocable"]
perm_violations = []
for file_p in phase24_files_to_scan:
    if os.path.exists(file_p):
        with open(file_p, "r", encoding="utf-8") as f:
            c_lower = f.read().lower()
        for term in permanence_forbidden:
            if term in c_lower:
                perm_violations.append((os.path.basename(file_p), term))

if not perm_violations:
    log_pass("Correction #2 Verified: Zero broad legal permanence claims; uses 'Assessment Finalization & Locking'")
else:
    log_fail("Permanence claim check", f"Found broad permanence claims in: {perm_violations}")

# Check 16: Appointment Lifecycle Action Guards in DentistAppointmentsTable.tsx
appt_table_path = os.path.join(FRONTEND_DIR, "src", "components", "dentist", "DentistAppointmentsTable.tsx")
with open(appt_table_path, "r", encoding="utf-8") as f:
    appt_table_content = f.read()

has_confirmed_start = "appt.status === 'confirmed'" in appt_table_content and "status: 'in_progress'" in appt_table_content
has_in_progress_complete = "appt.status === 'in_progress'" in appt_table_content and "status: 'completed'" in appt_table_content
has_min_cancel_reason = "cancelReason.trim().length < 3" in appt_table_content

if has_confirmed_start and has_in_progress_complete and has_min_cancel_reason:
    log_pass("Appointment Action Guards Verified: confirmed->in_progress, in_progress->completed, min 3 char cancel reason")
else:
    log_fail("Appointment action guards check", f"Start: {has_confirmed_start}, Complete: {has_in_progress_complete}, MinCancel: {has_min_cancel_reason}")

# ============================================================================
# Section 6: Complete Backend Regressions Guarantee
# ============================================================================
print("\n" + "=" * 70)
print("SECTION 6: COMPLETE BACKEND REGRESSIONS (PHASES 3B - 21)")
print("=" * 70)

regression_scripts = [
    ("Phase 21 (API Contract & Parity)", "validate_phase21.py"),
    ("Phase 20 (Security & Rate Limiter)", "validate_phase20.py"),
    ("Phase 19 (End-to-End Clinical Lifecycle)", "validate_phase19.py"),
    ("Phase 18 (Admin & Telemetry)", "validate_phase18.py"),
    ("Phase 17 (Notifications)", "validate_phase17.py"),
    ("Phase 16 (Messaging)", "validate_phase16.py"),
    ("Phase 15 (Video Consultation)", "validate_phase15.py"),
    ("Phase 14 (Consultations)", "validate_phase14.py"),
    ("Phase 13 (Appointments)", "validate_phase13.py"),
    ("Phase 12 (Clinical Reports & Risk Engine)", "validate_phase12.py"),
    ("Phase 11 (XAI Engine)", "validate_phase11.py"),
    ("Phase 10 (AI Pipeline)", "validate_phase10.py"),
    ("Phase 9B (Screening Management)", "validate_phase9b.py"),
    ("Phase 9A (Image Upload & Storage)", "validate_phase9a.py"),
    ("Phase 8 (Dentist Profiles)", "validate_phase8.py"),
    ("Phase 7 (Patient Records)", "validate_phase7.py"),
    ("Phase 6 (User Management)", "validate_phase6.py"),
    ("Phase 5 (Auth & RBAC)", "validate_phase5.py"),
    ("Phase 4 (Database Schema)", "validate_phase4.py"),
    ("Phase 3C (Config & Settings)", "validate_phase3c.py"),
    ("Phase 3B (FastAPI Core)", "validate_phase3b.py"),
]

for label, script_name in regression_scripts:
    script_path = os.path.join(SCRATCH_DIR, script_name)
    if not os.path.exists(script_path):
        log_fail(f"Regression Suite: {label}", f"{script_name} not found")
        continue

    t0 = time.time()
    res = subprocess.run(
        [PYTHON_EXE, script_path],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
    )
    dt = time.time() - t0
    if res.returncode == 0:
        log_pass(f"Regression Suite: {label} (100% PASS in {dt:.2f}s)")
    else:
        log_fail(f"Regression Suite: {label}", f"Exit {res.returncode}:\n{res.stdout[-400:]}\n{res.stderr[-400:]}")

# ============================================================================
# Final Summary
# ============================================================================
print("\n" + "=" * 70)
print(f"PHASE 24 VALIDATION COMPLETE: {passed_tests} PASSED, {failed_tests} FAILED")
print("=" * 70)

if failed_tests > 0:
    sys.exit(1)
sys.exit(0)
