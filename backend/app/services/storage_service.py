"""
OraVisionAI — Supabase Storage Service (Phase 31)

Manages cloud storage for patient dental screenings, XAI visual explanations, and clinical PDF reports
via the Supabase Storage REST API using httpx.

Generates safe collision-resistant paths, performs magic byte validation, downloads screening images,
uploads XAI heatmap artifacts and generated PDF reports, and handles transaction rollbacks.

Storage Provider: Supabase Storage (private bucket, service-role key, backend-only).
Firebase Storage has been removed. Firebase Authentication remains unchanged.
"""

from __future__ import annotations

import hashlib
import logging
import os
import struct
import uuid
from typing import Any, Dict, Optional, Tuple

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Valid 10x10 RGB white PNG bytes for unconfigured fallback environments
_SYNTHETIC_PNG_FALLBACK = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\n\x00\x00\x00\n\x08\x02"
    b"\x00\x00\x00\x02PX\xea\x00\x00\x00\x16IDATx\x9cc\xfc\xff\xff?\x03n\xc0\x84G"
    b"\x8ea\xe4J\x03\x00\xa5\xe3\x03\x11\xc7z\x1cU\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _get_supabase_config() -> Tuple[str, str, str]:
    """
    Returns (supabase_url, service_role_key, bucket_name).
    Raises RuntimeError if Supabase is not configured.
    """
    settings = get_settings()
    url = (settings.supabase_url or "").strip()
    key = (settings.supabase_service_role_key or "").strip()
    bucket = (settings.supabase_storage_bucket or "oravisionai").strip()
    return url, key, bucket


def _is_supabase_configured() -> bool:
    """Check if Supabase Storage credentials are present."""
    url, key, _ = _get_supabase_config()
    return bool(url) and bool(key)


def _supabase_headers(key: str) -> Dict[str, str]:
    """Build authorization headers for Supabase Storage REST API."""
    return {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }


def parse_image_dimensions(file_bytes: bytes, mime_type: str) -> Tuple[Optional[int], Optional[int]]:
    try:
        # PNG
        if file_bytes.startswith(b"\x89PNG\r\n\x1a\n") and len(file_bytes) >= 24:
            w, h = struct.unpack(">II", file_bytes[16:24])
            return int(w), int(h)

        # JPEG
        if file_bytes.startswith(b"\xff\xd8"):
            idx = 2
            length = len(file_bytes)
            while idx < length - 9:
                if file_bytes[idx] != 0xFF:
                    idx += 1
                    continue
                marker = file_bytes[idx + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", file_bytes[idx + 5 : idx + 9])
                    return int(w), int(h)
                else:
                    idx += 2
                    if idx + 2 > length:
                        break
                    block_len = struct.unpack(">H", file_bytes[idx : idx + 2])[0]
                    idx += block_len

        # WEBP
        if file_bytes.startswith(b"RIFF") and len(file_bytes) >= 30 and file_bytes[8:12] == b"WEBP":
            chunk_type = file_bytes[12:16]
            if chunk_type == b"VP8 ":
                if len(file_bytes) >= 30 and file_bytes[23:26] == b"\x9d\x01\x2a":
                    w, h = struct.unpack("<HH", file_bytes[26:30])
                    return int(w & 0x3FFF), int(h & 0x3FFF)
            elif chunk_type == b"VP8L":
                if len(file_bytes) >= 25 and file_bytes[20] == 0x2F:
                    b0, b1, b2, b3 = file_bytes[21:25]
                    w = 1 + (((b1 & 0x3F) << 8) | b0)
                    h = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6))
                    return int(w), int(h)
            elif chunk_type == b"VP8X":
                if len(file_bytes) >= 30:
                    w = 1 + struct.unpack("<I", file_bytes[24:27] + b"\x00")[0]
                    h = 1 + struct.unpack("<I", file_bytes[27:30] + b"\x00")[0]
                    return int(w), int(h)
    except Exception as exc:
        logger.debug("Could not parse dimensions from image bytes: %s", exc)

    return None, None


class StorageService:
    @staticmethod
    def validate_image_file(
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> Tuple[str, str]:
        settings = get_settings()

        if len(file_bytes) == 0:
            raise ValueError("Uploaded file is empty (0 bytes).")

        if len(file_bytes) > settings.max_upload_size_bytes:
            max_mb = settings.max_upload_size_bytes / (1024 * 1024)
            raise ValueError(f"File size exceeds maximum allowed limit of {max_mb:.1f} MB.")

        _, ext = os.path.splitext(filename or "")
        ext = ext.lower()
        if not ext or ext not in settings.allowed_image_extensions:
            raise ValueError(
                f"Unsupported file extension '{ext}'. Allowed extensions: {settings.allowed_image_extensions}"
            )

        mime = content_type.lower().strip()
        if mime not in settings.allowed_image_mime_types:
            raise ValueError(
                f"Unsupported content type '{content_type}'. Allowed MIME types: {settings.allowed_image_mime_types}"
            )

        is_jpeg = file_bytes.startswith(b"\xff\xd8")
        is_png = file_bytes.startswith(b"\x89PNG\r\n\x1a\n")
        is_webp = file_bytes.startswith(b"RIFF") and len(file_bytes) >= 12 and file_bytes[8:12] == b"WEBP"

        if mime == "image/jpeg" and not is_jpeg:
            raise ValueError("File content does not match JPEG header signature.")
        elif mime == "image/png" and not is_png:
            raise ValueError("File content does not match PNG header signature.")
        elif mime == "image/webp" and not is_webp:
            raise ValueError("File content does not match WEBP header signature.")
        elif not (is_jpeg or is_png or is_webp):
            raise ValueError("Uploaded file signature does not match any allowed image format.")

        return ext, mime

    @staticmethod
    async def upload_screening_image(
        file_bytes: bytes,
        patient_id: uuid.UUID,
        screening_id: uuid.UUID,
        original_filename: str,
        content_type: str,
    ) -> Dict[str, Any]:
        ext, validated_mime = StorageService.validate_image_file(
            file_bytes=file_bytes,
            filename=original_filename,
            content_type=content_type,
        )

        safe_filename = f"{uuid.uuid4().hex}{ext}"
        storage_path = f"screenings/{patient_id}/{screening_id}/{safe_filename}"
        image_sha256 = hashlib.sha256(file_bytes).hexdigest()
        width, height = parse_image_dimensions(file_bytes, validated_mime)

        if _is_supabase_configured():
            StorageService._upload_to_supabase(storage_path, file_bytes, validated_mime)
        else:
            logger.warning(
                "Supabase Storage is unconfigured; saving storage reference path only: %s",
                storage_path,
            )

        return {
            "storage_path": storage_path,
            "file_name": safe_filename,
            "file_size_bytes": len(file_bytes),
            "mime_type": validated_mime,
            "image_width": width,
            "image_height": height,
            "image_sha256": image_sha256,
        }

    @staticmethod
    def upload_xai_artifact(
        png_bytes: bytes,
        patient_id: uuid.UUID,
        screening_id: uuid.UUID,
        prediction_id: uuid.UUID,
        method: str,
        artifact_type: str = "heatmap",
    ) -> str:
        """
        Uploads a generated XAI heatmap or overlay image to Supabase Storage.
        Returns the safe relative storage path.
        """
        safe_hash = uuid.uuid4().hex[:8]
        storage_path = f"xai/{patient_id}/{screening_id}/{prediction_id}/{method}/{artifact_type}_{safe_hash}.png"

        if _is_supabase_configured():
            StorageService._upload_to_supabase(storage_path, png_bytes, "image/png")
        else:
            logger.warning(
                "Supabase Storage is unconfigured; saving XAI storage reference path: %s",
                storage_path,
            )

        return storage_path

    @staticmethod
    def upload_report_pdf(
        pdf_bytes: bytes,
        patient_id: uuid.UUID,
        screening_id: uuid.UUID,
        report_number: str,
    ) -> str:
        """
        Uploads a generated clinical report PDF to Supabase Storage.
        Returns the safe relative storage path.
        """
        safe_report_num = report_number.replace("/", "_").replace(" ", "_")
        storage_path = f"reports/{patient_id}/{screening_id}/{safe_report_num}.pdf"

        if _is_supabase_configured():
            StorageService._upload_to_supabase(storage_path, pdf_bytes, "application/pdf")
        else:
            logger.warning(
                "Supabase Storage is unconfigured; saving Report PDF reference path: %s",
                storage_path,
            )

        return storage_path

    @staticmethod
    def download_screening_image(storage_path: str) -> bytes:
        """Download raw image bytes from Supabase Storage."""
        if _is_supabase_configured():
            return StorageService._download_from_supabase(storage_path)

        # Local development fallback check if file exists locally
        if os.path.exists(storage_path):
            with open(storage_path, "rb") as f:
                return f.read()

        logger.warning(
            "Supabase Storage is unconfigured and local file '%s' was not found. "
            "Returning synthetic image bytes for development/testing.",
            storage_path,
        )
        return _SYNTHETIC_PNG_FALLBACK

    @staticmethod
    def download_report_pdf(storage_path: str) -> bytes:
        """Download clinical report PDF bytes from Supabase Storage."""
        if _is_supabase_configured():
            return StorageService._download_from_supabase(storage_path)

        if os.path.exists(storage_path):
            with open(storage_path, "rb") as f:
                return f.read()

        raise FileNotFoundError(f"Report PDF not found at storage path: {storage_path}")

    @staticmethod
    def delete_storage_object(storage_path: str) -> bool:
        """Delete an object from Supabase Storage (transaction rollback support)."""
        if not _is_supabase_configured():
            return False

        url, key, bucket = _get_supabase_config()
        delete_url = f"{url}/storage/v1/object/{bucket}/{storage_path}"

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.delete(
                    delete_url,
                    headers=_supabase_headers(key),
                )
                if resp.status_code in (200, 204):
                    logger.info("Deleted orphaned storage object: %s", storage_path)
                    return True
                elif resp.status_code == 404:
                    logger.debug("Storage object not found for deletion: %s", storage_path)
                    return False
                else:
                    logger.warning(
                        "Supabase Storage delete returned %d for path %s: %s",
                        resp.status_code, storage_path, resp.text[:200],
                    )
                    return False
        except Exception as exc:
            logger.warning("Failed to delete storage object %s: %s", storage_path, exc)
            return False

    @staticmethod
    def create_signed_url(storage_path: str, expires_in: int = 900) -> Optional[str]:
        """
        Generate a short-lived signed URL for secure artifact access.
        Returns the full signed URL or None if Supabase is unconfigured.
        expires_in: seconds until the signed URL expires (default: 900 = 15 minutes).
        """
        if not _is_supabase_configured():
            return None

        url, key, bucket = _get_supabase_config()
        sign_url = f"{url}/storage/v1/object/sign/{bucket}/{storage_path}"

        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(
                    sign_url,
                    headers={
                        **_supabase_headers(key),
                        "Content-Type": "application/json",
                    },
                    json={"expiresIn": expires_in},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    signed_path = data.get("signedURL", "")
                    if signed_path:
                        # Supabase Kong Gateway requires /storage/v1 route prefix
                        if not signed_path.startswith("/storage/v1"):
                            signed_path = f"/storage/v1{signed_path if signed_path.startswith('/') else '/' + signed_path}"
                        if signed_path.startswith("/"):
                            return f"{url}{signed_path}"
                        return signed_path
                    logger.error("Supabase signed URL response missing signedURL field")
                    return None
                else:
                    logger.error(
                        "Supabase signed URL creation failed (%d) for path %s: %s",
                        resp.status_code, storage_path, resp.text[:200],
                    )
                    return None
        except Exception as exc:
            logger.error("Failed to create signed URL for %s: %s", storage_path, exc)
            return None

    # =========================================================================
    # Internal Supabase REST API Helpers
    # =========================================================================

    @staticmethod
    def _upload_to_supabase(storage_path: str, file_bytes: bytes, content_type: str) -> None:
        """Upload binary content to Supabase Storage. Raises RuntimeError on failure."""
        url, key, bucket = _get_supabase_config()
        upload_url = f"{url}/storage/v1/object/{bucket}/{storage_path}"

        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    upload_url,
                    headers={
                        **_supabase_headers(key),
                        "Content-Type": content_type,
                        "x-upsert": "true",
                    },
                    content=file_bytes,
                )
                if resp.status_code in (200, 201):
                    logger.info("Successfully uploaded to Supabase Storage: %s", storage_path)
                else:
                    error_detail = resp.text[:300] if resp.text else "No response body"
                    logger.error(
                        "Supabase Storage upload failed (%d) for path %s: %s",
                        resp.status_code, storage_path, error_detail,
                    )
                    raise RuntimeError(
                        f"Storage upload failed (HTTP {resp.status_code}): {error_detail}"
                    )
        except httpx.HTTPError as exc:
            logger.error("Supabase Storage upload network error for path %s: %s", storage_path, exc)
            raise RuntimeError(f"Storage upload failed: {exc}")

    @staticmethod
    def _download_from_supabase(storage_path: str) -> bytes:
        """Download binary content from Supabase Storage. Raises RuntimeError on failure."""
        url, key, bucket = _get_supabase_config()
        download_url = f"{url}/storage/v1/object/authenticated/{bucket}/{storage_path}"

        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.get(
                    download_url,
                    headers=_supabase_headers(key),
                )
                if resp.status_code == 200:
                    logger.info(
                        "Successfully downloaded %d bytes from Supabase Storage: %s",
                        len(resp.content), storage_path,
                    )
                    return resp.content
                elif resp.status_code == 404:
                    raise FileNotFoundError(f"Storage object not found at path: {storage_path}")
                else:
                    error_detail = resp.text[:300] if resp.text else "No response body"
                    logger.error(
                        "Supabase Storage download failed (%d) for path %s: %s",
                        resp.status_code, storage_path, error_detail,
                    )
                    raise RuntimeError(
                        f"Storage download failed (HTTP {resp.status_code}): {error_detail}"
                    )
        except httpx.HTTPError as exc:
            logger.error("Supabase Storage download network error for path %s: %s", storage_path, exc)
            raise RuntimeError(f"Storage download failed: {exc}")
