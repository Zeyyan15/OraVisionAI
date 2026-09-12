"""
OraVisionAI — Firebase Admin SDK Integration

Initializes Firebase Admin SDK using service account credentials from settings.
Provides server-side token verification and Firebase Storage bucket access.
Never logs credentials, private keys, or raw tokens.
"""

import logging
from typing import Any, Dict, Optional

import firebase_admin
from firebase_admin import auth, credentials, storage

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_firebase_app: Optional[firebase_admin.App] = None


def initialize_firebase() -> Optional[firebase_admin.App]:
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app

    settings = get_settings()

    project_id = settings.firebase_project_id.strip() if settings.firebase_project_id else ""
    client_email = settings.firebase_client_email.strip() if settings.firebase_client_email else ""
    private_key = settings.firebase_private_key.strip() if settings.firebase_private_key else ""
    storage_bucket = settings.firebase_storage_bucket.strip() if settings.firebase_storage_bucket else ""

    if not project_id or not client_email or not private_key:
        logger.warning(
            "Firebase credentials are not fully configured. "
            "Firebase authentication and storage will be disabled until valid credentials are provided."
        )
        return None

    try:
        formatted_private_key = private_key.replace("\\n", "\n")
        cert_dict = {
            "type": "service_account",
            "project_id": project_id,
            "private_key": formatted_private_key,
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        }

        cred = credentials.Certificate(cert_dict)
        app_options = {"projectId": project_id}
        if storage_bucket:
            app_options["storageBucket"] = storage_bucket

        _firebase_app = firebase_admin.initialize_app(
            cred,
            app_options,
        )
        logger.info("Firebase Admin SDK initialized successfully for project: %s", project_id)
        return _firebase_app
    except Exception as exc:
        logger.error("Failed to initialize Firebase Admin SDK: %s", exc)
        return None


def get_firebase_app() -> Optional[firebase_admin.App]:
    return initialize_firebase()


def get_firebase_storage_bucket():
    app = get_firebase_app()
    if app is None:
        return None
    try:
        return storage.bucket(app=app)
    except Exception as exc:
        logger.error("Failed to acquire Firebase Storage bucket: %s", exc)
        return None


def verify_firebase_id_token(token: str) -> Dict[str, Any]:
    app = get_firebase_app()
    if app is None:
        raise RuntimeError("Firebase Admin SDK is not configured on this server.")

    decoded_token = auth.verify_id_token(token, app=app, check_revoked=False)
    return decoded_token
