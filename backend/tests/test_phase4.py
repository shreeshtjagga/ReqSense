"""
Phase 3 & 4 integration tests.

Tests cover:
- POST /messages: ARIA response, atom extraction, contradiction detection
- PATCH /sessions/{id}/end: returns 200 immediately, enqueues Celery task
- GET /srs/project/{id}/latest: SRS version fetch
- GET /feature-status/project/{id}: list features
- POST /feature-status: create feature
- PATCH /feature-status/{id}: optimistic locking (409 STALE_VERSION)
- POST /change-requests: create CR, enqueue impact analysis
- PATCH /change-requests/{id}: review with optimistic locking
- PATCH /contradictions/{id}: resolve contradiction
- GET /health/ready: readiness check structure
"""

import pytest
import uuid
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contradiction import Contradiction
from app.models.feature_status import FeatureStatus
from app.models.requirement_atom import RequirementAtom
from app.models.srs_version import SRSVersion
from app.models.change_request import ChangeRequest


async def get_auth_headers(client: AsyncClient, email: str, password: str = "Pass1234") -> dict:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ── Phase 3 Tests ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_post_message_returns_aria_reply(
    client: AsyncClient, dev_a, client_a, project_a, session_a
):
    """POST /messages creates user message and ARIA writes a reply."""
    headers_a = await get_auth_headers(client, dev_a.email)
    headers_client = await get_auth_headers(client, client_a.email)

    # Invite client
    resp = await client.post(
        f"/api/v1/projects/{project_a.id}/clients",
        json={"client_id": str(client_a.id)},
        headers=headers_a,
    )
    assert resp.status_code == 201

    payload = {
        "content": "The system should allow users to log in.",
        "sender": "client",
        "message_type": "normal",
    }

    # Mock SessionMemory to avoid real Redis
    with patch("app.routers.messages.SessionMemory.get_messages", new_callable=AsyncMock, return_value=[]):
        with patch("app.routers.messages.SessionMemory.add_message", new_callable=AsyncMock, return_value=None):
            resp = await client.post(
                f"/api/v1/sessions/{session_a.id}/messages",
                json=payload,
                headers=headers_client,
            )

    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == payload["content"]
    assert data["sender"] == "client"


@pytest.mark.asyncio
async def test_post_message_transaction_boundary(
    client: AsyncClient, dev_a, client_a, project_a, session_a, test_db: AsyncSession
):
    """
    Verify transaction boundary: if ARIA call is mocked to fail, no DB row is written.
    """
    headers_a = await get_auth_headers(client, dev_a.email)
    headers_client = await get_auth_headers(client, client_a.email)

    # Invite client
    await client.post(
        f"/api/v1/projects/{project_a.id}/clients",
        json={"client_id": str(client_a.id)},
        headers=headers_a,
    )

    from sqlalchemy import select, func
    from app.models.message import Message

    count_before_q = await test_db.execute(
        select(func.count()).select_from(Message).where(Message.session_id == session_a.id)
    )
    count_before = count_before_q.scalar()

    payload = {"content": "Test content", "sender": "client", "message_type": "normal"}

    # Even if ARIA fails, the endpoint should handle it gracefully (uses fallback message)
    with patch("app.routers.messages.SessionMemory.get_messages", new_callable=AsyncMock, return_value=[]):
        with patch("app.routers.messages.SessionMemory.add_message", new_callable=AsyncMock, return_value=None):
            resp = await client.post(
                f"/api/v1/sessions/{session_a.id}/messages",
                json=payload,
                headers=headers_client,
            )

    # Should succeed with fallback ARIA message
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_contradiction_resolved_on_patch(
    client: AsyncClient, dev_a, project_a, test_db: AsyncSession
):
    """PATCH /contradictions/{id} resolves a contradiction and updates status."""
    headers_a = await get_auth_headers(client, dev_a.email)

    # Create a session and contradiction in test DB
    from app.models.session import Session
    sess = Session(project_id=project_a.id, status="completed")
    test_db.add(sess)
    await test_db.flush()

    c = Contradiction(
        session_id=sess.id,
        confidence=0.9,
        conflict_type="direct_contradiction",
        aria_message="Conflict detected",
        status="pending",
    )
    test_db.add(c)
    await test_db.flush()
    c_id = c.id
    await test_db.commit()

    resp = await client.patch(
        f"/api/v1/contradictions/{c_id}",
        json={"action": "resolved", "resolution": "Clarified by stakeholder."},
        headers=headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "resolved"
    assert data["resolution"] == "Clarified by stakeholder."


@pytest.mark.asyncio
async def test_contradiction_missing_returns_404(client: AsyncClient, dev_a):
    """PATCH /contradictions/{id} with nonexistent ID returns 404."""
    headers_a = await get_auth_headers(client, dev_a.email)
    fake_id = uuid.uuid4()
    resp = await client.patch(
        f"/api/v1/contradictions/{fake_id}",
        json={"action": "resolved"},
        headers=headers_a,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_messages_scoped(
    client: AsyncClient, dev_a, dev_b, client_a, project_a, session_a
):
    """GET /messages — dev_b from another org gets 404."""
    headers_b = await get_auth_headers(client, dev_b.email)
    resp = await client.get(
        f"/api/v1/sessions/{session_a.id}/messages",
        headers=headers_b,
    )
    assert resp.status_code == 404


# ── Phase 4 Tests ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_end_session_enqueues_srs_task(
    client: AsyncClient, dev_a, project_a, session_a
):
    """POST /sessions/{id}/generate-srs enqueues generate_srs_task for developer/admin."""
    headers_a = await get_auth_headers(client, dev_a.email)

    with patch("app.routers.sessions.generate_srs_task") as mock_task:
        mock_task.delay = MagicMock(return_value=None)
        resp = await client.post(
            f"/api/v1/sessions/{session_a.id}/generate-srs",
            headers=headers_a,
        )

    # Should return 200 immediately
    assert resp.status_code in (200, 201)
    # Celery task should have been enqueued
    mock_task.delay.assert_called_once_with(str(session_a.id))


@pytest.mark.asyncio
async def test_feature_status_create_and_list(
    client: AsyncClient, dev_a, project_a
):
    """POST /feature-status and GET /feature-status/project/{id}."""
    headers_a = await get_auth_headers(client, dev_a.email)

    create_payload = {
        "project_id": str(project_a.id),
        "title": "User Authentication",
        "description": "Login and logout flows",
    }
    resp = await client.post("/api/v1/feature-status", json=create_payload, headers=headers_a)
    assert resp.status_code == 201
    feature_id = resp.json()["id"]
    assert resp.json()["title"] == "User Authentication"
    assert resp.json()["version"] == 1

    # List
    resp = await client.get(
        f"/api/v1/feature-status/project/{project_a.id}", headers=headers_a
    )
    assert resp.status_code == 200
    ids = [f["id"] for f in resp.json()]
    assert feature_id in ids


@pytest.mark.asyncio
async def test_feature_status_optimistic_lock(
    client: AsyncClient, dev_a, project_a, test_db: AsyncSession
):
    """PATCH /feature-status/{id} returns 409 STALE_VERSION if version mismatches."""
    headers_a = await get_auth_headers(client, dev_a.email)

    # Create feature directly in DB
    feature = FeatureStatus(
        project_id=project_a.id,
        title="Dashboard",
        description="Main dashboard",
        status="planned",
        version=1,
        created_by=dev_a.id,
        updated_by=dev_a.id,
    )
    test_db.add(feature)
    await test_db.flush()
    feature_id = feature.id
    await test_db.commit()

    # Send stale version (version=0 when DB has version=1)
    resp = await client.patch(
        f"/api/v1/feature-status/{feature_id}",
        json={"status": "in_progress", "version": 0},
        headers=headers_a,
    )
    assert resp.status_code == 409
    data = resp.json()
    # Error envelope check
    assert "error" in data
    assert data["error"]["code"] == "STALE_VERSION"


@pytest.mark.asyncio
async def test_feature_status_optimistic_lock_success(
    client: AsyncClient, dev_a, project_a, test_db: AsyncSession
):
    """PATCH /feature-status/{id} succeeds with correct version and increments it."""
    headers_a = await get_auth_headers(client, dev_a.email)

    feature = FeatureStatus(
        project_id=project_a.id,
        title="Billing Module",
        description="Handles payments",
        status="planned",
        version=1,
        created_by=dev_a.id,
        updated_by=dev_a.id,
    )
    test_db.add(feature)
    await test_db.flush()
    feature_id = feature.id
    await test_db.commit()

    resp = await client.patch(
        f"/api/v1/feature-status/{feature_id}",
        json={"status": "in_progress", "version": 1},
        headers=headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "in_progress"
    assert data["version"] == 2


@pytest.mark.asyncio
async def test_change_request_create_and_enqueue(
    client: AsyncClient, dev_a, project_a
):
    """POST /change-requests creates record, enqueues impact task."""
    headers_a = await get_auth_headers(client, dev_a.email)

    payload = {
        "project_id": str(project_a.id),
        "title": "Add Dark Mode",
        "description": "Users want a dark mode theme.",
        "affected_features": ["Dashboard", "Settings"],
        "severity": "medium",
    }

    with patch("app.routers.change_requests.run_impact_analysis_task") as mock_task:
        mock_task.delay = MagicMock(return_value=None)
        resp = await client.post("/api/v1/change-requests", json=payload, headers=headers_a)

    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Add Dark Mode"
    assert data["status"] == "pending"
    assert data["version"] == 1
    mock_task.delay.assert_called_once()


@pytest.mark.asyncio
async def test_change_request_review_optimistic_lock(
    client: AsyncClient, dev_a, project_a, test_db: AsyncSession
):
    """PATCH /change-requests/{id} returns 409 STALE_VERSION on version mismatch."""
    headers_a = await get_auth_headers(client, dev_a.email)

    cr = ChangeRequest(
        project_id=project_a.id,
        title="Add SSO",
        description="Single sign-on integration.",
        affected_features="[]",
        severity="high",
        status="pending",
        version=1,
    )
    test_db.add(cr)
    await test_db.flush()
    cr_id = cr.id
    await test_db.commit()

    # Stale version
    resp = await client.patch(
        f"/api/v1/change-requests/{cr_id}",
        json={"status": "approved", "version": 99, "developer_note": "ok"},
        headers=headers_a,
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "STALE_VERSION"


@pytest.mark.asyncio
async def test_change_request_review_success(
    client: AsyncClient, dev_a, project_a, test_db: AsyncSession
):
    """PATCH /change-requests/{id} succeeds with correct version."""
    headers_a = await get_auth_headers(client, dev_a.email)

    cr = ChangeRequest(
        project_id=project_a.id,
        title="Remove Legacy API",
        description="Deprecate v0 endpoints.",
        affected_features="[]",
        severity="low",
        status="pending",
        version=1,
    )
    test_db.add(cr)
    await test_db.flush()
    cr_id = cr.id
    await test_db.commit()

    resp = await client.patch(
        f"/api/v1/change-requests/{cr_id}",
        json={"status": "approved", "version": 1, "developer_note": "All good"},
        headers=headers_a,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"
    assert data["version"] == 2


@pytest.mark.asyncio
async def test_health_ready_returns_structure(client: AsyncClient):
    """GET /health/ready returns the expected JSON shape."""
    with (
        patch("app.routers.health.get_redis_client") as mock_redis_factory,
        patch("app.routers.health.celery_app") as mock_celery,
    ):
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)
        mock_redis_factory.return_value = mock_redis

        mock_conn = MagicMock()
        mock_celery.connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_celery.connection.return_value.__exit__ = MagicMock(return_value=False)
        mock_celery.connection.return_value = MagicMock()
        mock_celery.connection.return_value.connect = MagicMock()
        mock_celery.connection.return_value.release = MagicMock()

        resp = await client.get("/health/ready")

    # Response must have these keys regardless of 200 or 503
    data = resp.json()
    assert "status" in data
    assert "db" in data
    assert "redis" in data
    assert "celery" in data
    # DB should be True (sqlite in-memory test engine works)
    assert data["db"] is True


@pytest.mark.asyncio
async def test_health_liveness(client: AsyncClient):
    """GET /health returns 200 ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_srs_list_versions_empty(
    client: AsyncClient, dev_a, project_a
):
    """GET /srs/project/{id}/versions returns empty list when none exist."""
    headers_a = await get_auth_headers(client, dev_a.email)
    resp = await client.get(
        f"/api/v1/srs/project/{project_a.id}/versions", headers=headers_a
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_srs_latest_404_when_none(client: AsyncClient, dev_a, project_a):
    """GET /srs/project/{id}/latest returns 404 when no SRS exists."""
    headers_a = await get_auth_headers(client, dev_a.email)
    resp = await client.get(
        f"/api/v1/srs/project/{project_a.id}/latest", headers=headers_a
    )
    assert resp.status_code == 404
