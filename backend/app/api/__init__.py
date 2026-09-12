"""
OraVisionAI — API Router Aggregator

Aggregates and registers all domain-specific routers:
- /api/auth: Authentication & token verification
- /api/users: User profiles & role synchronization
- /api/patients: Patient profiles & medical history
- /api/dentists: Dentist directory & profiles
- /api/admin: User management, verification reviews, audit logging, & analytics
- /api/screenings: Patient screenings, image uploads, AI inference, XAI explanations, & clinical reports
- /api/xai: XAI methods catalog
- /api/reports: Clinical report inspection & PDF document downloads
"""

from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.appointments import router as appointments_router
from app.api.auth import router as auth_router
from app.api.consultations import router as consultations_router
from app.api.conversations import router as conversations_router
from app.api.dentists import router as dentists_router
from app.api.notifications import router as notifications_router
from app.api.patients import router as patients_router
from app.api.reports import router as reports_router
from app.api.screenings import router as screenings_router
from app.api.users import router as users_router
from app.api.xai import router as xai_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(patients_router)
api_router.include_router(dentists_router)
api_router.include_router(admin_router)
api_router.include_router(screenings_router)
api_router.include_router(xai_router)
api_router.include_router(reports_router)
api_router.include_router(appointments_router)
api_router.include_router(consultations_router)
api_router.include_router(conversations_router)
api_router.include_router(notifications_router)
