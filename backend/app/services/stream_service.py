"""
OraVisionAI — Stream Teleconsultation Domain Service

Manages Stream Video/Audio integration using the official Stream server-side SDK:
- Deterministic Stream user ID generation: oravisionai-user-{user_id}
- Deterministic Stream call ID generation: oravisionai-consultation-{consultation_id}
- Authoritative server-side token generation using official Stream SDK
- Basic user profile synchronization (display name, role) strictly excluding PHI
- Complete isolation of Stream credentials (STREAM_API_SECRET never exposed)
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import Optional

from getstream import Stream
from getstream.models import UserRequest

from app.core.config import get_settings

logger = logging.getLogger("oravision.services.stream")


class StreamService:
    """Official Stream server-side teleconsultation integration service."""

    _client: Optional[Stream] = None

    @classmethod
    def get_client(cls) -> Stream:
        """Returns a singleton Stream client instance initialized with app credentials."""
        if cls._client is None:
            settings = get_settings()
            if not settings.stream_api_key or not settings.stream_api_secret:
                raise RuntimeError(
                    "Stream API credentials not configured. "
                    "Ensure STREAM_API_KEY and STREAM_API_SECRET are set in environment."
                )
            cls._client = Stream(
                api_key=settings.stream_api_key,
                api_secret=settings.stream_api_secret,
            )
        return cls._client

    @classmethod
    def get_stream_user_id(cls, user_id: uuid.UUID | str) -> str:
        """Deterministically derives the Stream user ID from an OraVisionAI user ID."""
        raw_id = str(user_id)
        if raw_id.startswith("oravisionai-user-"):
            return raw_id
        return f"oravisionai-user-{raw_id}"

    @classmethod
    def get_stream_call_id(cls, consultation_id: uuid.UUID | str) -> str:
        """Deterministically derives the Stream call ID from an OraVisionAI consultation ID."""
        raw_id = str(consultation_id)
        if raw_id.startswith("oravisionai-consultation-"):
            return raw_id
        return f"oravisionai-consultation-{raw_id}"

    @classmethod
    def get_stream_call_type(cls) -> str:
        """Returns the canonical Stream Video call type for OraVisionAI teleconsultations."""
        return "default"

    @classmethod
    def create_user_token(
        cls,
        user_id: uuid.UUID | str,
        expiration_seconds: int = 3600,
    ) -> str:
        """Generates a short-lived user authentication token using the official Stream SDK.

        Args:
            user_id: OraVisionAI user UUID or canonical Stream user ID.
            expiration_seconds: Token validity window in seconds (default: 1 hour).

        Returns:
            A cryptographically signed Stream user token.
        """
        client = cls.get_client()
        stream_user_id = cls.get_stream_user_id(user_id)

        # Authoritative token generation using official getstream Python SDK
        token = client.create_token(
            user_id=stream_user_id,
            expiration=expiration_seconds,
        )
        return token

    @classmethod
    def upsert_user(
        cls,
        user_id: uuid.UUID | str,
        name: Optional[str] = None,
        role: str = "user",
    ) -> bool:
        """Synchronizes basic user identity with Stream prior to video call participation.

        STRICT PHI SAFETY: Never sends medical history, diagnoses, risk scores,
        or screening data. Only basic display identity is synchronized.
        """
        try:
            client = cls.get_client()
            stream_user_id = cls.get_stream_user_id(user_id)
            user_req = UserRequest(
                id=stream_user_id,
                name=name,
                role=role,
            )
            client.upsert_users(user_req)
            logger.info("Stream user synchronized successfully: %s", stream_user_id)
            return True
        except Exception as exc:
            # Non-blocking: client-side connectUser will also register identity
            logger.warning("Stream user server-side sync non-fatal error: %s", exc)
            return False

