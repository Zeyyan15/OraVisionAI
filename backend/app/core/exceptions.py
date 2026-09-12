"""
OraVisionAI — Centralized Exception Handlers

Provides standardized, secure exception handlers for:
1. StarletteHTTPException: Preserves intentional HTTP status codes (400, 401, 403, 404, 409, 413, 422, 429),
   safe application details, and critical response headers (WWW-Authenticate, Retry-After).
2. RequestValidationError: Formats field-level validation errors for client usability while sanitizing
   internal implementation details, filesystem paths, and database internals.
3. SQLAlchemyError: Logs database errors internally and returns a sanitized generic 500 response.
4. Generic unhandled Exception: Logs full tracebacks internally and returns a sanitized generic 500 response.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handle Starlette / FastAPI HTTPExceptions.

    Preserves intentional status codes (400, 401, 403, 404, 409, 413, 422, 429),
    safe application-level details, and headers (e.g. WWW-Authenticate, Retry-After).
    """
    headers = dict(exc.headers) if exc.headers else {}
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle Pydantic RequestValidationErrors.

    Preserves useful field-level validation info (loc, msg, type) for clients while
    stripping internal Python objects, filesystem paths, and database details.
    """
    sanitized_errors: List[Dict[str, Any]] = []

    for error in exc.errors():
        error_dict: Dict[str, Any] = {
            "loc": error.get("loc", []),
            "msg": error.get("msg", "Validation error"),
            "type": error.get("type", "value_error"),
        }

        # Sanitize ctx if present
        ctx = error.get("ctx")
        if isinstance(ctx, dict):
            safe_ctx = {}
            for k, v in ctx.items():
                if isinstance(v, (int, float, str, bool)):
                    s_val = str(v)
                    # Strip filesystem paths or SQL indicators
                    if "/" not in s_val and "\\" not in s_val and "SELECT" not in s_val.upper():
                        safe_ctx[k] = v
            if safe_ctx:
                error_dict["ctx"] = safe_ctx

        sanitized_errors.append(error_dict)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": sanitized_errors},
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Handle SQLAlchemy database exceptions.

    Logs the database error internally and returns a sanitized generic 500 response.
    Never exposes raw SQL syntax, schema details, or table names to API consumers.
    """
    logger.error("Database error processing request %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred while processing the request."},
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unexpected unhandled exceptions.

    Logs full traceback internally and returns a sanitized generic 500 response.
    """
    logger.error("Unhandled exception processing request %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )


def setup_exception_handlers(app: FastAPI) -> None:
    """Register centralized exception handlers on the FastAPI application."""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
