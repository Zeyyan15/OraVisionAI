"""
OraVisionAI — Core Production Security Infrastructure

Provides:
1. SecurityHeadersMiddleware: Defense-in-depth HTTP security headers (CSP, X-Content-Type-Options,
   X-Frame-Options, Referrer-Policy, Permissions-Policy) and conditional HSTS.
2. RequestSizeLimitMiddleware: Pre-buffering HTTP request body size limiting (1 MB JSON, 20 MB multipart).
3. InMemoryRateLimiter: Process-local sliding-window rate limiter with per-user and per-IP isolation,
   automatic cleanup, concurrency safety, and Retry-After calculation.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict, deque
import logging
import math
import time
from typing import Callable, Dict, Optional, Tuple, Union
import uuid

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import get_settings

logger = logging.getLogger(__name__)


# =============================================================================
# Custom Exceptions
# =============================================================================


class RequestSizeLimitExceeded(Exception):
    """Raised when an incoming request body exceeds the configured threshold."""
    pass


# =============================================================================
# 1. Defensive HTTP Security Headers Middleware
# =============================================================================


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injects defensive HTTP security headers on all API responses.

    NOTE: Security headers represent defense-in-depth HTTP hardening against MIME confusion,
    clickjacking, and framing. Content Security Policy (CSP) restricts unauthorized resource
    embedding, but CSP alone does NOT constitute complete XSS protection; application security
    relies on input validation, context-aware escaping, output encoding, and server-side token derivation.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        settings = get_settings()

        # Standard defense-in-depth headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"

        # Conditional HSTS: Emitted ONLY for HTTPS / production, never on local HTTP development
        is_https = (
            request.url.scheme == "https"
            or request.headers.get("x-forwarded-proto", "").lower() == "https"
            or (settings.environment == "production" and settings.hsts_enabled)
        )
        if is_https:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# =============================================================================
# 2. Request Body Size Limit Middleware (Pre-Buffering Enforcement)
# =============================================================================


class RequestSizeLimitMiddleware:
    """
    Enforces request body size limits at the ASGI layer BEFORE unbounded buffering into memory.

    Distinguishes:
    - 20 MB multipart HTTP request limit for image uploads (allowing framing overhead for 15 MB file)
    - 1 MB JSON / standard HTTP request limit for all other routes
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        settings = get_settings()
        path = scope.get("path", "")

        # Extract headers
        raw_headers = dict(scope.get("headers", []))
        content_type = raw_headers.get(b"content-type", b"").decode("latin1").lower()
        content_length_header = raw_headers.get(b"content-length")

        # Determine threshold: Multipart image endpoints vs. standard JSON endpoints
        is_multipart = (
            "multipart/form-data" in content_type
            or ("/screenings/" in path and path.endswith("/images"))
        )
        max_allowed_bytes = (
            settings.max_multipart_body_size_bytes
            if is_multipart
            else settings.max_json_body_size_bytes
        )

        # 1. Fast-Path Check: Content-Length header inspection
        if content_length_header is not None:
            try:
                content_length = int(content_length_header)
                if content_length > max_allowed_bytes:
                    logger.warning(
                        "Rejected request with oversized Content-Length (%d > %d) on path %s",
                        content_length,
                        max_allowed_bytes,
                        path,
                    )
                    response = JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={"detail": "Request entity exceeds maximum allowable size."},
                    )
                    await response(scope, receive, send)
                    return
            except ValueError:
                pass

        # 2. Streaming / Chunked Transfer-Encoding enforcement
        bytes_received = 0

        async def limited_receive() -> Message:
            nonlocal bytes_received
            message = await receive()
            if message.get("type") == "http.request":
                chunk = message.get("body", b"")
                bytes_received += len(chunk)
                if bytes_received > max_allowed_bytes:
                    logger.warning(
                        "Terminated streaming request exceeding size limit (%d > %d) on path %s",
                        bytes_received,
                        max_allowed_bytes,
                        path,
                    )
                    raise RequestSizeLimitExceeded()
            return message

        try:
            await self.app(scope, limited_receive, send)
        except RequestSizeLimitExceeded:
            response = JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request entity exceeds maximum allowable size."},
            )
            await response(scope, receive, send)


# =============================================================================
# 3. Process-Local In-Memory Sliding-Window Rate Limiter
# =============================================================================


class InMemoryRateLimiter:
    """
    Thread-safe, process-local sliding-window in-memory rate limiter.

    EXPLICIT STATEMENT:
    This rate limiter operates strictly within the single local Python process.
    It does NOT provide distributed protection across multiple horizontal worker
    nodes or server replicas. External infrastructure (e.g., Redis) is intentionally
    excluded per project specifications. In clustered production deployments, reverse-proxy
    or API gateway rate limiters (e.g. Nginx limit_req, Cloudflare) should be utilized.
    """

    # Category limits: (max_requests, window_duration_seconds)
    LIMITS: Dict[str, Tuple[int, int]] = {
        "ai_run": (10, 60),          # Heavy AI Inference & XAI
        "image_upload": (20, 60),    # File Uploads
        "report_ops": (15, 60),      # Report Generation & PDF Download
        "identity_read": (60, 60),   # Identity & User Profile Reads
        "default": (120, 60),        # Baseline API Defense
    }

    def __init__(self):
        self._lock = asyncio.Lock()
        self._buckets: Dict[str, deque] = defaultdict(deque)
        self._request_count = 0

    async def check(
        self,
        identity: str,
        scope: str = "default",
    ) -> Tuple[bool, int, int]:
        """
        Check and record a request in the sliding window.

        Returns:
            (allowed: bool, retry_after: int, current_count: int)
        """
        settings = get_settings()
        if not settings.rate_limit_enabled:
            return True, 0, 0

        max_requests, window_seconds = self.LIMITS.get(scope, self.LIMITS["default"])
        composite_key = f"{scope}:{identity}"
        now = time.time()
        window_start = now - window_seconds

        async with self._lock:
            self._request_count += 1
            timestamps = self._buckets[composite_key]

            # Evict expired entries for this specific key
            while timestamps and timestamps[0] < window_start:
                timestamps.popleft()

            # Check if threshold exceeded
            if len(timestamps) >= max_requests:
                oldest_timestamp = timestamps[0]
                seconds_remaining = (oldest_timestamp + window_seconds) - now
                retry_after = max(1, int(math.ceil(seconds_remaining)))
                return False, retry_after, len(timestamps)

            # Record this request
            timestamps.append(now)
            current_count = len(timestamps)

            # Periodic cleanup sweep: every 1,000 requests or if key count exceeds 5,000
            if self._request_count % 1000 == 0 or len(self._buckets) > 5000:
                self._prune_stale_buckets_sync(now)

            return True, 0, current_count

    def _prune_stale_buckets_sync(self, now: float) -> int:
        """Internal synchronous cleanup of stale buckets."""
        max_window = max(w for _, w in self.LIMITS.values())
        stale_threshold = now - max_window
        keys_to_remove = []

        for key, timestamps in self._buckets.items():
            while timestamps and timestamps[0] < stale_threshold:
                timestamps.popleft()
            if not timestamps:
                keys_to_remove.append(key)

        for key in keys_to_remove:
            del self._buckets[key]

        return len(keys_to_remove)

    async def prune_stale_buckets(self) -> int:
        """Explicit async cleanup of stale buckets (useful for maintenance and testing)."""
        async with self._lock:
            return self._prune_stale_buckets_sync(time.time())

    def clear(self) -> None:
        """Reset all in-memory buckets (useful for test isolation)."""
        self._buckets.clear()
        self._request_count = 0


# Global process-local rate limiter singleton
rate_limiter = InMemoryRateLimiter()


async def enforce_rate_limit(
    request: Request,
    scope: str = "default",
    user_id: Optional[Union[str, uuid.UUID]] = None,
) -> None:
    """
    Enforce process-local rate limits for an incoming request.
    Raises HTTPException(429) with Retry-After header if limit is exceeded.
    """
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return

    # Determine identity key: User ID if authenticated, otherwise Client IP
    if user_id:
        identity = f"user:{user_id}"
    else:
        # Fallback to client IP
        client_ip = request.client.host if request.client else "127.0.0.1"
        identity = f"ip:{client_ip}"

    allowed, retry_after, _ = await rate_limiter.check(identity=identity, scope=scope)
    if not allowed:
        logger.warning(
            "Rate limit exceeded for %s on scope %s (Retry-After: %d seconds)",
            identity,
            scope,
            retry_after,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
