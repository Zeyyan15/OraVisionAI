import asyncio
import os
import sys
from sqlalchemy import select

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.session import get_session_factory
from app.models.user import User
from app.api.dentists import list_my_practitioners

async def f():
    factory = get_session_factory()
    async with factory() as db:
        u = (await db.execute(select(User).where(User.id == '68566705-1d26-42fb-93e0-ad23f53e4f6e'))).scalar_one()
        pr = await list_my_practitioners(u, db)
        print('Practitioners for', u.email, ':', [(p.id, p.first_name, p.last_name, p.clinic_name) for p in pr])

if __name__ == '__main__':
    asyncio.run(f())

