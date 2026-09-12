"""
OraVisionAI — Database Engine & Session Management

Provides lazy-initialized async SQLAlchemy engine, session factory,
and a FastAPI dependency for database sessions.

The engine is created on first use, allowing the application to boot
successfully even when the database is not yet configured.
"""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy singletons — created on first access, not at import time
# ---------------------------------------------------------------------------

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def _to_async_url(url: str) -> str:
    """Convert a standard PostgreSQL URL to an asyncpg-compatible URL.

    ``postgresql://…`` → ``postgresql+asyncpg://…``
    """
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


# ---------------------------------------------------------------------------
# Engine & session factory
# ---------------------------------------------------------------------------

def get_engine() -> AsyncEngine:
    """Return the async SQLAlchemy engine (lazy singleton).

    Raises:
        RuntimeError: If DATABASE_URL is not configured.
    """
    global _engine
    if _engine is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError(
                "DATABASE_URL is not configured. "
                "Set it in the .env file or environment variables."
            )
        async_url = _to_async_url(settings.database_url)
        _engine = create_async_engine(
            async_url,
            echo=settings.debug,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        logger.info("Database engine created")
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the async session factory (lazy singleton)."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session.

    The caller is responsible for committing transactions.
    The session is automatically rolled back on unhandled exceptions
    and closed when the request completes.
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

async def dispose_engine() -> None:
    """Dispose of the database engine (call during shutdown)."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("Database engine disposed")

