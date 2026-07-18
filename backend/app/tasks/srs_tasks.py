import logging
import uuid
import app.database as _app_database
from app.services.srs_generator import SRSGenerator
from app.tasks.celery_app import celery_app
from app.tasks.email_tasks import run_sync

logger = logging.getLogger(__name__)

async def _async_generate_srs(session_id: uuid.UUID) -> None:
    async with _app_database.AsyncSessionLocal() as db:
        await SRSGenerator.generate_srs(session_id, db)

@celery_app.task(name="app.tasks.srs_tasks.generate_srs_task")
def generate_srs_task(session_id_str: str) -> None:
    """
    Celery background task to generate SRS document for finished session.
    """
    logger.info(f"Celery task generate_srs_task started for session: {session_id_str}")
    try:
        session_id = uuid.UUID(session_id_str)
        run_sync(_async_generate_srs(session_id))
        logger.info(f"Celery task generate_srs_task completed successfully for session: {session_id_str}")
    except Exception as e:
        logger.error(f"Celery task generate_srs_task failed for session {session_id_str}: {e}")
        raise e
