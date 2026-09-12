"""
OraVisionAI — Authentication & Authorization Dependencies

Provides FastAPI dependencies for:
1. Firebase ID token verification (Authentication)
2. PostgreSQL User resolution & synchronization (Identity Mapping)
3. Role-based access control (Authorization: patient, dentist, admin)

The backend never trusts client-supplied UIDs or roles.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.firebase import verify_firebase_id_token
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(
    scheme_name="FirebaseBearer",
    description="Enter your Firebase ID Token in the format: Bearer <token>",
    auto_error=False,
)


class FirebaseUser(BaseModel):
    uid: str
    email: Optional[str] = None
    email_verified: bool = False
    name: Optional[str] = None
    picture: Optional[str] = None

    model_config = ConfigDict(frozen=True)


async def get_current_firebase_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> FirebaseUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is empty",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        decoded_token = verify_firebase_id_token(token)
    except RuntimeError as exc:
        logger.warning("Firebase verification attempted while SDK unconfigured: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is currently not configured",
        )
    except auth.ExpiredIdTokenError:
        logger.info("Rejected expired Firebase token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (auth.InvalidIdTokenError, auth.RevokedIdTokenError, auth.CertificateFetchError) as exc:
        logger.warning("Rejected invalid Firebase token: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        logger.error("Unexpected token verification error: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication verification failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return FirebaseUser(
        uid=decoded_token.get("uid", ""),
        email=decoded_token.get("email"),
        email_verified=decoded_token.get("email_verified", False),
        name=decoded_token.get("name"),
        picture=decoded_token.get("picture"),
    )


async def get_current_user(
    firebase_user: FirebaseUser = Depends(get_current_firebase_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    from app.services.user_service import UserService

    try:
        user = await UserService.sync_firebase_user(db, firebase_user)
        return user
    except Exception as exc:
        logger.error("Failed to resolve application user from database: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve user account",
        )


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated or suspended",
        )
    return current_user


def require_role(required_role: str) -> Callable:
    async def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role != required_role:
            logger.warning(
                "Access denied for user %s with role %s (required: %s)",
                current_user.id,
                current_user.role,
                required_role,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: {required_role} role required",
            )
        return current_user

    return role_checker


require_patient = require_role("patient")
require_dentist = require_role("dentist")
require_admin = require_role("admin")
