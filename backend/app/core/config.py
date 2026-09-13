"""
OraVisionAI — Centralized Application Configuration

Loads settings from environment variables / .env file using Pydantic Settings.
All secrets remain external to source code.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings loaded from environment variables."""

    # --- Application ----------------------------------------------------------

    app_name: str = "OraVisionAI"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"
    docs_enabled: bool = True
    hsts_enabled: bool = False

    # --- Database -------------------------------------------------------------

    database_url: str = ""

    # --- Firebase Authentication ----------------------------------------------

    firebase_project_id: str = ""
    firebase_client_email: str = ""
    firebase_private_key: str = ""
    firebase_storage_bucket: str = ""  # Deprecated: replaced by Supabase Storage

    # --- Supabase Storage -----------------------------------------------------

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "oravisionai"

    # --- Screening & Uploads --------------------------------------------------

    max_upload_size_bytes: int = 15 * 1024 * 1024  # 15 MB raw file limit
    max_multipart_body_size_bytes: int = 20 * 1024 * 1024  # 20 MB multipart HTTP request limit
    max_json_body_size_bytes: int = 1 * 1024 * 1024  # 1 MB JSON HTTP request limit
    allowed_image_mime_types: List[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]
    allowed_image_extensions: List[str] = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    ]

    # --- Security & Rate Limiting ---------------------------------------------

    rate_limit_enabled: bool = True

    # --- AI Models ------------------------------------------------------------

    ai_model_dir: str = "ai_models"
    classifier_model_path: str = "ai_models/best_7teeth_efficientnetb0_verified.keras"
    yolo_model_path: str = "ai_models/oravisionai_yolo.pt"
    classifier_model_name: str = "OravisionAI_7Teeth_EfficientNetB0"
    classifier_model_version: str = "v1.0"
    classifier_input_shape: str = "224x224x3"
    yolo_model_name: str = "OravisionAI_YOLO"
    yolo_model_version: str = "v1.0"

    # --- Explainable AI (XAI) -------------------------------------------------

    xai_occlusion_patch_size: int = 32
    xai_occlusion_stride: int = 16
    xai_ig_steps: int = 25
    xai_scorecam_top_channels: int = 16
    xai_default_target_layer: str = "block6a_expand_conv"
    xai_generate_secondary_by_default: bool = False

    # --- Risk Assessment & Clinical Context Engine -----------------------------

    risk_engine_version: str = "v1.0"

    # --- Stream ---------------------------------------------------------------

    stream_api_key: str = ""
    stream_api_secret: str = ""

    # --- CORS -----------------------------------------------------------------

    frontend_url: str = "http://localhost:5173"
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # --- Pydantic Settings Config ---------------------------------------------

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (singleton)."""
    return Settings()
