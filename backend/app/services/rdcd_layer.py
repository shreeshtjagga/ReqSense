import json
import logging
from typing import List, Dict, Any, Tuple
import groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings
from app.utils.prompts import ATOM_EXTRACTION_PROMPT, CONTRADICTION_DETECTION_PROMPT
from app.utils.helpers import strip_json_fences
from app.services.aria_agent import get_groq_client

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
    def sanitize_input(content: str) -> Tuple[str, bool]:
        """
        Pure function: Sanitize input by stripping instruction override attempts.
        Returns tuple: (sanitized_content, was_flagged).
        Does no DB access so it can be called safely in pre-transaction phase.
        """
        lower_content = content.lower()
        flagged = False
        sanitized = content

        for phrase in SUSPICIOUS_PHRASES:
            if phrase in lower_content:
                flagged = True
                sanitized = sanitized.replace(phrase, "[sanitized block]")

        return sanitized, flagged

    @classmethod
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((groq.APIConnectionError, groq.APITimeoutError)),
        reraise=False
    )
    def extract_atoms(cls, message_content: str) -> List[Dict[str, Any]]:
        """
        Calls Groq to extract requirement atoms from message content.
        Returns a list of atom dicts: [{"subject": ..., "action": ..., "constraint_text": ..., "raw_text": ...}]
        """
        if settings.groq_is_mocked:
            if "order" in message_content.lower() or "deliver" in message_content.lower():
                return [{
                    "subject": "customer",
                    "action": "place order",
                    "constraint_text": "must be logged in",
                    "raw_text": message_content
                }]
            return []

        client = get_groq_client()
        prompt = ATOM_EXTRACTION_PROMPT.format(message=message_content)
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": "You are a JSON requirements extraction engine. Respond ONLY with a valid raw JSON array. Do not include markdown code fences, introductory text, explanations, or code tutorials."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0,
                timeout=settings.GROQ_TIMEOUT_SECONDS
            )
            raw_response = response.choices[0].message.content.strip()
            clean_json = strip_json_fences(raw_response)
            extracted = json.loads(clean_json, strict=False)
            if isinstance(extracted, list):
                valid_atoms = []
                for item in extracted:
                    if isinstance(item, dict) and item.get("raw_text"):
                        valid_atoms.append(item)
                return valid_atoms
            return []
        except Exception as e:
            logger.error(f"Failed to extract atoms from message: {e}")
            return []

    @classmethod
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((groq.APIConnectionError, groq.APITimeoutError)),
        reraise=False
    )
    def detect_contradiction(
        cls,
        existing_atom: Dict[str, Any],
        candidate_atom: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compares two atoms using Groq to detect contradictions.
        Returns dict with keys: conflict_type, confidence, aria_message.
        """
        if settings.groq_is_mocked:
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

        client = get_groq_client()
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
                messages=[
                    {"role": "system", "content": "You are an AI requirements conflict validator. Respond ONLY with a valid raw JSON object. Do not include markdown code fences, introductory text, explanations, or code tutorials."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0,
                timeout=settings.GROQ_TIMEOUT_SECONDS
            )
            raw_response = response.choices[0].message.content.strip()
            clean_json = strip_json_fences(raw_response)
            parsed = json.loads(clean_json, strict=False)
            if isinstance(parsed, dict) and "conflict_type" in parsed:
                return parsed
            return {
                "conflict_type": "check_failed",
                "confidence": None,
                "aria_message": "Invalid response format"
            }
        except Exception as e:
            logger.error(f"Failed to detect contradiction: {e}")
            return {
                "conflict_type": "check_failed",
                "confidence": None,
                "aria_message": ""
            }

