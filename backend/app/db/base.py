"""
OraVisionAI — SQLAlchemy Declarative Base

All domain models will inherit from this Base class.
Do NOT define domain models in this file.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all OraVisionAI database models."""

    pass

