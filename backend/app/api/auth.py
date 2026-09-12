"""
OraVisionAI — Authentication API Endpoints

Provides endpoints for verifying and inspecting authenticated user identity.
"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import FirebaseUser, get_current_firebase_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


class AuthIdentityResponse(BaseModel):
    authenticated: bool
    firebase_uid: str
    email: Optional[str] = None
    email_verified: bool = False


@router.get("/me", response_model=AuthIdentityResponse)
async def get_current_user_identity(
    current_user: FirebaseUser = Depends(get_current_firebase_user),
) -> AuthIdentityResponse:
    return AuthIdentityResponse(
        authenticated=True,
        firebase_uid=current_user.uid,
        email=current_user.email,
        email_verified=current_user.email_verified,
    )
