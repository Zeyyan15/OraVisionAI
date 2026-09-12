"""Phase 2 — Comprehensive validation script."""
import json
import os
import sys
import urllib.request
import urllib.error

# Add the backend directory to Python path
BACKEND_DIR = r"c:\Users\hp\Desktop\OravisionAI\backend"
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)


def fetch(url, headers=None, method="GET"):
    req = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, dict(resp.headers), resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


print("=" * 60)
print("PHASE 2 VALIDATION")
print("=" * 60)

# --- A. Endpoint tests -------------------------------------------------------
print("\n--- A. Endpoint Tests ---")

status, _, body = fetch("http://127.0.0.1:8000/")
data = json.loads(body)
assert status == 200, f"GET / failed: {status}"
assert data["application"] == "OraVisionAI"
assert data["status"] == "online"
print(f"  GET /       -> {status} OK  {json.dumps(data)}")

status, _, body = fetch("http://127.0.0.1:8000/health")
data = json.loads(body)
assert status == 200, f"GET /health failed: {status}"
assert data["status"] == "healthy"
print(f"  GET /health -> {status} OK  {json.dumps(data)}")

# --- B. CORS ------------------------------------------------------------------
print("\n--- B. CORS Middleware ---")

status, hdrs, _ = fetch(
    "http://127.0.0.1:8000/",
    headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    },
    method="OPTIONS",
)
acao = hdrs.get("access-control-allow-origin", "MISSING")
print(f"  Preflight (allowed origin) -> {status}, ACAO: {acao}")
assert acao == "http://localhost:5173", f"CORS preflight failed: {acao}"

status, hdrs, _ = fetch(
    "http://127.0.0.1:8000/",
    headers={"Origin": "http://evil.com"},
)
acao = hdrs.get("access-control-allow-origin", "MISSING")
print(f"  GET with bad origin         -> ACAO: {acao}")
assert acao == "MISSING", f"CORS should reject evil origin: {acao}"

# --- C. Settings loading ------------------------------------------------------
print("\n--- C. Settings Loading ---")
from app.core.config import get_settings
s = get_settings()
print(f"  app_name:      {s.app_name}")
print(f"  environment:   {s.environment}")
print(f"  database_url:  {'[SET]' if s.database_url else '[EMPTY]'}")
print(f"  cors_origins:  {s.cors_origins}")

# --- D. SQLAlchemy infrastructure ---------------------------------------------
print("\n--- D. SQLAlchemy Infrastructure ---")

from app.db.base import Base
print(f"  Base class:        {Base.__name__}")
print(f"  Base metadata:     {Base.metadata}")
print(f"  Registered tables: {list(Base.metadata.tables.keys())}")
assert len(Base.metadata.tables) == 0, "No domain tables should exist yet"
print("  No domain models registered (correct)")

from app.db.session import get_engine, get_db, dispose_engine, _engine
print(f"  Engine (lazy):     {'Not created yet' if _engine is None else 'Created'}")
assert _engine is None, "Engine should not be created until first use"
print("  Engine correctly deferred (lazy init)")

# --- E. Alembic configuration -------------------------------------------------
print("\n--- E. Alembic Configuration ---")
for path in ["alembic.ini", "alembic/env.py", "alembic/script.py.mako", "alembic/versions"]:
    full = os.path.join(BACKEND_DIR, path)
    exists = os.path.exists(full)
    kind = "dir" if os.path.isdir(full) else "file"
    print(f"  {path:<30s} -> {'EXISTS' if exists else 'MISSING'} ({kind})")
    assert exists, f"{path} missing"

# --- F. PostgreSQL connectivity -----------------------------------------------
print("\n--- F. Database Connectivity ---")
import subprocess
try:
    result = subprocess.run(
        "psql --version",
        capture_output=True, text=True, shell=True
    )
    if result.returncode == 0:
        print(f"  psql version: {result.stdout.strip()}")
    else:
        print("  psql: NOT on PATH")
except Exception:
    print("  psql: NOT on PATH")

# Try a TCP connection to localhost:5432
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(2)
try:
    sock.connect(("localhost", 5432))
    sock.close()
    print("  PostgreSQL port 5432: REACHABLE")
    pg_reachable = True
except (ConnectionRefusedError, socket.timeout, OSError):
    print("  PostgreSQL port 5432: NOT REACHABLE")
    pg_reachable = False

if not pg_reachable:
    print("\n  DATABASE CONNECTIVITY: NOT YET AVAILABLE")
    print("  (PostgreSQL is not running or not installed)")
else:
    print("  DATABASE CONNECTIVITY: PORT OPEN (connection possible)")

# --- G. No domain models check ------------------------------------------------
print("\n--- G. Domain Models Check ---")
print(f"  Tables in metadata: {list(Base.metadata.tables.keys())}")
assert len(Base.metadata.tables) == 0
print("  CONFIRMED: Zero domain models/tables defined")

print("\n" + "=" * 60)
print("ALL PHASE 2 VALIDATIONS PASSED")
print("=" * 60)
