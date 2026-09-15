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
    "disregard instructions",
    "disregard all instructions",
    "dan mode",
    "jailbreak",
    "developer mode enabled",
    "reveal system prompt",
    "reveal api key",
    "reveal secret",
    "unrestricted mode",
    "bypass restrictions",
    "bypass safety",
    "sudo mode",
    "print all instructions",
    "forget all rules",
]

def extract_atoms_rule_based(message_content: str) -> List[Dict[str, Any]]:
    lower = message_content.lower()
    atoms = []

    tech_map = {
        "postgresql": "PostgreSQL",
        "postgres": "PostgreSQL",
        "postgis": "PostgreSQL with PostGIS",
        "mongodb": "MongoDB",
        "mysql": "MySQL",
        "sqlite": "SQLite",
        "oracle": "Oracle",
        "ruby": "Ruby on Rails",
        "rails": "Ruby on Rails",
        "python": "Python",
        "fastapi": "FastAPI",
        "django": "Django",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "react native": "React Native",
        "react": "React",
        "flutter": "Flutter",
        "vue": "Vue.js",
        "angular": "Angular",
        "java": "Java",
        "spring": "Spring Boot",
        "golang": "Golang",
        "go": "Golang",
        "php": "PHP",
        "laravel": "Laravel",
        "c#": "C#",
        ".net": ".NET",
        "rust": "Rust",
        "firebase": "Firebase Cloud Messaging",
        "fcm": "Firebase Cloud Messaging",
    }
    seen_techs = set()
    for tech_key, tech_name in tech_map.items():
        if tech_key in lower and tech_name not in seen_techs:
            seen_techs.add(tech_name)
            subject = "Tech Stack"
            if "react native" in tech_key or "flutter" in tech_key:
                subject = "Frontend Tech Stack"
            elif "ruby" in tech_key or "rails" in tech_key or "fastapi" in tech_key or "django" in tech_key:
                subject = "Backend Tech Stack"
            elif "postgres" in tech_key or "mongo" in tech_key or "mysql" in tech_key or "postgis" in tech_key:
                subject = "Database Tech Stack"
            elif "firebase" in tech_key or "fcm" in tech_key:
                subject = "Messaging & Notifications"

            atoms.append({
                "subject": subject,
                "action": f"use {tech_name}",
                "constraint_text": tech_name,
                "raw_text": message_content
            })

    if "push notification" in lower or "push alert" in lower:
        atoms.append({
            "subject": "Notifications",
            "action": "send push notifications for nearby disaster events",
            "constraint_text": "Firebase Cloud Messaging",
            "raw_text": message_content
        })

    if any(k in lower for k in ["gps", "location", "geofence", "evacuation", "disaster"]):
        atoms.append({
            "subject": "Location & Proximity",
            "action": "match real-time disaster alerts by user GPS location coordinates",
            "constraint_text": "GPS location permissions and proximity matching",
            "raw_text": message_content
        })

    if "general public" in lower or "public user" in lower:
        atoms.append({
            "subject": "User Role",
            "action": "receive disaster warnings and view evacuation routes",
            "constraint_text": "General Public",
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

    mobile_terms = ["mobile application", "mobile app", "android", "ios", "react native", "flutter", "smartphone", "iphone"]
    web_terms = ["web application", "web app", "website", "browser application", "browser-based", "web portal"]
    desktop_terms = ["desktop application", "desktop app", "electron", "windows app", "macos app"]

    exist_mobile = any(t in existing_text or t in existing_action or t in existing_constraint for t in mobile_terms)
    cand_mobile = any(t in candidate_text or t in candidate_action or t in candidate_constraint for t in mobile_terms)

    exist_web = any(t in existing_text or t in existing_action or t in existing_constraint for t in web_terms)
    cand_web = any(t in candidate_text or t in candidate_action or t in candidate_constraint for t in web_terms)

    exist_desktop = any(t in existing_text or t in existing_action or t in existing_constraint for t in desktop_terms)
    cand_desktop = any(t in candidate_text or t in candidate_action or t in candidate_constraint for t in desktop_terms)

    if (exist_mobile and cand_web and not cand_mobile) or (exist_web and cand_mobile and not cand_web):
        was_type = "mobile application" if exist_mobile else "web application"
        new_type = "web application" if cand_web else "mobile application"
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.95,
            "aria_message": f"Platform conflict detected: The project was previously specified as a {was_type}, but this specification requires a {new_type}. Should we switch platforms or build both?"
        }

    if (exist_mobile and cand_desktop and not cand_mobile) or (exist_desktop and cand_mobile and not cand_desktop):
        was_type = "mobile application" if exist_mobile else "desktop application"
        new_type = "desktop application" if cand_desktop else "mobile application"
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.95,
            "aria_message": f"Platform conflict detected: The project was previously specified as a {was_type}, but this specification requires a {new_type}. Please clarify the intended platform."
        }

    if (exist_web and cand_desktop and not cand_web) or (exist_desktop and cand_web and not cand_desktop):
        was_type = "web application" if exist_web else "desktop application"
        new_type = "desktop application" if cand_desktop else "web application"
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.95,
            "aria_message": f"Platform conflict detected: The project was previously specified as a {was_type}, but this specification requires a {new_type}. Please clarify the intended platform."
        }

    frontend_tech = {
        "react native": "React Native", "flutter": "Flutter", "swift": "Swift",
        "kotlin": "Kotlin", "react": "React", "vue": "Vue.js", "angular": "Angular",
        "javascript": "JavaScript", "typescript": "TypeScript"
    }
    backend_tech = {
        "ruby": "Ruby on Rails", "rails": "Ruby on Rails", "python": "Python",
        "fastapi": "FastAPI", "django": "Django", "golang": "Golang", "go": "Golang",
        "java": "Java", "spring": "Spring Boot", "php": "PHP", "laravel": "Laravel",
        "c#": "C#", ".net": ".NET", "rust": "Rust", "node": "Node.js"
    }

    exist_front = next((v for k, v in frontend_tech.items() if k in existing_text or k in existing_constraint or k in existing_action), None)
    cand_front = next((v for k, v in frontend_tech.items() if k in candidate_text or k in candidate_constraint or k in candidate_action), None)

    exist_back = next((v for k, v in backend_tech.items() if k in existing_text or k in existing_constraint or k in existing_action), None)
    cand_back = next((v for k, v in backend_tech.items() if k in candidate_text or k in candidate_constraint or k in candidate_action), None)

    if (exist_front and not exist_back and cand_back and not cand_front) or \
       (exist_back and not exist_front and cand_front and not cand_back):
        return {
            "conflict_type": "none",
            "confidence": 0.0,
            "aria_message": ""
        }

    if exist_back and cand_back and exist_back != cand_back:
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.95,
            "aria_message": f"Wait, you previously specified {exist_back} for the backend, but now you mentioned {cand_back}. Which backend framework should we use for this project?"
        }

    if exist_front and cand_front and exist_front != cand_front and not (("javascript" in exist_front.lower() or "typescript" in exist_front.lower()) and "react native" in cand_front.lower()):
        return {
            "conflict_type": "direct_contradiction",
            "confidence": 0.95,
            "aria_message": f"Wait, you previously specified {exist_front} for the frontend, but now you mentioned {cand_front}. Which frontend framework should we use?"
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

    non_committal_phrases = ["no specific", "no preference", "no particular", "no special", "no fixed", "no constraint", "no requirement", "not specific", "none in particular"]
    if any(ncp in existing_text for ncp in non_committal_phrases) or any(ncp in candidate_text for ncp in non_committal_phrases):
        return {
            "conflict_type": "none",
            "confidence": 0.0,
            "aria_message": ""
        }

    explicit_action_negations = {"must not", "cannot", "can't", "should not", "do not allow", "disallow", "prohibit", "forbidden", "never allow", "don't allow"}
    exist_explicit_neg = any(nw in existing_text for nw in explicit_action_negations)
    cand_explicit_neg = any(nw in candidate_text for nw in explicit_action_negations)

    if (existing_action and candidate_action and existing_action == candidate_action) or \
       (existing_subject and candidate_subject and existing_subject == candidate_subject and existing_action and candidate_action):
        if exist_explicit_neg != cand_explicit_neg:
            action_desc = candidate_action or existing_action or "this feature"
            return {
                "conflict_type": "direct_contradiction",
                "confidence": 0.90,
                "aria_message": f"You previously mentioned allowing '{action_desc}', but now specified it should be disallowed. Which rule should we apply?"
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

            fast_model = getattr(settings, 'GROQ_FAST_MODEL', 'groq/compound-mini')
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
                    timeout=min(settings.GROQ_TIMEOUT_SECONDS, 4),
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
                    timeout=min(settings.GROQ_TIMEOUT_SECONDS, 4),
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

            fast_model = getattr(settings, 'GROQ_FAST_MODEL', 'groq/compound-mini')
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
                    timeout=min(settings.GROQ_TIMEOUT_SECONDS, 4),
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
                    timeout=min(settings.GROQ_TIMEOUT_SECONDS, 4),
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
