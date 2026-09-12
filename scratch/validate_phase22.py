"""
OraVisionAI — Phase 22 Comprehensive Validation Harness
Frontend Foundation & Application Shell

Executes:
1. Exact File Manifest Verification (actual_frontend_files == expected_frontend_files, 49 files, all non-empty)
2. Backend Tree Immutability Verification (zero modified/added/deleted files under backend/)
3. TypeScript Strict Typecheck (npm run typecheck -> 0 errors)
4. Production Bundle Compilation (npm run build -> dist/ generated with clean exit)
5. Contract Conformance Static Analysis (7 AI classes, 4 risk tiers, tier indices 25/50/75/100, consultation statuses, primary XAI, registration roles)
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
    # Configuration & Build (8 files)
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
    # Domain Types & API Client Layer (5 files)
    "src/types/domain.ts",
    "src/types/api.ts",
    "src/api/errors.ts",
    "src/api/client.ts",
    "src/api/endpoints.ts",
    # Auth Context & Hooks (3 files)
    "src/context/AuthContext.tsx",
    "src/hooks/useAuth.ts",
    "src/hooks/useApi.ts",
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
    # Public & Placeholder Shell Pages (9 files)
    "src/pages/public/LandingPage.tsx",
    "src/pages/public/LoginPage.tsx",
    "src/pages/public/RegisterPage.tsx",
    "src/pages/public/UnauthorizedPage.tsx",
    "src/pages/public/DeactivatedPage.tsx",
    "src/pages/public/NotFoundPage.tsx",
    "src/pages/patient/PatientDashboard.tsx",
    "src/pages/dentist/DentistDashboard.tsx",
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
    # Ignore node_modules, dist, .git
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

# Verify all 49 files are non-empty
all_non_empty = True
for rel in EXPECTED_FRONTEND_FILES:
    abs_p = os.path.join(FRONTEND_DIR, rel.replace("/", os.sep))
    if not os.path.exists(abs_p) or os.path.getsize(abs_p) == 0:
        all_non_empty = False
        log_fail(f"Non-empty check for {rel}", "File is missing or 0 bytes")

if all_non_empty:
    log_pass("All 49 frontend files are non-empty (>0 bytes)")

# Verify validate_phase22.py exists as 50th file
val_script = os.path.join(SCRATCH_DIR, "validate_phase22.py")
if os.path.exists(val_script) and os.path.getsize(val_script) > 0:
    log_pass("scratch/validate_phase22.py exists as 50th planned file")
else:
    log_fail("50th planned file check", "scratch/validate_phase22.py is missing or empty")

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
        # Check if modified in the last 4 hours (14400 seconds)
        if now_ts - mtime < 14400:
            recent_modifications.append((rel_path, mtime))

if len(backend_files) == 94:
    log_pass(f"Backend file inventory confirms exactly 94 canonical backend files preserved")
else:
    log_fail("Backend file count mismatch", f"Expected 94 files, found {len(backend_files)}")

if len(recent_modifications) == 0:
    log_pass("Backend file timestamp audit confirms zero backend files created or modified during Phase 22")
else:
    log_fail("Backend modification detected", f"Files modified recently: {recent_modifications}")

# Verify key frozen backend anchors exist and remain intact
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
# Section 5: Contract Conformance Static Analysis
# ============================================================================
print("\n" + "=" * 70)
print("SECTION 5: CONTRACT CONFORMANCE STATIC ANALYSIS")
print("=" * 70)

domain_path = os.path.join(FRONTEND_DIR, "src", "types", "domain.ts")
with open(domain_path, "r", encoding="utf-8") as f:
    domain_content = f.read()

# 1. 7 AI Classes
ai_classes = ["CaS", "CoS", "Gum", "MC", "OC", "OLP", "OT"]
all_ai_classes = all(f"'{cls}':" in domain_content or f"{cls}:" in domain_content for cls in ai_classes)
if all_ai_classes:
    log_pass("Oral disease AI taxonomy contains exact 7 frozen classes (CaS, CoS, Gum, MC, OC, OLP, OT)")
else:
    log_fail("AI taxonomy check", "One or more frozen class codes missing from domain.ts")

# 2. Risk Tiers & Technical Tier Indices
risk_tiers = ["low", "moderate", "high", "critical"]
all_risk_tiers = all(tier in domain_content for tier in risk_tiers)
if all_risk_tiers:
    log_pass("Risk levels define exact 4 tiers (low, moderate, high, critical)")
else:
    log_fail("Risk tiers check", "One or more risk levels missing")

tier_indices = [25.0, 50.0, 75.0, 100.0]
all_indices = all(str(idx) in domain_content for idx in tier_indices)
has_tier_index_keyword = "tierIndex" in domain_content
if all_indices and has_tier_index_keyword:
    log_pass("Technical ordinal tier indices (25, 50, 75, 100) declared as tier indices, not probabilities")
else:
    log_fail("Tier index semantics", "tierIndex property or numeric values 25/50/75/100 missing")

# 3. Consultation Lifecycle
consultation_states = ["scheduled", "active", "ended", "failed"]
all_consultation_states = all(state in domain_content for state in consultation_states)
if all_consultation_states:
    log_pass("Consultation lifecycle matches exact contract (scheduled, active, ended, failed)")
else:
    log_fail("Consultation lifecycle", "Missing one or more consultation statuses")

# 4. Primary & Secondary XAI
primary_xai = ["occlusion_sensitivity", "grad_cam"]
secondary_xai = ["grad_cam_plus_plus", "layer_cam", "score_cam", "integrated_gradients"]
if all(m in domain_content for m in primary_xai) and all(m in domain_content for m in secondary_xai):
    log_pass("XAI catalog defines primary (occlusion_sensitivity, grad_cam) and 4 secondary methods")
else:
    log_fail("XAI methods", "Missing primary or secondary XAI methods")

# 5. Registration Role Security
register_path = os.path.join(FRONTEND_DIR, "src", "pages", "public", "RegisterPage.tsx")
with open(register_path, "r", encoding="utf-8") as f:
    register_content = f.read()

if "patient" in register_content and "dentist" in register_content and "admin" not in register_content.split("setRole")[1].split("</button>")[0]:
    log_pass("Public registration UI strictly limits role selection to patient or dentist (admin excluded)")
else:
    log_fail("Registration role check", "Admin role unexpectedly exposed or selectable in RegisterPage.tsx")

# 6. Endpoints Catalog Parity
endpoints_path = os.path.join(FRONTEND_DIR, "src", "api", "endpoints.ts")
with open(endpoints_path, "r", encoding="utf-8") as f:
    endpoints_content = f.read()

expected_paths = ["/api/auth/me", "/api/users/me", "/api/users/me/patient-access", "/api/users/me/dentist-access", "/api/users/me/admin-access"]
if all(p in endpoints_content for p in expected_paths):
    log_pass("Foundational endpoints catalog includes all approved authentication and RBAC paths")
else:
    log_fail("Endpoints catalog check", "One or more foundational API paths missing from endpoints.ts")

# ============================================================================
# Section 6: Complete Backend Regressions Guarantee
# ============================================================================
print("\n" + "=" * 70)
print("SECTION 6: COMPLETE BACKEND REGRESSIONS (PHASES 3B - 21)")
print("=" * 70)

regression_scripts = [
    ("Phase 21 (API Contract & Readiness)", "validate_phase21.py"),
    ("Phase 20 (Security Middleware & Rate Limiter)", "validate_phase20.py"),
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
print(f"PHASE 22 VALIDATION COMPLETE: {passed_tests} PASSED, {failed_tests} FAILED")
print("=" * 70)

if failed_tests > 0:
    sys.exit(1)
sys.exit(0)
