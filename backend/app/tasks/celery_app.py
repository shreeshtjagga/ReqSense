"""
Celery app configuration.
"""

from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "reqsense",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Autodiscover tasks from the app.tasks package
celery_app.conf.update(
    imports=[
        "app.tasks.email_tasks",
        "app.tasks.srs_tasks",
        "app.tasks.impact_tasks",
    ]
)
celery_app.autodiscover_tasks(["app.tasks"])

