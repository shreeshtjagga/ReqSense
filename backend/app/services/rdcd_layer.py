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

    # 1. Tech stack & Programming Languages
    tech_map = {
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
        "postgres": "PostgreSQL",
        "postgresql": "PostgreSQL",
        "mysql": "MySQL",
        "mongodb": "MongoDB",
        "sqlite": "SQLite",
    }
    for tech_key, tech_name in tech_map.items():
        if tech_key in lower:
            atoms.append({
                "subject": "Technology Stack",
                "action": f"use {tech_name}",
                "constraint_text": tech_name,
                "raw_text": message_content
            })
            break

    # 2. Manager vs Customer ordering logic
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

    # Default general atom if message has content
    if not atoms and len(message_content.strip()) > 3:
        words = message_content.strip().split()
        subj = words[0].capitalize() if len(words) > 0 else "System"
        act = " ".join(words[1:6]) if len(words) > 1 else "specify requirement"
        atoms.append({
            "subject": subj,
            "action": act,
            "constraint_text": "",
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

    # 1. Tech stack & Programming language conflict (e.g. Ruby vs Python)
    programming_languages = ["ruby", "python", "javascript", "typescript", "java", "golang", "go", "php", "c#", "rust"]
    existing_langs = [l for l in programming_languages if l in existing_text or l == existing_constraint or l in existing_action]
    candidate_langs = [l for l in programming_languages if l in candidate_text or l == candidate_constraint or l in candidate_action]
    if existing_langs and candidate_langs:
        lang1 = existing_langs[0]
        lang2 = candidate_langs[0]
        if lang1 != lang2:
            return {
                "conflict_type": "direct_contradiction",
                "confidence": 0.95,
                "aria_message": f"Wait, you previously specified that the programming language should be {lang1.capitalize()}, but now you mentioned {lang2.capitalize()}. Which programming language should we use for this project?"
            }

    # 2. Database conflicts (e.g. PostgreSQL vs MongoDB)
    dbs = ["postgres", "postgresql", "mysql", "mongodb", "sqlite", "oracle"]
    existing_dbs = [d for d in dbs if d in existing_text or d == existing_constraint or d in existing_action]
    candidate_dbs = [d for d in dbs if d in candidate_text or d == candidate_constraint or d in candidate_action]
    if existing_dbs and candidate_dbs:
        db1 = existing_dbs[0]
        db2 = candidate_dbs[0]
        if db1 != db2:
            return {
                "conflict_type": "direct_contradiction",
                "confidence": 0.90,
                "aria_message": f"Wait, you previously specified {db1.capitalize()} as the database, but now you mentioned {db2.capitalize()}. Which database should we use?"
            }

    # 3. Manager vs Customer role conflicts
    if ("manager" in existing_text and "customer" in candidate_text) or \
       ("customer" in existing_text and "manager" in candidate_text):
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.9,
            "aria_message": "Wait, you previously mentioned primary users are customers, but now you say they are managers. Can you clarify?"
        }

    # 4. Negation-based contradictions
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
            prompt = ATOM_EXTRACTION_PROMPT.format(message=message_content)
            try:
                response = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a JSON requirements extraction engine. Respond ONLY with a valid raw JSON array. Do not include markdown code fences, introductory text, explanations, or code tutorials."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    max_tokens=600,
                    timeout=settings.GROQ_TIMEOUT_SECONDS,
                    extra_body={"reasoning_format": "hidden"},
                )
            except Exception:
                response = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a JSON requirements extraction engine. Respond ONLY with a valid raw JSON array. Do not include markdown code fences, introductory text, explanations, or code tutorials."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    max_tokens=600,
                    timeout=settings.GROQ_TIMEOUT_SECONDS,
                )
            raw_response = (response.choices[0].message.content or "").strip()
            if not raw_response and getattr(response.choices[0].message, "reasoning", None):
                raw_response = response.choices[0].message.reasoning.strip()
            clean_json = strip_json_fences(raw_response)
            extracted = json.loads(clean_json, strict=False)
            if isinstance(extracted, list) and len(extracted) > 0:
                valid_atoms = []
                for item in extracted:
                    if isinstance(item, dict) and item.get("raw_text"):
                        valid_atoms.append(item)
                if valid_atoms:
                    return valid_atoms
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
                    max_tokens=400,
                    timeout=settings.GROQ_TIMEOUT_SECONDS,
                    extra_body={"reasoning_format": "hidden"},
                )
            except Exception:
                response = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": "You are an AI requirements conflict validator. Respond ONLY with a valid raw JSON object. Do not include markdown code fences, introductory text, explanations, or code tutorials."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    max_tokens=400,
                    timeout=settings.GROQ_TIMEOUT_SECONDS,
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
