"""
local_db_init.py — Initialize local SQLite database.

Bypasses the PostgreSQL-specific Alembic migrations and creates all tables
directly from the ORM models using SQLAlchemy's create_all(). Then stamps
the Alembic version table so future migrations can run normally.

Usage:
    cd backend
    python local_db_init.py
"""
import asyncio
import sys
import subprocess
from pathlib import Path

# Make sure 'app' module is importable
sys.path.insert(0, str(Path(__file__).parent))

from app.config import get_settings

settings = get_settings()

if not settings.is_sqlite:
    print("ERROR: This script is only for SQLite (local dev) mode.")
    print(f"Current DATABASE_URL: {settings.DATABASE_URL}")
    sys.exit(1)

print(f"Initializing local SQLite database: {settings.DATABASE_URL}")


async def init_db():
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import StaticPool

    # Import all models so Base.metadata knows about them
    from app.database import Base
    import app.models  # noqa: registers all mappers

    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=True,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("\n[OK] All tables created successfully.")

    await engine.dispose()


asyncio.run(init_db())

# Stamp the Alembic version to the head so alembic upgrade head is a no-op
print("\nStamping Alembic revision to 'head'...")
result = subprocess.run(
    ["python", "-m", "alembic", "stamp", "head"],
    capture_output=True,
    text=True,
    cwd=str(Path(__file__).parent),
)
if result.returncode == 0:
    print("[OK] Alembic version stamped to head.")
else:
    print(f"⚠ Alembic stamp warning (non-fatal): {result.stderr.strip()}")

print("\n[DONE] Local SQLite database is ready. Start the server with:")
print("   uvicorn app.main:app --reload --port 8000")
