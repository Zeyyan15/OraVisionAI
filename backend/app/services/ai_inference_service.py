"""
OraVisionAI — AI Inference Service

Integrates the 7-class EfficientNetB0 oral lesion classifier and OraVisionAI YOLO lesion detector.
Provides reusable model management, pre-inference validation, transaction-safe database persistence,
7-class probability distributions, and normalized spatial detections.
"""

from __future__ import annotations

import decimal
import io
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.ai_model import AIModel
from app.models.ai_prediction import AIPrediction
from app.models.prediction_probability import PredictionProbability
from app.models.screening import Screening
from app.models.screening_image import ScreeningImage
from app.models.yolo_detection import YOLODetection
from app.schemas.ai import (
    BoundingBox,
    ClassificationResult,
    DetectionItem,
    ImageInferenceResult,
    ProbabilityItem,
    ScreeningInferenceResponse,
)
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)


# =============================================================================
# Authoritative 7-Class Oral Condition Taxonomy (7Teeth Dataset)
# =============================================================================

EFFICIENTNET_CLASS_CODES: List[str] = [
    "CaS",
    "CoS",
    "Gum",
    "MC",
    "OC",
    "OLP",
    "OT",
]

EFFICIENTNET_CLASS_NAMES: List[str] = [
    "Canker Sore",
    "Cold Sore",
    "Gum Disease",
    "Mucocele",
    "Oral Cancer",
    "Oral Lichen Planus",
    "Oral Thrush",
]

EFFICIENTNET_CLASS_MAPPING: Dict[str, str] = dict(
    zip(EFFICIENTNET_CLASS_CODES, EFFICIENTNET_CLASS_NAMES)
)

INPUT_IMAGE_SIZE: Tuple[int, int] = (224, 224)


# =============================================================================
# AI Model Manager (Singleton / Cached Model Registry)
# =============================================================================


class AIModelManager:
    """Manages lazy-loading and in-memory lifecycle of AI model instances."""

    _classifier_model: Optional[Any] = None
    _yolo_model: Optional[Any] = None
    _classifier_load_attempted: bool = False
    _yolo_load_attempted: bool = False

    @classmethod
    def load_classifier(cls, model_path: Optional[str] = None) -> Optional[Any]:
        if cls._classifier_model is not None:
            return cls._classifier_model

        settings = get_settings()
        path = model_path or settings.classifier_model_path

        if not path or not os.path.exists(path):
            logger.warning(
                "Classifier model artifact not found at '%s'. Real classifier inference will be disabled.",
                path,
            )
            cls._classifier_load_attempted = True
            return None

        try:
            import tensorflow as tf

            logger.info("Loading EfficientNetB0 classifier from: %s", path)
            cls._classifier_model = tf.keras.models.load_model(path, compile=False)
            cls._classifier_load_attempted = True
            logger.info("EfficientNetB0 classifier loaded successfully.")
            return cls._classifier_model
        except Exception as exc:
            cls._classifier_load_attempted = True
            logger.error("Failed to load EfficientNetB0 classifier from '%s': %s", path, exc)
            return None

    @classmethod
    def load_yolo(cls, model_path: Optional[str] = None) -> Optional[Any]:
        if cls._yolo_model is not None:
            return cls._yolo_model

        settings = get_settings()
        path = model_path or settings.yolo_model_path

        if not path or not os.path.exists(path):
            logger.warning(
                "YOLO detector artifact not found at '%s'. Real YOLO detection will be disabled.",
                path,
            )
            cls._yolo_load_attempted = True
            return None

        try:
            from ultralytics import YOLO

            logger.info("Loading OraVisionAI YOLO model from: %s", path)
            cls._yolo_model = YOLO(path)
            cls._yolo_load_attempted = True
            logger.info("OraVisionAI YOLO model loaded successfully.")
            return cls._yolo_model
        except Exception as exc:
            cls._yolo_load_attempted = True
            logger.error("Failed to load OraVisionAI YOLO model from '%s': %s", path, exc)
            return None

    @classmethod
    def get_classifier(cls) -> Optional[Any]:
        if cls._classifier_model is None and not cls._classifier_load_attempted:
            cls.load_classifier()
        return cls._classifier_model

    @classmethod
    def get_yolo(cls) -> Optional[Any]:
        if cls._yolo_model is None and not cls._yolo_load_attempted:
            cls.load_yolo()
        return cls._yolo_model

    @classmethod
    def is_classifier_available(cls) -> bool:
        return cls.get_classifier() is not None

    @classmethod
    def is_yolo_available(cls) -> bool:
        return cls.get_yolo() is not None


# =============================================================================
# Image Preprocessing Utilities
# =============================================================================


def preprocess_image_for_efficientnet(image_bytes: bytes) -> np.ndarray:
    """
    Decodes raw image bytes and prepares a 224x224 RGB float32 batch array
    with Keras EfficientNet input preprocessing.
    """
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pil_img = pil_img.resize(INPUT_IMAGE_SIZE, Image.Resampling.BILINEAR)
    img_array = np.array(pil_img, dtype=np.float32)
    img_batch = np.expand_dims(img_array, axis=0)

    try:
        import tensorflow as tf

        preprocessed = tf.keras.applications.efficientnet.preprocess_input(img_batch)
    except Exception:
        preprocessed = img_batch

    return preprocessed


# =============================================================================
# AI Inference Service
# =============================================================================


class AIInferenceService:
    """Core AI diagnostic and inference orchestration service."""

    @staticmethod
    def classify_image(image_bytes: bytes) -> Tuple[ClassificationResult, int]:
        """
        Runs 7-class EfficientNetB0 classification on an oral image.
        Returns the ClassificationResult and inference latency in milliseconds.
        """
        classifier = AIModelManager.get_classifier()

        if classifier is None:
            raise RuntimeError(
                "Classifier model artifact is unavailable on this server. "
                "Real model inference was not executed because the configured trained model artifacts were unavailable."
            )

        start_time = time.perf_counter()
        preprocessed_batch = preprocess_image_for_efficientnet(image_bytes)
        raw_predictions = classifier.predict(preprocessed_batch, verbose=0)
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # raw_predictions shape: (1, 7)
        probs_array = raw_predictions[0].tolist()

        # Build 7-class probability items
        probabilities: List[ProbabilityItem] = []
        for idx, (code, name) in enumerate(zip(EFFICIENTNET_CLASS_CODES, EFFICIENTNET_CLASS_NAMES)):
            prob_val = float(probs_array[idx]) if idx < len(probs_array) else 0.0
            prob_val = max(0.0, min(1.0, prob_val))
            probabilities.append(
                ProbabilityItem(
                    class_index=idx,
                    class_code=code,
                    class_name=name,
                    probability=round(prob_val, 4),
                )
            )

        top_idx = int(np.argmax(probs_array))
        predicted_class = EFFICIENTNET_CLASS_NAMES[top_idx]
        predicted_code = EFFICIENTNET_CLASS_CODES[top_idx]
        confidence = round(max(0.0, min(1.0, float(probs_array[top_idx]))), 4)

        result = ClassificationResult(
            predicted_class=predicted_class,
            predicted_code=predicted_code,
            confidence=confidence,
            probabilities=probabilities,
        )

        return result, duration_ms

    @staticmethod
    def detect_lesions(image_bytes: bytes) -> List[DetectionItem]:
        """
        Runs OraVisionAI YOLO lesion detection on an oral image.
        Extracts spatial bounding boxes normalized to [0.0, 1.0].
        """
        yolo_model = AIModelManager.get_yolo()

        if yolo_model is None:
            logger.warning("YOLO model unavailable; returning empty detection findings.")
            return []

        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        width, height = pil_img.size

        if width <= 0 or height <= 0:
            return []

        results = yolo_model(pil_img, verbose=False)
        detections: List[DetectionItem] = []

        if not results:
            return detections

        first_res = results[0]
        boxes = getattr(first_res, "boxes", None)
        if boxes is None or len(boxes) == 0:
            return detections

        for box in boxes:
            cls_idx = int(box.cls[0].item())
            conf_val = float(box.conf[0].item())
            class_name = first_res.names.get(cls_idx, f"Class_{cls_idx}")

            # Normalize coordinates [0.0, 1.0]
            xyxy = box.xyxy[0].tolist()
            x_min = max(0.0, min(1.0, xyxy[0] / width))
            y_min = max(0.0, min(1.0, xyxy[1] / height))
            x_max = max(0.0, min(1.0, xyxy[2] / width))
            y_max = max(0.0, min(1.0, xyxy[3] / height))

            detections.append(
                DetectionItem(
                    class_name=class_name,
                    confidence=round(max(0.0, min(1.0, conf_val)), 4),
                    bbox=BoundingBox(
                        x_min=round(x_min, 4),
                        y_min=round(y_min, 4),
                        x_max=round(x_max, 4),
                        y_max=round(y_max, 4),
                    ),
                )
            )

        return detections

    @staticmethod
    async def get_or_create_ai_model_record(
        db: AsyncSession,
        name: str,
        model_type: str,
        version: str,
        architecture: str,
        weights_path: Optional[str],
        class_labels: List[str],
        input_shape: str = "224x224x3",
    ) -> AIModel:
        """
        Retrieves or registers an AIModel entity in the database
        to ensure strict model version traceability.
        """
        stmt = select(AIModel).where(AIModel.name == name, AIModel.version == version)
        result = await db.execute(stmt)
        ai_model = result.scalar_one_or_none()

        if ai_model is None:
            ai_model = AIModel(
                name=name,
                model_type=model_type,
                version=version,
                architecture=architecture,
                weights_path=weights_path,
                input_shape=input_shape,
                class_labels=class_labels,
                is_active=True,
            )
            db.add(ai_model)
            await db.flush()
            logger.info("Registered AIModel version record: %s (v%s)", name, version)

        return ai_model

    @classmethod
    async def run_screening_inference(
        cls,
        db: AsyncSession,
        patient_id: uuid.UUID,
        screening_id: uuid.UUID,
        force_recompute: bool = False,
    ) -> ScreeningInferenceResponse:
        """
        Executes end-to-end AI inference for all images in a patient's screening session.
        Applies patient ownership checks, transaction safety, idempotency, and database persistence.
        """
        settings = get_settings()

        # 1. Fetch screening with ownership and images loaded
        stmt = (
            select(Screening)
            .where(
                Screening.id == screening_id,
                Screening.patient_id == patient_id,
                Screening.is_deleted.is_(False),
            )
            .options(
                selectinload(Screening.images),
                selectinload(Screening.ai_predictions).selectinload(AIPrediction.probabilities),
                selectinload(Screening.yolo_detections),
            )
        )
        result = await db.execute(stmt)
        screening = result.scalar_one_or_none()

        if screening is None:
            raise LookupError(f"Screening '{screening_id}' not found or inaccessible.")

        if not screening.images:
            raise ValueError("Screening session contains no uploaded oral photographs for AI analysis.")

        # 2. Idempotency Check: return existing completed results if available and not forced
        if not force_recompute and screening.status == "completed" and screening.ai_predictions:
            logger.info("Returning existing completed AI inference results for screening %s", screening_id)
            cached_results: List[ImageInferenceResult] = []

            for img in screening.images:
                pred = next((p for p in screening.ai_predictions if p.screening_image_id == img.id), None)
                classification_dto: Optional[ClassificationResult] = None
                if pred:
                    prob_items = [
                        ProbabilityItem(
                            class_index=prob.class_index,
                            class_code=next(
                                (c for c, n in EFFICIENTNET_CLASS_MAPPING.items() if n == prob.class_name),
                                prob.class_name,
                            ),
                            class_name=prob.class_name,
                            probability=float(prob.probability),
                        )
                        for prob in sorted(pred.probabilities, key=lambda x: x.class_index)
                    ]
                    classification_dto = ClassificationResult(
                        predicted_class=pred.predicted_class,
                        confidence=float(pred.confidence),
                        probabilities=prob_items,
                    )

                img_detections = [
                    DetectionItem(
                        class_name=det.detected_class,
                        confidence=float(det.confidence),
                        bbox=BoundingBox(
                            x_min=float(det.bbox_x_min),
                            y_min=float(det.bbox_y_min),
                            x_max=float(det.bbox_x_max),
                            y_max=float(det.bbox_y_max),
                        ),
                    )
                    for det in screening.yolo_detections
                    if det.screening_image_id == img.id
                ]

                cached_results.append(
                    ImageInferenceResult(
                        screening_image_id=img.id,
                        classification=classification_dto,
                        detections=img_detections,
                        inference_duration_ms=pred.inference_duration_ms if pred else None,
                    )
                )

            return ScreeningInferenceResponse(
                screening_id=screening.id,
                status=screening.status,
                total_images_processed=len(cached_results),
                results=cached_results,
            )

        # 3. Check model availability before starting inference
        classifier = AIModelManager.get_classifier()
        if classifier is None:
            raise RuntimeError(
                "Real model inference was not executed because the configured trained model artifacts were unavailable."
            )

        # 4. Resolve AI Model Registry records
        classifier_record = await cls.get_or_create_ai_model_record(
            db=db,
            name=settings.classifier_model_name,
            model_type="classifier",
            version=settings.classifier_model_version,
            architecture="EfficientNetB0",
            weights_path=settings.classifier_model_path,
            class_labels=EFFICIENTNET_CLASS_NAMES,
            input_shape=settings.classifier_input_shape,
        )

        yolo_record = await cls.get_or_create_ai_model_record(
            db=db,
            name=settings.yolo_model_name,
            model_type="detector",
            version=settings.yolo_model_version,
            architecture="YOLO",
            weights_path=settings.yolo_model_path,
            class_labels=["Lesion", "Abnormality"],
            input_shape="Variable",
        )

        # 5. Process each screening image
        screening.status = "processing"
        image_results: List[ImageInferenceResult] = []

        try:
            for img in screening.images:
                # Download image data
                img_bytes = StorageService.download_screening_image(img.storage_path)

                # Run classification
                classification_res, duration_ms = cls.classify_image(img_bytes)

                # Run YOLO detection
                detections_res = cls.detect_lesions(img_bytes)

                # Persist AIPrediction
                db_prediction = AIPrediction(
                    screening_id=screening.id,
                    screening_image_id=img.id,
                    ai_model_id=classifier_record.id,
                    predicted_class=classification_res.predicted_class,
                    confidence=decimal.Decimal(str(classification_res.confidence)),
                    inference_duration_ms=duration_ms,
                    status="completed",
                )
                db.add(db_prediction)
                await db.flush()

                # Persist 7 PredictionProbability records
                for prob_item in classification_res.probabilities:
                    db_prob = PredictionProbability(
                        ai_prediction_id=db_prediction.id,
                        class_name=prob_item.class_name,
                        probability=decimal.Decimal(str(prob_item.probability)),
                        class_index=prob_item.class_index,
                    )
                    db.add(db_prob)

                # Persist YOLODetection records
                for det_item in detections_res:
                    db_det = YOLODetection(
                        screening_id=screening.id,
                        screening_image_id=img.id,
                        ai_model_id=yolo_record.id,
                        detected_class=det_item.class_name,
                        confidence=decimal.Decimal(str(det_item.confidence)),
                        bbox_x_min=decimal.Decimal(str(det_item.bbox.x_min)),
                        bbox_y_min=decimal.Decimal(str(det_item.bbox.y_min)),
                        bbox_x_max=decimal.Decimal(str(det_item.bbox.x_max)),
                        bbox_y_max=decimal.Decimal(str(det_item.bbox.y_max)),
                    )
                    db.add(db_det)

                image_results.append(
                    ImageInferenceResult(
                        screening_image_id=img.id,
                        classification=classification_res,
                        detections=detections_res,
                        inference_duration_ms=duration_ms,
                    )
                )

            screening.status = "completed"
            await db.commit()
            logger.info("Successfully completed AI inference for screening %s", screening_id)

        except Exception as exc:
            await db.rollback()
            logger.error("AI inference transaction failed for screening %s: %s", screening_id, exc)
            raise

        return ScreeningInferenceResponse(
            screening_id=screening.id,
            status="completed",
            total_images_processed=len(image_results),
            results=image_results,
        )
