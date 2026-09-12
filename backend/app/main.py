"""
OraVisionAI — FastAPI Application Entry Point
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import get_settings
from app.core.firebase import initialize_firebase
from app.core.logging import setup_logging
from app.db.session import dispose_engine

from app.core.exceptions import setup_exception_handlers
from app.core.security import RequestSizeLimitMiddleware, SecurityHeadersMiddleware

settings = get_settings()

setup_logging(log_level=settings.log_level)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("OraVisionAI API starting up")
    logger.info("Environment: %s", settings.environment)
    logger.info("Debug mode: %s", settings.debug)
    initialize_firebase()
    yield
    await dispose_engine()
    logger.info("OraVisionAI API shutting down")


docs_enabled = settings.docs_enabled and settings.environment != "production"

app = FastAPI(
    title=settings.app_name,
    description="Backend API for the OraVisionAI platform",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
)

# Centralized Exception Handlers (4xx preservation, useful 422, sanitized 500)
setup_exception_handlers(app)

app.include_router(api_router, prefix="/api")

# Middleware stack (registered outermost-last in ASGI)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "User-Agent",
        "X-Requested-With",
        "X-Forwarded-Proto",
        "Retry-After",
    ],
)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.get("/")
async def root():
    return {
        "application": settings.app_name,
        "status": "online",
        "version": settings.app_version,
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
    }
