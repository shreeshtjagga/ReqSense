import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.email_log import EmailLog
from app.services.auth_service import create_email_verification_token
from app.tasks.celery_app import celery_app

# Enable eager execution of Celery tasks during tests
celery_app.conf.task_always_eager = True


async def get_auth_headers(client: AsyncClient, email: str, password: str = "Pass1234") -> dict:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_email_verification_flow(client: AsyncClient, test_db):
    """
    Test registering a user trigger a verify_email task,
    and then consuming the token to verify the email.
    """
    # 1. Register a user
    email = "verify_test@example.com"
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Verify User",
            "email": email,
            "password": "VerifyPassword1",
            "role": "client"
        }
    )
    assert resp.status_code == 201
    user_id = uuid.UUID(resp.json()["id"])

    # 2. Check that email verification email log entry is created
    result = await test_db.execute(
        select(EmailLog).where(EmailLog.to_email == email, EmailLog.template == "verify_email")
    )
    log = result.scalars().first()
    assert log is not None
    assert log.status == "sent"

    # 3. Check that the user has email_verified = False initially
    user_res = await test_db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one()
    assert user.email_verified is False

    # 4. Generate email verification token (simulating what gets sent in email)
    token = create_email_verification_token(user_id)

    # 5. Consume token
    resp_verify = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert resp_verify.status_code == 200
    assert resp_verify.json()["message"] == "Email verification successful."

    # 6. Check that the user is now verified
    await test_db.refresh(user)
    assert user.email_verified is True


@pytest.mark.asyncio
async def test_forgot_reset_password_revokes_refresh_tokens(client: AsyncClient, test_db):
    """
    Test forgot-password / reset-password round trip:
    - User logs in, gets a refresh token.
    - User initiates password reset.
    - Password reset email is logged to email_logs.
    - Completing password reset updates the password.
    - Old refresh tokens stop working.
    """
    # 1. Register and login to generate a refresh token
    email = "reset_test@example.com"
    password = "OldPassword1"
    new_password = "NewPassword1"

    await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Reset User",
            "email": email,
            "password": password,
            "role": "client"
        }
    )

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200
    old_refresh_token = login_resp.json()["refresh_token"]

    # 2. Call forgot password
    forgot_resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": email}
    )
    assert forgot_resp.status_code == 200
    assert "reset link has been sent" in forgot_resp.json()["message"]

    # 3. Verify that the email log entry exists
    log_res = await test_db.execute(
        select(EmailLog).where(EmailLog.to_email == email, EmailLog.template == "password_reset")
    )
    log = log_res.scalars().first()
    assert log is not None
    assert log.status == "sent"

    # Get the reset token from database since SendGrid is dummy/mocked
    from app.models.password_reset_token import PasswordResetToken
    token_res = await test_db.execute(
        select(PasswordResetToken).order_by(PasswordResetToken.created_at.desc())
    )
    reset_token_record = token_res.scalars().first()
    assert reset_token_record is not None
    reset_token = reset_token_record.token

    # 4. Reset the password
    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": new_password}
    )
    assert reset_resp.status_code == 200
    assert "Password reset successful" in reset_resp.json()["message"]

    # 5. Verify old refresh token is revoked and fails
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token}
    )
    assert refresh_resp.status_code == 401
    from tests.test_auth import assert_error_envelope
    assert_error_envelope(refresh_resp, "UNAUTHORIZED")

    # 6. Verify login works with new password but not old password
    bad_login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    assert bad_login.status_code == 401

    good_login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": new_password}
    )
    assert good_login.status_code == 200


@pytest.mark.asyncio
async def test_project_invite_email(client: AsyncClient, test_db, dev_a, client_a, project_a):
    """
    Test adding a client to a project triggers project invite email logged to email_logs.
    """
    headers_a = await get_auth_headers(client, dev_a.email)

    # Add client to project
    resp = await client.post(
        f"/api/v1/projects/{project_a.id}/clients",
        json={"client_id": str(client_a.id)},
        headers=headers_a
    )
    assert resp.status_code == 201

    # Verify that invite email log exists for the client's email
    log_res = await test_db.execute(
        select(EmailLog).where(EmailLog.to_email == client_a.email, EmailLog.template == "invite")
    )
    log = log_res.scalars().first()
    assert log is not None
    assert log.status == "sent"
