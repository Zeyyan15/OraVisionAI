"""
OraVisionAI — SQLAlchemy Models Package

Exports all 23 domain entities for centralized discovery and Alembic autogeneration.
"""

from app.models.ai_model import AIModel
from app.models.ai_prediction import AIPrediction
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.consultation import Consultation
from app.models.conversation import Conversation
from app.models.dentist import Dentist
from app.models.dentist_assessment import DentistAssessment
from app.models.dentist_availability import DentistAvailability
from app.models.dentist_verification import DentistVerification
from app.models.message import Message
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.patient_medical_profile import PatientMedicalProfile
from app.models.prediction_probability import PredictionProbability
from app.models.report import Report
from app.models.risk_assessment import RiskAssessment
from app.models.screening import Screening
from app.models.screening_image import ScreeningImage
from app.models.user import User
from app.models.xai_result import XAIResult
from app.models.yolo_detection import YOLODetection

__all__ = [
    "AIModel",
    "AIPrediction",
    "Appointment",
    "AuditLog",
    "Consultation",
    "Conversation",
    "Dentist",
    "DentistAssessment",
    "DentistAvailability",
    "DentistVerification",
    "Message",
    "Notification",
    "Patient",
    "PatientDentistRelationship",
    "PatientMedicalProfile",
    "PredictionProbability",
    "Report",
    "RiskAssessment",
    "Screening",
    "ScreeningImage",
    "User",
    "XAIResult",
    "YOLODetection",
]

