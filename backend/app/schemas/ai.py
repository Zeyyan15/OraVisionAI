"""
OraVisionAI — AI Inference Pydantic Schemas

Data transfer schemas for EfficientNet classification, YOLO lesion detection, and screening inference results.
"""

from __future__ import annotations

import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProbabilityItem(BaseModel):
    """Discrete class probability in the 7-class distribution."""

    class_index: int = Field(..., ge=0, le=6)
    class_code: str
    class_name: str
    probability: float = Field(..., ge=0.0, le=1.0)


class ClassificationResult(BaseModel):
    """Result of the 7-class EfficientNetB0 oral lesion classifier."""

    predicted_class: str
    predicted_code: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    probabilities: List[ProbabilityItem] = Field(default_factory=list)


class BoundingBox(BaseModel):
    """Normalized spatial bounding box coordinates [0.0, 1.0]."""

    x_min: float = Field(..., ge=0.0, le=1.0)
    y_min: float = Field(..., ge=0.0, le=1.0)
    x_max: float = Field(..., ge=0.0, le=1.0)
    y_max: float = Field(..., ge=0.0, le=1.0)


class DetectionItem(BaseModel):
    """Individual lesion/object detection finding from YOLO."""

    class_name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: BoundingBox


class ImageInferenceResult(BaseModel):
    """Consolidated AI diagnostic output for a single oral screening photograph."""

    screening_image_id: uuid.UUID
    classification: Optional[ClassificationResult] = None
    detections: List[DetectionItem] = Field(default_factory=list)
    inference_duration_ms: Optional[int] = None


class ScreeningInferenceResponse(BaseModel):
    """Full AI diagnostic response for a patient screening session."""

    screening_id: uuid.UUID
    status: str
    total_images_processed: int
    results: List[ImageInferenceResult] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
