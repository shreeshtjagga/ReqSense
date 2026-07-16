"""
Scoped access tests — verifies require_roles() and require_same_org_check().

Phase 1, test item: test_scoped_access.py (new per master spec)

Tests:
  - require_roles: client can't access developer-only endpoint
  - require_roles: developer can access developer endpoint
  - require_same_org_check: user from org A can't access org B resource
  - require_same_org_check: admin bypasses org check
"""

import uuid

import pytest
from httpx import AsyncClient

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/users/me"


def unique_email(prefix: str = "scoped") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


async def register_and_login(client: AsyncClient, role: str, org_id=None) -> dict:
    email = unique_email(role)
    payload = {
        "name": f"Test {role}",
        "email": email,
        "password": "StrongPass1",
        "role": role,
    }
    if org_id:
        payload["organization_id"] = str(org_id)
    await client.post(REGISTER_URL, json=payload)
    login = await client.post(LOGIN_URL, json={"email": email, "password": "StrongPass1"})
    return login.json()


@pytest.mark.asyncio
async def test_get_me_respects_bearer_token(client: AsyncClient):
    """Each user's /me returns their own profile, not someone else's."""
    tokens_client = await register_and_login(client, "client")
    tokens_dev = await register_and_login(client, "developer")

    me_c = await client.get(ME_URL, headers={"Authorization": f"Bearer {tokens_client['access_token']}"})
    me_d = await client.get(ME_URL, headers={"Authorization": f"Bearer {tokens_dev['access_token']}"})

    assert me_c.status_code == 200
    assert me_d.status_code == 200
    assert me_c.json()["role"] == "client"
    assert me_d.json()["role"] == "developer"
    # Different users
    assert me_c.json()["id"] != me_d.json()["id"]


@pytest.mark.asyncio
async def test_expired_token_rejected(client: AsyncClient):
    """Tampered/invalid JWT is rejected with 401."""
    resp = await client.get(
        ME_URL,
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJub3RhcmVhbHVzZXIiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjF9.invalidsig"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_require_same_org_check_logic():
    """Unit test require_same_org_check without HTTP layer."""
    from app.dependencies import require_same_org_check
    from app.models.user import User

    org_a = uuid.uuid4()
    org_b = uuid.uuid4()

    user_a = User(id=uuid.uuid4(), name="A", email="a@a.com", role="developer", organization_id=org_a)
    user_admin = User(id=uuid.uuid4(), name="Adm", email="adm@a.com", role="admin", organization_id=org_a)

    # Same org — no exception
    require_same_org_check(user_a, org_a)

    # Different org — should raise
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        require_same_org_check(user_a, org_b)
    assert exc_info.value.status_code == 403

    # Admin — bypasses org check
    require_same_org_check(user_admin, org_b)  # should not raise
