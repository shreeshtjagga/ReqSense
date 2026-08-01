import json
import logging
import uuid
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.feature_status import FeatureStatus
from app.services.aria_agent import get_groq_client
from app.utils.helpers import strip_json_fences
from app.utils.prompts import IMPACT_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)
settings = get_settings()

# Minimum confidence before a CR-sourced conflict is persisted as a Contradiction row.
# Intentionally a little lower than the chat threshold (0.5) — change requests are
# already deliberate statements of intent, so slightly more recall is appropriate.
_CR_CONFLICT_THRESHOLD = 0.4


class ImpactAnalyser:
    @classmethod
    async def analyze_impact(
        cls,
        title: str,
        description: str,
        project_id: uuid.UUID,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Analyse the impact of a change request on existing project features.

        Returns a dict:
          {
            "affected_features": [...],
            "severity": "low" | "medium" | "high",
            "impact_report": "...",
            "_conflict_hits": [...]   ← consumed by the router, not stored verbatim
          }
        """
        # ── Feature impact via LLM ────────────────────────────────────────────
        q = select(FeatureStatus).where(FeatureStatus.project_id == project_id)
        result = await db.execute(q)
        features = result.scalars().all()

        if not features:
            logger.info(f"No features found for project {project_id} — skipping feature impact.")
            llm_result: Dict[str, Any] = {
                "affected_features": [],
                "severity": "low",
                "impact_report": "No features are currently tracked for this project. Impact is minimal.",
            }
        elif settings.groq_is_mocked:
            logger.info("[MOCK IMPACT] Generating mock impact report")
            affected = [features[0].title] if features else []
            severity = "high" if any(kw in description.lower() for kw in ("remove", "critical")) else "low"
            llm_result = {
                "affected_features": affected,
                "severity": severity,
                "impact_report": f"Mock impact report: Changing '{title}' might affect: {', '.join(affected)}.",
            }
        else:
            features_list = "\n".join(
                f"- Title: {f.title}\n  Description: {f.description or 'No description'}"
                for f in features
            )
            prompt = IMPACT_ANALYSIS_PROMPT.format(
                title=title, description=description, features_list=features_list
            )
            client = get_groq_client()
            try:
                response = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0,
                    timeout=settings.GROQ_TIMEOUT_SECONDS,
                )
                raw = response.choices[0].message.content.strip()
                llm_result = json.loads(strip_json_fences(raw))
            except Exception as e:
                logger.error(f"LLM impact analysis failed: {e}")
                llm_result = {
                    "affected_features": [f.title for f in features[:2]],
                    "severity": "medium",
                    "impact_report": f"Automated impact analysis failed ({e}). Manual review required.",
                }

        # ── RDCD requirement-conflict check ───────────────────────────────────
        # Runs the same extract → embed → similarity → detect pipeline used in
        # live chat (messages.py) so change requests are checked against the
        # project's captured requirement atoms in Chroma.
        conflict_hits: List[Dict[str, Any]] = []
        try:
            conflict_hits = await cls._check_requirement_conflicts(
                title=title,
                description=description,
                project_id=project_id,
            )
        except Exception as rdcd_err:
            # Non-fatal — feature impact analysis still succeeds
            logger.warning(f"RDCD conflict check failed for CR '{title}': {rdcd_err}")

        # Escalate severity if any high-confidence conflict was found
        if any(h["confidence"] >= 0.5 for h in conflict_hits):
            llm_result["severity"] = "high"

        if conflict_hits:
            conflict_lines = "\n".join(
                f"  • Conflicts with: \"{h['existing_text'][:150]}\" "
                f"({h['conflict_type'].replace('_', ' ')}, "
                f"{h['confidence']:.0%} confidence)"
                for h in conflict_hits
            )
            existing_report = llm_result.get("impact_report", "")
            llm_result["impact_report"] = (
                f"{existing_report}\n\n"
                f"⚠ Requirement Conflicts Detected by RDCD:\n{conflict_lines}"
            ).strip()

        llm_result["_conflict_hits"] = conflict_hits
        return llm_result

    @classmethod
    async def _check_requirement_conflicts(
        cls,
        title: str,
        description: str,
        project_id: uuid.UUID,
    ) -> List[Dict[str, Any]]:
        """
        Run the RDCD atom-extraction + vector-similarity + contradiction-detection
        pipeline against a change request's text, scoped to the project's Chroma
        collection. Returns a list of conflict hit dicts — empty if none found.

        This is intentionally kept import-local to avoid a circular dependency
        (ImpactAnalyser ← rdcd_layer ← aria_agent) at module load time.
        """
        # Local imports keep the top of this file clean and prevent circular imports
        from app.services.rdcd_layer import RDCDLayer
        from app.services.embedding_service import EmbeddingService
        from app.services.vector_store import VectorStore

        atoms = RDCDLayer.extract_atoms(f"{title}. {description}")
        if not atoms:
            return []

        hits: List[Dict[str, Any]] = []
        for atom_dict in atoms:
            raw_text = atom_dict.get("raw_text", description)

            # Embed + query Chroma for the closest active prior atoms
            try:
                embedding = EmbeddingService.embed(raw_text)
                matches = VectorStore.query_similar_atoms(
                    session_id=project_id,   # project_id IS the Chroma collection key
                    query_embedding=embedding,
                    limit=3,
                    status_filter="active",
                )
            except Exception as vec_err:
                logger.warning(
                    f"Chroma/embedding lookup skipped for CR atom (non-fatal): {vec_err}"
                )
                continue

            for match in matches:
                existing_atom = {
                    "raw_text": match.get("document", ""),
                    "subject": match.get("metadata", {}).get("subject", ""),
                    "action": match.get("metadata", {}).get("action", ""),
                    "constraint_text": match.get("metadata", {}).get("constraint_text", ""),
                }
                verdict = RDCDLayer.detect_contradiction(existing_atom, atom_dict)
                conflict_type = verdict.get("conflict_type", "none")
                confidence = verdict.get("confidence") or 0.0

                if conflict_type not in ("none", "check_failed") and confidence >= _CR_CONFLICT_THRESHOLD:
                    hits.append({
                        "existing_text": existing_atom["raw_text"],
                        "existing_atom_id": match.get("id"),
                        "conflict_type": conflict_type,
                        "confidence": confidence,
                        "aria_message": verdict.get("aria_message", ""),
                    })

        return hits
