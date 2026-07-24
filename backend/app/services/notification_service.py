"""
notification_service.py — Thin wrapper that enqueues email Celery tasks.

All email sending goes through Celery (never inline in a request).
This service provides named helpers so routers don't import email_tasks directly.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)





def send_password_reset_email(to_email: str, token: str, reset_url: str) -> None:
    """Enqueue a password-reset email."""
    from app.tasks.email_tasks import send_email_task

    send_email_task.delay(
        to_email=to_email,
        template="password_reset",
        context={"token": token, "reset_url": reset_url},
    )
    logger.info("Queued password_reset to %s", to_email)


def send_project_invite_email(
    to_email: str, project_name: str, invite_url: str
) -> None:
    """Enqueue a project-invite email."""
    from app.tasks.email_tasks import send_email_task

    send_email_task.delay(
        to_email=to_email,
        template="invite",
        context={"project_name": project_name, "invite_url": invite_url},
    )
    logger.info("Queued invite to %s for project '%s'", to_email, project_name)


def send_session_summary_email(
    to_email: str, context: Dict[str, Any]
) -> None:
    """Enqueue a session-summary email (sent after SRS is generated)."""
    from app.tasks.email_tasks import send_email_task

    send_email_task.delay(
        to_email=to_email,
        template="session_summary",
        context=context,
    )
    logger.info("Queued session_summary to %s", to_email)
