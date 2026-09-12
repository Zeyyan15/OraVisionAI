"""
OraVisionAI — Database package.

Re-exports the key database infrastructure components.
"""

from app.db.base import Base
from app.db.session import get_db

__all__ = ["Base", "get_db"]

