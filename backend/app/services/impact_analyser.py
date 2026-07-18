import json
import logging
import uuid
from typing import Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.feature_status import FeatureStatus
from app.services.aria_agent import get_groq_client
from app.utils.prompts import IMPACT_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)
settings = get_settings()

class ImpactAnalyser:
    @classmethod
    async def analyze_impact(
        cls,
        title: str,
        description: str,
        project_id: uuid.UUID,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Analyzes the impact of a change request on existing project features.
        Returns a dict: {"affected_features": [...], "severity": ..., "impact_report": ...}
        """
        # Fetch active feature statuses for this project
        q = select(FeatureStatus).where(FeatureStatus.project_id == project_id)
        result = await db.execute(q)
        features = result.scalars().all()

        if not features:
            logger.info(f"No features found for project {project_id} to perform impact analysis.")
            return {
                "affected_features": [],
                "severity": "low",
                "impact_report": "No features are currently tracked for this project. Impact is minimal."
            }

        # Build list for the prompt
        features_list = "\n".join([
            f"- Title: {f.title}\n  Description: {f.description or 'No description'}"
            for f in features
        ])

        # Mock behavior for testing
        if settings.GROQ_API_KEY.startswith("test") or settings.GROQ_API_KEY.startswith("mock"):
            logger.info("[MOCK IMPACT] Generating mock impact report")
            # If description contains 'customer', impact customer-facing features
            affected = []
            severity = "low"
            if len(features) > 0:
                affected.append(features[0].title)
            if "remove" in description.lower() or "critical" in description.lower():
                severity = "high"
            return {
                "affected_features": affected,
                "severity": severity,
                "impact_report": f"Mock impact report: Changing '{title}' might affect features: {', '.join(affected)}."
            }

        prompt = IMPACT_ANALYSIS_PROMPT.format(
            title=title,
            description=description,
            features_list=features_list
        )

        client = get_groq_client()
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                timeout=settings.GROQ_TIMEOUT_SECONDS
            )
            raw_response = response.choices[0].message.content.strip()

            if raw_response.startswith("```"):
                lines = raw_response.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw_response = "\n".join(lines).strip()

            return json.loads(raw_response)
        except Exception as e:
            logger.error(f"Failed to perform impact analysis: {e}")
            # Fallback
            return {
                "affected_features": [f.title for f in features[:2]],
                "severity": "medium",
                "impact_report": f"Automated impact analysis failed ({str(e)}). Manual review required."
            }
