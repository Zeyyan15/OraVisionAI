"""
OraVisionAI — User & Role Management API Endpoints

Provides endpoints for inspecting application user profiles and verifying role-based access.
"""

from fastapi import APIRouter, Depends
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_admin, require_dentist, require_patient
from app.core.auth import FirebaseUser, get_current_firebase_user, get_current_user, require_admin, require_dentist, require_patient
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import RoleAccessResponse, UserResponse
from app.schemas.user import RoleAccessResponse, UserResponse, UserSyncRequest
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_my_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return current_user


@router.post("/sync", response_model=UserResponse)
async def sync_user_profile(
    payload: UserSyncRequest,
    firebase_user: FirebaseUser = Depends(get_current_firebase_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Synchronizes authenticated Firebase identity into PostgreSQL.
    Accepts requested role on initial registration/onboarding.
    Permits only 'patient' and 'dentist' roles.
    Rejects 'admin' attempts with 403 Forbidden.
    """
    if payload.role:
        role_lower = payload.role.strip().lower()
        if role_lower == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative accounts cannot be registered publicly. Admin access must be provisioned by a platform administrator.",
            )
        if role_lower not in ("patient", "dentist"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid registration role '{payload.role}'. Allowed roles are 'patient' and 'dentist'.",
            )
        requested_role = role_lower
    else:
        requested_role = "patient"

    user = await UserService.sync_firebase_user(
        db=db,
        firebase_user=firebase_user,
        requested_role=requested_role,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    return user


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
