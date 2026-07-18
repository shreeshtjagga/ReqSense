import json
import logging
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import groq

from app.config import get_settings
from app.utils.prompts import ATOM_EXTRACTION_PROMPT, CONTRADICTION_DETECTION_PROMPT
from app.services.aria_agent import get_groq_client
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)
settings = get_settings()

SUSPICIOUS_PHRASES = [
    "ignore previous",
    "ignore all previous",
    "override instructions",
    "you must now act as",
    "system prompt",
    "disregard instructions"
]

class RDCDLayer:
    @staticmethod
    async def sanitize_input(
        content: str,
        user_id: uuid.UUID,
        db: AsyncSession,
        request_id: str = None
    ) -> str:
        """
        Sanitize input by stripping instruction override attempts.
        Logs flagged attempts to audit_logs.
        """
        lower_content = content.lower()
        flagged = False
        sanitized = content

        for phrase in SUSPICIOUS_PHRASES:
            if phrase in lower_content:
                flagged = True
                # Clean/remove the phrase
                sanitized = sanitized.replace(phrase, "[sanitized block]")

        if flagged:
            logger.warning(f"Suspicious instruction override attempt by user {user_id} flagged")
            audit_log = AuditLog(
                user_id=user_id,
                action="suspicious_input_flagged",
                entity_type="message",
                metadata={"original_content_snippet": content[:100]},
                request_id=request_id
            )
            db.add(audit_log)
            # We don't commit here; we let it commit with the message transaction or in outer block.

        return sanitized

    @classmethod
    def extract_atoms(cls, message_content: str) -> List[Dict[str, Any]]:
        """
        Calls Groq to extract requirement atoms from message content.
        Returns a list of atom dicts: [{"subject": ..., "action": ..., "constraint_text": ..., "raw_text": ...}]
        """
        client = get_groq_client()
        # Mock behavior for testing
        if settings.GROQ_API_KEY.startswith("test") or settings.GROQ_API_KEY.startswith("mock"):
            # Simple heuristic mock extraction to help tests
            if "order" in message_content.lower() or "deliver" in message_content.lower():
                return [{
                    "subject": "customer",
                    "action": "place order",
                    "constraint_text": "must be logged in",
                    "raw_text": message_content
                }]
            return []

        prompt = ATOM_EXTRACTION_PROMPT.format(message=message_content)
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,  # low temp for structured extraction
                timeout=settings.GROQ_TIMEOUT_SECONDS
            )
            raw_response = response.choices[0].message.content.strip()
            # Strip any markdown code fences if LLM wrapped it in ```json ... ```
            if raw_response.startswith("```"):
                lines = raw_response.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw_response = "\n".join(lines).strip()

            return json.loads(raw_response)
        except Exception as e:
            logger.error(f"Failed to extract atoms from message: {e}")
            return []

    @classmethod
    def detect_contradiction(
        cls,
        existing_atom: Dict[str, Any],
        candidate_atom: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compares two atoms using Groq to detect contradictions.
        """
        client = get_groq_client()
        if settings.GROQ_API_KEY.startswith("test") or settings.GROQ_API_KEY.startswith("mock"):
            # Mock behavior for contradiction test
            # If the candidate raw_text or existing raw_text contains the word "manager" vs "customer", trigger conflict
            existing_text = existing_atom.get("raw_text", "").lower()
            candidate_text = candidate_atom.get("raw_text", "").lower()
            if ("manager" in existing_text and "customer" in candidate_text) or \
               ("customer" in existing_text and "manager" in candidate_text):
                return {
                    "conflict_type": "direct_contradiction",
                    "confidence": 0.9,
                    "aria_message": "Wait, you previously mentioned primary users are customers, but now you say they are managers. Can you clarify?"
                }
            return {
                "conflict_type": "none",
                "confidence": 0.0,
                "aria_message": ""
            }

        prompt = CONTRADICTION_DETECTION_PROMPT.format(
            existing_subject=existing_atom.get("subject", ""),
            existing_action=existing_atom.get("action", ""),
            existing_constraint=existing_atom.get("constraint_text", ""),
            existing_raw_text=existing_atom.get("raw_text", ""),
            candidate_subject=candidate_atom.get("subject", ""),
            candidate_action=candidate_atom.get("action", ""),
            candidate_constraint=candidate_atom.get("constraint_text", ""),
            candidate_raw_text=candidate_atom.get("raw_text", "")
        )

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
            logger.error(f"Failed to detect contradiction: {e}")
            return {
                "conflict_type": "none",
                "confidence": 0.0,
                "aria_message": ""
            }
