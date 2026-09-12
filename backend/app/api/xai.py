"""
OraVisionAI — Explainable AI (XAI) API Endpoints

Provides catalog metadata for available XAI visual explanation algorithms.
"""

from fastapi import APIRouter, status

from app.schemas.xai import XAIAvailableMethodsResponse
from app.services.xai_service import XAIService

router = APIRouter(
    prefix="/xai",
    tags=["xai"],
)


@router.get(
    "/methods",
    response_model=XAIAvailableMethodsResponse,
    status_code=status.HTTP_200_OK,
    summary="List available XAI explanation algorithms",
)
async def list_xai_methods() -> XAIAvailableMethodsResponse:
    """Returns catalog of supported primary and secondary XAI explanation methods."""
    return XAIService.get_supported_methods()
