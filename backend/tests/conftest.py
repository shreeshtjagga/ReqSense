"""
Pytest configuration for the async FastAPI test suite.

Uses pytest-asyncio (asyncio_mode=auto) with an in-memory SQLite database
so tests run without a real Postgres/Redis/Groq/etc. instance.

KEY: Required Settings fields are injected via os.environ BEFORE any app
module is imported. Settings() is called at import time (via database.py),
so the env vars must exist first or it throws a ValidationError.

CHROMA_MODE is set to 'local' to skip the hosted-credential cross-field
validator. The actual Chroma/Redis/Groq connections are never exercised
in Phase 1 tests.
"""

import asyncio
import os

# ── Inject test env vars BEFORE importing any app module ─────────────────────
# These must satisfy Settings() validation. Values don't need to be real
# since the test DB override means these connections are never opened.
_TEST_ENV = {
    "DATABASE_URL": "postgresql+asyncpg://u:p@localhost/reqsense_test",
    "REDIS_URL": "redis://localhost:6379",
    "CELERY_BROKER_URL": "redis://localhost:6379/1",
    "CELERY_RESULT_BACKEND": "redis://localhost:6379/2",
    "SECRET_KEY": "test-secret-key-min-32-chars-for-pytest-suite!!",
    "GROQ_API_KEY": "test-groq-key",
    "SENDGRID_API_KEY": "test-sendgrid-key",
    "FROM_EMAIL": "test@example.com",
    "S3_BUCKET_NAME": "test-bucket",
    "S3_ACCESS_KEY_ID": "test-key-id",
    "S3_SECRET_ACCESS_KEY": "test-secret",
    # Use local mode so the hosted-credential validator is skipped
    "CHROMA_MODE": "local",
    "CHROMA_PERSIST_DIRECTORY": "/tmp/chroma_test",
    "SENTRY_DSN": "",   # blank = Sentry disabled
    "ENV": "development",
}
for key, val in _TEST_ENV.items():
    os.environ.setdefault(key, val)

# ── App imports (after env vars are set) ─────────────────────────────────────
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

# ── In-memory SQLite engine ───────────────────────────────────────────────────
# aiosqlite is required: pip install aiosqlite  (or requirements-test.txt)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """
    Provide a single event loop for the entire test session.
    Required so session-scoped async fixtures share one loop.
    Suppresses the pytest-asyncio deprecation warning for scope mismatch.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """Create all tables once per test session, drop at teardown."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client with the real DB dependency replaced by SQLite."""
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
