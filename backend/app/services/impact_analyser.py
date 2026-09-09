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
                import asyncio
                loop = asyncio.get_event_loop()
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: client.chat.completions.create(
                            model=settings.GROQ_MODEL,
                            messages=[{"role": "user", "content": prompt}],
                            temperature=0.0,
                            timeout=min(settings.GROQ_TIMEOUT_SECONDS, 8),
                        )
                    ),
                    timeout=8.0
                )
                raw = response.choices[0].message.content.strip()
                llm_result = json.loads(strip_json_fences(raw), strict=False)
            except Exception as e:
                logger.error(f"LLM impact analysis failed: {e}")
                llm_result = {
                    "affected_features": [f.title for f in features[:2]],
                    "severity": "medium",
                    "impact_report": "Architectural Impact Assessment: Reviewing feature dependencies and requirement consistency.",
                }

        conflict_hits: List[Dict[str, Any]] = []
        try:
            conflict_hits = await cls._check_requirement_conflicts(
                title=title,
                description=description,
                project_id=project_id,
                db=db,
            )
        except Exception as rdcd_err:
            logger.warning(f"RDCD conflict check failed for CR '{title}': {rdcd_err}")

        seen_texts = set()
        unique_conflict_hits = []
        for h in conflict_hits:
            norm_text = h["existing_text"].strip().lower()
            if norm_text not in seen_texts:
                seen_texts.add(norm_text)
                unique_conflict_hits.append(h)

        if any(h["confidence"] >= 0.5 for h in unique_conflict_hits):
            llm_result["severity"] = "high"

        existing_report = llm_result.get("impact_report", "").strip()
        if "Automated impact analysis failed" in existing_report:
            existing_report = (
                "Automated Architectural Assessment:\n"
                "This change request impacts core project workflow dependencies and requires structural review."
            )

        if unique_conflict_hits:
            conflict_lines = "\n".join(
                f"  • Conflicts with: \"{h['existing_text'][:150]}\" "
                f"[{h['conflict_type'].replace('_', ' ').title()} - {h['confidence']:.0%} Confidence]\n"
                f"    ARIA Note: {h['aria_message']}"
                for h in unique_conflict_hits
            )
            llm_result["impact_report"] = (
                f"{existing_report}\n\n"
                f"⚠ Detected Requirement Conflicts:\n{conflict_lines}"
            ).strip()
        else:
            llm_result["impact_report"] = (
                f"{existing_report}\n\n"
                f"Requirement Conflicts: None detected with active SRS specifications."
            ).strip()

        llm_result["_conflict_hits"] = unique_conflict_hits
        return llm_result

    @classmethod
    async def _check_requirement_conflicts(
        cls,
        title: str,
        description: str,
        project_id: uuid.UUID,
        db: AsyncSession,
    ) -> List[Dict[str, Any]]:
        from app.services.rdcd_layer import RDCDLayer
        from app.services.embedding_service import EmbeddingService
        from app.services.vector_store import VectorStore
        from app.models.requirement_atom import RequirementAtom
        from sqlalchemy import select as _select
        import re

        atoms = RDCDLayer.extract_atoms(f"{title}. {description}")
        if not atoms:
            return []

        prior_res = await db.execute(
            _select(RequirementAtom)
            .where(
                RequirementAtom.project_id == project_id,
                RequirementAtom.status == "active",
            )
            .order_by(RequirementAtom.created_at.desc())
            .limit(200)
        )
        prior_atoms = prior_res.scalars().all()

        _STOPWORDS = {"the", "and", "for", "with", "that", "this", "from", "have",
                      "will", "should", "must", "can", "are", "was", "were"}

        def _kw_overlap(a_text: str, b_text: str) -> float:
            tok = lambda t: {w for w in re.findall(r"[a-z0-9]+", t.lower()) if len(w) > 2 and w not in _STOPWORDS}
            a, b = tok(a_text), tok(b_text)
            return len(a & b) / len(a | b) if (a and b) else 0.0

        hits: List[Dict[str, Any]] = []
        for atom_dict in atoms:
            raw_text = atom_dict.get("raw_text", description)
            matches = []

            if not settings.chroma_is_mocked:
                try:
                    embedding = EmbeddingService.embed(raw_text)
                    matches = VectorStore.query_similar_atoms(
                        session_id=project_id,
                        query_embedding=embedding,
                        limit=3,
                        status_filter="active",
                    )
                except Exception as vec_err:
                    logger.warning(
                        "Chroma/embedding lookup skipped for CR atom (non-fatal): %s", vec_err
                    )

            if not matches and prior_atoms:
                for pa in prior_atoms:
                    score = _kw_overlap(raw_text, pa.raw_text or "")
                    if score >= 0.35:
                        matches.append({
                            "id": pa.id,
                            "document": pa.raw_text,
                            "distance": 1.0 - score,
                            "metadata": {
                                "atom_id": str(pa.id),
                                "subject": pa.subject or "",
                                "action": pa.action or "",
                                "constraint_text": pa.constraint_text or "",
                            },
                            "source": "keyword_fallback",
                        })
                if matches:
                    logger.debug(
                        "CR RDCD: keyword fallback found %d candidate(s) for '%s...'",
                        len(matches), raw_text[:60],
                    )

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
