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

# ── Override AsyncSessionLocal globally for tests ─────────────────────────────
import app.database as app_database
app_database.AsyncSessionLocal = TestSessionLocal




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


@pytest_asyncio.fixture(autouse=True)
async def clean_database():
    """Resets database state by deleting all rows from all tables before each test."""
    async with TestSessionLocal() as session:
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()



@pytest_asyncio.fixture()
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """Provides a transactional db session wrapper for raw DB inserts in tests."""
    async with TestSessionLocal() as session:
        yield session
        await session.commit()


@pytest_asyncio.fixture()
async def org_a(test_db: AsyncSession):
    from app.models.organization import Organization
    org = Organization(name="Organization A")
    test_db.add(org)
    await test_db.flush()
    return org


@pytest_asyncio.fixture()
async def org_b(test_db: AsyncSession):
    from app.models.organization import Organization
    org = Organization(name="Organization B")
    test_db.add(org)
    await test_db.flush()
    return org


@pytest_asyncio.fixture()
async def admin_a(test_db: AsyncSession, org_a):
    from app.models.user import User
    from app.services.auth_service import hash_password
    user = User(
        name="Admin A",
        email="admin_a@a.com",
        password_hash=hash_password("Pass1234"),
        role="admin",
        organization_id=org_a.id,
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    return user


@pytest_asyncio.fixture()
async def dev_a(test_db: AsyncSession, org_a):
    from app.models.user import User
    from app.services.auth_service import hash_password
    user = User(
        name="Developer A",
        email="dev_a@a.com",
        password_hash=hash_password("Pass1234"),
        role="developer",
        organization_id=org_a.id,
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    return user


@pytest_asyncio.fixture()
async def dev_b(test_db: AsyncSession, org_b):
    from app.models.user import User
    from app.services.auth_service import hash_password
    user = User(
        name="Developer B",
        email="dev_b@b.com",
        password_hash=hash_password("Pass1234"),
        role="developer",
        organization_id=org_b.id,
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    return user


@pytest_asyncio.fixture()
async def client_a(test_db: AsyncSession, org_a):
    from app.models.user import User
    from app.services.auth_service import hash_password
    user = User(
        name="Client A",
        email="client_a@a.com",
        password_hash=hash_password("Pass1234"),
        role="client",
        organization_id=org_a.id,
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    return user


@pytest_asyncio.fixture()
async def client_b(test_db: AsyncSession, org_b):
    from app.models.user import User
    from app.services.auth_service import hash_password
    user = User(
        name="Client B",
        email="client_b@b.com",
        password_hash=hash_password("Pass1234"),
        role="client",
        organization_id=org_b.id,
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    return user


@pytest_asyncio.fixture()
async def project_a(test_db: AsyncSession, org_a, dev_a):
    from app.models.project import Project
    proj = Project(
        name="Project A",
        description="Test Project A",
        domain="web_app",
        organization_id=org_a.id,
        developer_id=dev_a.id,
        status="active",
    )
    test_db.add(proj)
    await test_db.flush()
    return proj


@pytest_asyncio.fixture()
async def session_a(test_db: AsyncSession, project_a, client_a):
    from app.models.session import Session
    sess = Session(
        project_id=project_a.id,
        client_id=client_a.id,
        status="active",
    )
    test_db.add(sess)
    await test_db.flush()
    return sess

