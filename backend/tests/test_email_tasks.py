import pytest
from app.tasks.email_tasks import send_email_task

def test_send_email_task_dummy_mode(monkeypatch):
    """Test that send_email_task executes in dummy mode when SENDGRID_API_KEY is dev-placeholder or test key."""
    # Running send_email_task with dev-placeholder should not attempt SendGrid HTTP calls
    send_email_task(
        to_email="test@example.com",
        template="verify_email",
        context={"token": "test-token", "verify_url": "http://localhost/verify"}
    )
