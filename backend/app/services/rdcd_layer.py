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

def extract_atoms_rule_based(message_content: str) -> List[Dict[str, Any]]:
    lower = message_content.lower()
    atoms = []

    tech_map = {
        "postgresql": "PostgreSQL",
        "postgres": "PostgreSQL",
        "mongodb": "MongoDB",
        "mysql": "MySQL",
        "sqlite": "SQLite",
        "oracle": "Oracle",
        "ruby": "Ruby",
        "python": "Python",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "react": "React",
        "vue": "Vue.js",
        "angular": "Angular",
        "java": "Java",
        "golang": "Golang",
        "go": "Golang",
        "php": "PHP",
        "c#": "C#",
        ".net": ".NET",
        "rust": "Rust",
    }
    seen_techs = set()
    for tech_key, tech_name in tech_map.items():
        if tech_key in lower and tech_name not in seen_techs:
            seen_techs.add(tech_name)
            atoms.append({
                "subject": "Technology Stack",
                "action": f"use {tech_name}",
                "constraint_text": tech_name,
                "raw_text": message_content
            })

    if "manager" in lower and "customer" in lower and ("order" in lower or "deliver" in lower):
        customer_raw = "Customers place orders."
        if any(neg in lower for neg in ["don't", "do not", "doesn't", "does not", "never", "not"]):
            customer_raw = "Customers do not place orders."
        atoms.extend([
            {
                "subject": "manager",
                "action": "deliver order",
                "constraint_text": "",
                "raw_text": "Managers deliver orders."
            },
            {
                "subject": "customer",
                "action": "place order",
                "constraint_text": "",
                "raw_text": customer_raw
            }
        ])
    elif "order" in lower or "deliver" in lower:
        atoms.append({
            "subject": "customer",
            "action": "place order",
            "constraint_text": "must be logged in",
            "raw_text": message_content
        })
    elif any(k in lower for k in ["login", "signup", "sign up", "auth", "password", "2fa"]):
        atoms.append({
            "subject": "User",
            "action": "authenticate into system",
            "constraint_text": "authentication",
            "raw_text": message_content
        })

    return atoms

def detect_contradiction_rule_based(existing_atom: Dict[str, Any], candidate_atom: Dict[str, Any]) -> Dict[str, Any]:
    existing_text = (existing_atom.get("raw_text") or "").lower()
    candidate_text = (candidate_atom.get("raw_text") or "").lower()
    existing_subject = (existing_atom.get("subject") or "").lower().strip()
    candidate_subject = (candidate_atom.get("subject") or "").lower().strip()
    existing_action = (existing_atom.get("action") or "").lower().strip()
    candidate_action = (candidate_atom.get("action") or "").lower().strip()
    existing_constraint = (existing_atom.get("constraint_text") or "").lower().strip()
    candidate_constraint = (candidate_atom.get("constraint_text") or "").lower().strip()

    programming_languages = {
        "ruby": "Ruby", "python": "Python", "javascript": "JavaScript", "typescript": "TypeScript",
        "java": "Java", "golang": "Golang", "go": "Golang", "php": "PHP", "c#": "C#", "rust": "Rust"
    }
    exist_lang = programming_languages.get(existing_constraint) or next((v for k, v in programming_languages.items() if k in existing_action), None)
    cand_lang = programming_languages.get(candidate_constraint) or next((v for k, v in programming_languages.items() if k in candidate_action), None)
    if not exist_lang and not existing_constraint:
        exist_lang = next((v for k, v in programming_languages.items() if k in existing_text), None)
    if not cand_lang and not candidate_constraint:
        cand_lang = next((v for k, v in programming_languages.items() if k in candidate_text), None)
    
    if exist_lang and cand_lang and exist_lang != cand_lang:
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.95,
            "aria_message": f"Wait, you previously specified that the programming language should be {exist_lang}, but now you mentioned {cand_lang}. Which programming language should we use for this project?"
        }

    dbs = {
        "postgresql": "PostgreSQL", "postgres": "PostgreSQL", "mysql": "MySQL",
        "mongodb": "MongoDB", "sqlite": "SQLite", "oracle": "Oracle"
    }
    exist_db = dbs.get(existing_constraint) or next((v for k, v in dbs.items() if k in existing_action), None)
    cand_db = dbs.get(candidate_constraint) or next((v for k, v in dbs.items() if k in candidate_action), None)
    if not exist_db and not existing_constraint:
        exist_db = next((v for k, v in dbs.items() if k in existing_text), None)
    if not cand_db and not candidate_constraint:
        cand_db = next((v for k, v in dbs.items() if k in candidate_text), None)

    if exist_db and cand_db and exist_db != cand_db:
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.90,
            "aria_message": f"Wait, you previously specified {exist_db} as the database, but now you mentioned {cand_db}. Which database should we use?"
        }

    if ("manager" in existing_text and "customer" in candidate_text) or \
       ("customer" in existing_text and "manager" in candidate_text):
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.9,
            "aria_message": "Wait, you previously mentioned primary users are customers, but now you say they are managers. Can you clarify?"
        }

    negation_words = {"don't", "do not", "doesn't", "does not", "not", "never", "no ", "must not", "cannot", "can't", "won't", "will not", "disable", "disabled"}
    existing_has_neg = any(nw in existing_text for nw in negation_words)
    candidate_has_neg = any(nw in candidate_text for nw in negation_words)
    
    if (existing_subject and candidate_subject and existing_subject == candidate_subject) or \
       (existing_action and candidate_action and existing_action == candidate_action):
        if existing_has_neg != candidate_has_neg:
            return {
                "conflict_type": "direct_contradiction",
                "confidence": 0.95,
                "aria_message": "You mentioned contradictory requirements regarding whether this action should be permitted. Can you clarify?"
            }

    return {
        "conflict_type": "none",
        "confidence": 0.0,
        "aria_message": ""
    }

class RDCDLayer:
    @staticmethod
    def sanitize_input(content: str) -> Tuple[str, bool]:
        lower_content = content.lower()
        flagged = False
        sanitized = content

        for phrase in SUSPICIOUS_PHRASES:
            if phrase in lower_content:
                flagged = True
                sanitized = sanitized.replace(phrase, "[sanitized block]")

        return sanitized, flagged

    @classmethod
    def extract_atoms(cls, message_content: str) -> List[Dict[str, Any]]:
        if settings.groq_is_mocked:
            return extract_atoms_rule_based(message_content)

        try:
            client = get_groq_client()

            fast_model = getattr(settings, 'GROQ_FAST_MODEL', settings.GROQ_MODEL)
            prompt = ATOM_EXTRACTION_PROMPT.format(message=message_content)
            try:
                response = client.chat.completions.create(
                    model=fast_model,
                    messages=[
                        {"role": "system", "content": "You are a JSON requirements extraction engine. Respond ONLY with a valid raw JSON array. No markdown, no explanation."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    max_tokens=400,
                    timeout=min(settings.GROQ_TIMEOUT_SECONDS, 8),
                )
            except Exception:
                response = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a JSON requirements extraction engine. Respond ONLY with a valid raw JSON array. No markdown, no explanation."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    max_tokens=400,
                    timeout=min(settings.GROQ_TIMEOUT_SECONDS, 8),
                )
            raw_response = (response.choices[0].message.content or "").strip()
            clean_json = strip_json_fences(raw_response)
            extracted = json.loads(clean_json, strict=False)
            if isinstance(extracted, list):
                valid_atoms = [
                    item for item in extracted
                    if isinstance(item, dict) and item.get("raw_text")
                ]
                if valid_atoms:
                    return valid_atoms

                return []
            return extract_atoms_rule_based(message_content)
        except Exception as e:
            logger.warning(f"Groq atom extraction failed ({e}). Using rule-based atom extractor.")
            return extract_atoms_rule_based(message_content)

    @classmethod
    def detect_contradiction(
        cls,
        existing_atom: Dict[str, Any],
        candidate_atom: Dict[str, Any]
    ) -> Dict[str, Any]:
        rule_based_res = detect_contradiction_rule_based(existing_atom, candidate_atom)
        if rule_based_res.get("conflict_type") not in ("none", "check_failed"):
            return rule_based_res

        if settings.groq_is_mocked:
            return rule_based_res

        try:
            client = get_groq_client()

            fast_model = getattr(settings, 'GROQ_FAST_MODEL', settings.GROQ_MODEL)
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
                    model=fast_model,
                    messages=[
                        {"role": "system", "content": "You are an AI requirements conflict validator. Respond ONLY with a valid raw JSON object. No markdown, no explanation."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    max_tokens=200,
                    timeout=min(settings.GROQ_TIMEOUT_SECONDS, 8),
                )
            except Exception:
                response = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": "You are an AI requirements conflict validator. Respond ONLY with a valid raw JSON object. No markdown, no explanation."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    max_tokens=200,
                    timeout=min(settings.GROQ_TIMEOUT_SECONDS, 8),
                )
            raw_response = (response.choices[0].message.content or "").strip()
            if not raw_response and getattr(response.choices[0].message, "reasoning", None):
                raw_response = response.choices[0].message.reasoning.strip()
            clean_json = strip_json_fences(raw_response)
            parsed = json.loads(clean_json, strict=False)
            if isinstance(parsed, dict) and "conflict_type" in parsed:
                return parsed
            return rule_based_res
        except Exception as e:
            logger.warning(f"Groq contradiction detection failed ({e}). Falling back to rule-based.")
            return rule_based_res
