"""Read-only check of the backend's configured account database."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from sqlalchemy import select
from app.db.session import get_session_factory, dispose_engine
from app.models.user import User


async def main():
    try:
        async with get_session_factory()() as session:
            account = (await session.execute(select(User).limit(1))).scalars().first()
            if account is None:
                raise RuntimeError("No account records found")
            print("PASS: backend database connected and existing account profile loaded")
    finally:
        await dispose_engine()


asyncio.run(main())
