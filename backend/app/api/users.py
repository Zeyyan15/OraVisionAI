"""
OraVisionAI — User & Role Management API Endpoints

Provides endpoints for inspecting application user profiles and verifying role-based access.
"""

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_admin, require_dentist, require_patient
from app.models.user import User
from app.schemas.user import RoleAccessResponse, UserResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_my_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return current_user


@router.get("/me/patient-access", response_model=RoleAccessResponse)
async def verify_patient_access(
    current_user: User = Depends(require_patient),
) -> RoleAccessResponse:
    return RoleAccessResponse(
        access="granted",
        role=current_user.role,
        user_id=current_user.id,
    )


@router.get("/me/dentist-access", response_model=RoleAccessResponse)
async def verify_dentist_access(
    current_user: User = Depends(require_dentist),
) -> RoleAccessResponse:
    return RoleAccessResponse(
        access="granted",
        role=current_user.role,
        user_id=current_user.id,
    )


@router.get("/me/admin-access", response_model=RoleAccessResponse)
async def verify_admin_access(
    current_user: User = Depends(require_admin),
) -> RoleAccessResponse:
    return RoleAccessResponse(
        access="granted",
        role=current_user.role,
        user_id=current_user.id,
    )
