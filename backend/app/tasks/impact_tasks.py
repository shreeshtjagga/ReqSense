import json
import logging
import uuid
import app.database as _app_database
from app.models.change_request import ChangeRequest
from app.services.impact_analyser import ImpactAnalyser
from app.tasks.celery_app import celery_app
from app.tasks.email_tasks import run_sync

logger = logging.getLogger(__name__)

async def _async_run_impact_analysis(change_request_id: uuid.UUID) -> None:
    async with _app_database.AsyncSessionLocal() as db:
        # Load the change request
        cr = await db.get(ChangeRequest, change_request_id)
        if not cr:
            logger.error(f"ChangeRequest {change_request_id} not found.")
            return

        logger.info(f"Running impact analysis for change request {cr.id} in project {cr.project_id}")
        
        # Analyze impact
        analysis_result = await ImpactAnalyser.analyze_impact(
            title=cr.title,
            description=cr.description,
            project_id=cr.project_id,
            db=db
        )

        # Update fields
        cr.severity = analysis_result.get("severity", "low")
        cr.impact_report = analysis_result.get("impact_report", "")
        # Serialize list of titles to JSON string
        cr.affected_features = json.dumps(analysis_result.get("affected_features", []))
        
        db.add(cr)
        await db.commit()
        logger.info(f"ChangeRequest {cr.id} successfully updated with impact analysis.")

@celery_app.task(name="app.tasks.impact_tasks.run_impact_analysis_task")
def run_impact_analysis_task(change_request_id_str: str) -> None:
    """
    Celery background task to analyze the impact of a change request.
    """
    logger.info(f"Celery task run_impact_analysis_task started for change request: {change_request_id_str}")
    try:
        change_request_id = uuid.UUID(change_request_id_str)
        run_sync(_async_run_impact_analysis(change_request_id))
        logger.info(f"Celery task run_impact_analysis_task completed successfully for change request: {change_request_id_str}")
    except Exception as e:
        logger.error(f"Celery task run_impact_analysis_task failed for change request {change_request_id_str}: {e}")
        raise e
