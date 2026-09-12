"""
OraVisionAI — Explainable AI (XAI) Pydantic Schemas

Data transfer schemas for visual attention heatmaps, overlay artifacts, and XAI generation requests.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class XAIMethodInfo(BaseModel):
    """Metadata describing an available XAI explanation method."""

    method: str
    display_name: str
    description: str
    is_primary_user_facing: bool


class XAIAvailableMethodsResponse(BaseModel):
    """List of supported primary and secondary XAI methods."""

    primary_methods: List[str]
    secondary_methods: List[str]
    methods: List[XAIMethodInfo]


class XAIResultResponse(BaseModel):
    """Stored visual explanation finding for an AI prediction."""

    id: uuid.UUID
    ai_prediction_id: uuid.UUID
    screening_image_id: uuid.UUID
    method: str
    target_layer: Optional[str] = None
    is_primary_user_facing: bool
    heatmap_storage_path: str
    overlay_image_storage_path: str
    parameters: Optional[Dict[str, Any]] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class XAIGenerationRequest(BaseModel):
    """Payload for requesting XAI heatmap generation."""

    include_secondary: bool = Field(
        default=False,
        description="Whether to generate secondary XAI methods (Grad-CAM++, LayerCAM, Score-CAM, IG) in addition to primary",
    )
    force_recompute: bool = Field(
        default=False,
        description="Whether to regenerate heatmaps even if cached artifacts exist",
    )
    methods: Optional[List[str]] = Field(
        default=None,
        description="Optional explicit subset of methods to execute (e.g. ['grad_cam', 'occlusion_sensitivity'])",
    )

    model_config = ConfigDict(extra="forbid")


class ScreeningXAIResponse(BaseModel):
    """Aggregated XAI explanation response for a patient screening session."""

    screening_id: uuid.UUID
    total_results: int
    results: List[XAIResultResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
