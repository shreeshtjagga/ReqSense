"""
Phase 1 Auth test suite.

Tests:
  - Registration (success, duplicate email, weak password)
  - Login (success, wrong password, non-existent user)
  - Account lockout after 5 failed attempts
  - Refresh token rotation
  - Logout (revoke token)
  - GET /me with valid and invalid tokens
  - Error envelope shape on all failure paths
"""

import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────────────────────

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
LOGOUT_URL = "/api/v1/auth/logout"
ME_URL = "/api/v1/users/me"

_user_counter = 0


def unique_email() -> str:
    global _user_counter
    _user_counter += 1
    return f"testuser{_user_counter}@example.com"


def assert_error_envelope(response, expected_code: str) -> dict:
    """Assert the response uses the standard error envelope and return the error dict."""
    data = response.json()
    assert "error" in data, f"Expected error envelope, got: {data}"
    err = data["error"]
    assert "code" in err
    assert "message" in err
    assert "request_id" in err
    assert err["code"] == expected_code, f"Expected code {expected_code!r}, got {err['code']!r}"
    return err


# ── Registration tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "name": "Alice Dev",
        "email": unique_email(),
        "password": "StrongPass1",
        "role": "developer",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "developer"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    email = unique_email()
    payload = {"name": "Bob", "email": email, "password": "StrongPass1", "role": "client"}
    r1 = await client.post(REGISTER_URL, json=payload)
    assert r1.status_code == 201
    r2 = await client.post(REGISTER_URL, json=payload)
    assert r2.status_code == 409
    assert_error_envelope(r2, "CONFLICT")


@pytest.mark.asyncio
async def test_register_weak_password_no_uppercase(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "name": "Weak",
        "email": unique_email(),
        "password": "weakpass1",  # no uppercase
        "role": "client",
    })
    assert resp.status_code == 422
    assert_error_envelope(resp, "VALIDATION_ERROR")


@pytest.mark.asyncio
async def test_register_weak_password_no_digit(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "name": "Weak",
        "email": unique_email(),
        "password": "WeakPassNoDigit",  # no digit
        "role": "client",
    })
    assert resp.status_code == 422
    assert_error_envelope(resp, "VALIDATION_ERROR")


@pytest.mark.asyncio
async def test_register_invalid_role(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json={
        "name": "Invalid",
        "email": unique_email(),
        "password": "StrongPass1",
        "role": "superuser",  # not in enum
    })
    assert resp.status_code == 422


# ── Login tests ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    email = unique_email()
    await client.post(REGISTER_URL, json={
        "name": "Carol", "email": email, "password": "StrongPass1", "role": "client"
    })
    resp = await client.post(LOGIN_URL, json={"email": email, "password": "StrongPass1"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert isinstance(data["expires_in"], int)


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    email = unique_email()
    await client.post(REGISTER_URL, json={
        "name": "Dan", "email": email, "password": "StrongPass1", "role": "client"
    })
    resp = await client.post(LOGIN_URL, json={"email": email, "password": "WrongPass1"})
    assert resp.status_code == 401
    assert_error_envelope(resp, "UNAUTHORIZED")


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post(LOGIN_URL, json={
        "email": "nobody@example.com", "password": "StrongPass1"
    })
    assert resp.status_code == 401
    # Same message as wrong password — user enumeration prevention
    err = assert_error_envelope(resp, "UNAUTHORIZED")
    assert "Invalid email or password" in err["message"]


# ── Account lockout test ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_account_lockout_after_5_failures(client: AsyncClient):
    email = unique_email()
    await client.post(REGISTER_URL, json={
        "name": "Eve", "email": email, "password": "StrongPass1", "role": "client"
    })
    # 5 wrong attempts
    for i in range(5):
        r = await client.post(LOGIN_URL, json={"email": email, "password": f"WrongPass{i}"})
        assert r.status_code == 401

    # 6th attempt — should be locked
    locked = await client.post(LOGIN_URL, json={"email": email, "password": "WrongPass6"})
    assert locked.status_code == 401
    err = assert_error_envelope(locked, "UNAUTHORIZED")
    assert "locked" in err["message"].lower()


# ── Refresh token tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_rotates_token(client: AsyncClient):
    email = unique_email()
    await client.post(REGISTER_URL, json={
        "name": "Frank", "email": email, "password": "StrongPass1", "role": "developer"
    })
    login = await client.post(LOGIN_URL, json={"email": email, "password": "StrongPass1"})
    tokens = login.json()

    refresh = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 200
    new_tokens = refresh.json()

    # New tokens issued
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    # Old refresh token should be invalidated
    second_refresh = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})
    assert second_refresh.status_code == 401


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    resp = await client.post(REFRESH_URL, json={"refresh_token": "not_a_real_token"})
    assert resp.status_code == 401
    assert_error_envelope(resp, "UNAUTHORIZED")


# ── Logout tests ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout_revokes_token(client: AsyncClient):
    email = unique_email()
    await client.post(REGISTER_URL, json={
        "name": "Grace", "email": email, "password": "StrongPass1", "role": "client"
    })
    login = await client.post(LOGIN_URL, json={"email": email, "password": "StrongPass1"})
    tokens = login.json()

    logout = await client.post(LOGOUT_URL, json={"refresh_token": tokens["refresh_token"]})
    assert logout.status_code == 204

    # Revoked token should no longer work
    refresh_after = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})
    assert refresh_after.status_code == 401


# ── GET /me tests ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_me_success(client: AsyncClient):
    email = unique_email()
    await client.post(REGISTER_URL, json={
        "name": "Hank", "email": email, "password": "StrongPass1", "role": "admin"
    })
    login = await client.post(LOGIN_URL, json={"email": email, "password": "StrongPass1"})
    access = login.json()["access_token"]

    me = await client.get(ME_URL, headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    data = me.json()
    assert data["email"] == email
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_get_me_no_token(client: AsyncClient):
    resp = await client.get(ME_URL)
    assert resp.status_code == 401
    assert_error_envelope(resp, "UNAUTHORIZED")


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    resp = await client.get(ME_URL, headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401
    assert_error_envelope(resp, "UNAUTHORIZED")


# ── Error envelope shape ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_404_uses_error_envelope(client: AsyncClient):
    resp = await client.get("/api/v1/nonexistent-endpoint-xyz")
    assert resp.status_code == 404
    assert_error_envelope(resp, "NOT_FOUND")


@pytest.mark.asyncio
async def test_request_id_header_present(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert "x-request-id" in resp.headers
