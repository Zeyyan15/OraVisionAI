"""
OraVisionAI — Verification of Configured Storage Failure Behavior (Correction #4)
Ensures that when Supabase IS configured, upload/download failures produce explicit RuntimeError
and DO NOT silently fall back to reference-path-only or synthetic fallbacks.
"""

import sys
import uuid
import asyncio
from pathlib import Path
from unittest.mock import patch

backend_path = Path(r"c:\Users\hp\Desktop\OravisionAI\backend")
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.services.storage_service import StorageService

_TEST_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\n\x00\x00\x00\n\x08\x02"
    b"\x00\x00\x00\x02PX\xea\x00\x00\x00\x16IDATx\x9cc\xfc\xff\xff?\x03n\xc0\x84G"
    b"\x8ea\xe4J\x03\x00\xa5\xe3\x03\x11\xc7z\x1cU\x00\x00\x00\x00IEND\xaeB`\x82"
)

async def test_configured_failure_raises():
    pid = uuid.uuid4()
    sid = uuid.uuid4()

    # Mock configured Supabase credentials pointing to an invalid/failing endpoint
    with patch("app.services.storage_service._get_supabase_config", return_value=("http://127.0.0.1:9999", "fake-key", "oravisionai")):
        # 1. Test Upload Failure when configured
        upload_raised = False
        try:
            await StorageService.upload_screening_image(
                file_bytes=_TEST_PNG,
                patient_id=pid,
                screening_id=sid,
                original_filename="oral.png",
                content_type="image/png",
            )
        except RuntimeError as e:
            upload_raised = True
            print("[PASS] Configured upload failure raised RuntimeError:", str(e)[:80])

        assert upload_raised, "Configured upload failure MUST raise RuntimeError, not fall back silently!"

        # 2. Test Download Failure when configured
        download_raised = False
        try:
            StorageService.download_screening_image("screenings/fake/path.png")
        except RuntimeError as e:
            download_raised = True
            print("[PASS] Configured download failure raised RuntimeError:", str(e)[:80])

        assert download_raised, "Configured download failure MUST raise RuntimeError, not fall back silently!"

    print("ALL CONFIGURED FAILURE BEHAVIOR ASSERTIONS PASSED (100%)")

if __name__ == "__main__":
    asyncio.run(test_configured_failure_raises())
