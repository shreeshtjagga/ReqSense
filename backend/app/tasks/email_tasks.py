import asyncio
import logging
import threading
from typing import Dict, Any

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.email_log import EmailLog
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)
settings = get_settings()


def run_sync(coro):
    """Run an async coroutine synchronously. Safe to call from a running event loop (e.g. in tests)."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Event loop is running (e.g. in pytest-asyncio). Run in a separate thread.
        result = [None]
        exception = [None]

        def target():
            try:
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                result[0] = new_loop.run_until_complete(coro)
            except Exception as e:
                exception[0] = e
            finally:
                new_loop.close()

        thread = threading.Thread(target=target)
        thread.start()
        thread.join()
        if exception[0]:
            raise exception[0]
        return result[0]
    else:
        return asyncio.run(coro)


async def _save_email_log(to_email: str, template: str, status: str, error_message: str = None) -> None:
    """Save an email log entry to the database."""
    async with AsyncSessionLocal() as db:
        log_entry = EmailLog(
            to_email=to_email,
            template=template,
            status=status,
            error_message=error_message
        )
        db.add(log_entry)
        await db.commit()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
def _send_via_sendgrid(to_email: str, subject: str, content: str) -> None:
    """Sends the email using SendGrid API with retry backoff."""
    message = Mail(
        from_email=settings.FROM_EMAIL,
        to_emails=to_email,
        subject=subject,
        plain_text_content=content
    )
    sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
    sg.send(message)


@celery_app.task(name="app.tasks.email_tasks.send_email_task")
def send_email_task(to_email: str, template: str, context: Dict[str, Any]) -> None:
    """
    Background task to send email using SendGrid.
    """
    subject = "Notification from ReqSense"
    body = ""

    if template == "invite":
        project_name = context.get("project_name", "Unknown Project")
        invite_url = context.get("invite_url", "")
        subject = f"You have been invited to project {project_name}"
        body = f"Hello! You have been added to the project '{project_name}'. Click here to view it: {invite_url}"

    elif template == "password_reset":
        token = context.get("token", "")
        reset_url = context.get("reset_url", "")
        subject = "Password Reset Request"
        body = f"Please use the following token to reset your password: {token}\nOr click this link: {reset_url}"

    elif template == "verify_email":
        token = context.get("token", "")
        verify_url = context.get("verify_url", "")
        subject = "Verify Your Email Address"
        body = f"Please use this token to verify your email address: {token}\nOr click this link: {verify_url}"

    else:
        body = f"Notification content context: {context}"

    # Check if we are running in test / dummy mode
    is_dummy_key = (
        not settings.SENDGRID_API_KEY or
        settings.SENDGRID_API_KEY.startswith("test") or
        settings.SENDGRID_API_KEY.startswith("mock")
    )

    if is_dummy_key:
        logger.info(
            f"[DUMMY EMAIL] To: {to_email} | Template: {template} | Subject: {subject} | Body: {body}"
        )
        # Log to email_logs database table
        run_sync(_save_email_log(to_email, template, "sent"))
        return

    try:
        _send_via_sendgrid(to_email, subject, body)
        run_sync(_save_email_log(to_email, template, "sent"))
    except Exception as e:
        logger.error(f"Failed to send email via SendGrid: {str(e)}")
        run_sync(_save_email_log(to_email, template, "failed", str(e)))
        raise e
