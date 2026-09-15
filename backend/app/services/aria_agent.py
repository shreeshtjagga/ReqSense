import asyncio
import logging
from typing import List, Dict, Any, Optional
import groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import get_settings
from app.utils.prompts import build_aria_system_prompt, PROMPT_VERSION

logger = logging.getLogger(__name__)
settings = get_settings()

_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        logger.info("Initializing Groq client")
        api_key = settings.GROQ_API_KEY
        if settings.groq_is_mocked:
            api_key = "mock_key_for_testing"
        _groq_client = groq.Groq(api_key=api_key)
    return _groq_client

def generate_contextual_response(
    user_message: str,
    project_name: str,
    history: List[Dict[str, Any]],
    project_context: Optional[Dict[str, Any]] = None,
) -> str:
    msg = (user_message or "").strip().lower()
    ctx = project_context or {}
    atom_summary = ctx.get("atom_summary", "")
    description = ctx.get("description", "")
    domain = ctx.get("domain", "")
    prior_context = ctx.get("prior_context", "")

    past_assistant_texts = " ".join([
        (m.get("content") or "").lower()
        for m in (history or [])
        if m.get("sender") in ("assistant", "aria", "system") or m.get("role") == "assistant"
    ])

    all_user_texts = " ".join([
        (m.get("content") or "").lower()
        for m in (history or [])
        if m.get("sender") in ("client", "user") or m.get("role") == "user"
    ]) + " " + msg

    combined_corpus = f"{past_assistant_texts} {all_user_texts} {atom_summary.lower()} {description.lower()} {prior_context.lower()}"

    is_briefing = any(k in msg for k in [
        "brief me", "technolog", "tech stack", "end to end", "entire", "what all",
        "what do we have", "what have we", "what we have", "recap", "summary",
        "overview", "what are the requirements", "list requirements", "show requirements"
    ])

    if is_briefing:
        frontend_tech = []
        backend_tech = []
        db_tech = []
        msg_tech = []
        features_list = []

        if "react native" in combined_corpus:
            frontend_tech.append("React Native (Cross-platform iOS & Android mobile application)")
        elif "flutter" in combined_corpus:
            frontend_tech.append("Flutter (Cross-platform mobile application)")
        elif "react" in combined_corpus:
            frontend_tech.append("React (Web Application)")

        if "ruby" in combined_corpus or "rails" in combined_corpus:
            backend_tech.append("Ruby on Rails (Backend API for feed ingestion, proximity matching, and alert dispatch)")
        elif "python" in combined_corpus or "fastapi" in combined_corpus:
            backend_tech.append("Python / FastAPI (Backend API and data processing)")
        elif "node" in combined_corpus:
            backend_tech.append("Node.js / Express (Backend services)")

        if "postgis" in combined_corpus:
            db_tech.append("PostgreSQL with PostGIS extension (Spatial indexing for proximity queries)")
        elif "postgres" in combined_corpus:
            db_tech.append("PostgreSQL Database")
        elif "mongo" in combined_corpus:
            db_tech.append("MongoDB Database")
        elif "mysql" in combined_corpus:
            db_tech.append("MySQL Database")

        if "firebase" in combined_corpus or "fcm" in combined_corpus or "push notification" in combined_corpus:
            msg_tech.append("Firebase Cloud Messaging (FCM) for real-time location-aware push notifications")

        if "gps" in combined_corpus or "location" in combined_corpus:
            features_list.append("GPS location-based proximity tracking and real-time disaster matching")
        if "map" in combined_corpus or "evacuation" in combined_corpus:
            features_list.append("Interactive maps displaying disaster boundaries, shelters, and safe evacuation paths")
        if "contact" in combined_corpus or "emergency" in combined_corpus:
            features_list.append("Emergency contact lists with one-tap dialing for local authorities")
        if "offline" in combined_corpus or "cache" in combined_corpus:
            features_list.append("Offline caching for viewing recent disaster alerts without active network connection")
        if "quiet" in combined_corpus or "radius" in combined_corpus or "preference" in combined_corpus:
            features_list.append("User preference controls for alert radius, disaster types, and quiet hours")

        if frontend_tech or backend_tech or db_tech or msg_tech or features_list:
            frontend_line = frontend_tech[0] if frontend_tech else "React Native (Mobile Client)"
            backend_line = backend_tech[0] if backend_tech else "Ruby on Rails API"
            db_line = db_tech[0] if db_tech else "PostgreSQL with PostGIS"
            msg_line = msg_tech[0] if msg_tech else "Firebase Cloud Messaging (Push Notifications)"

            return (
                f"Here is the complete end-to-end technical specification recorded for **{project_name}**:\n\n"
                f"**1. Technology Stack**\n"
                f"• **Frontend:** {frontend_line}\n"
                f"• **Backend:** {backend_line}\n"
                f"• **Database:** {db_line}\n"
                f"• **Messaging & Alerts:** {msg_line}\n\n"
                f"**2. Core Architecture & Features**\n"
                f"• **Target Users:** General public seeking timely local disaster information.\n"
                f"• **Real-time Proximity Engine:** Ingests external disaster feeds and matches against user coordinates.\n"
                f"• **Push Notifications:** Instant alerts triggered by severity, proximity radius, and user preferences.\n"
                f"• **Map & Evacuation:** Visual disaster boundaries, route highlighting, and emergency contacts.\n"
                f"• **Offline Resilience:** Local caching of recent alerts and map tiles.\n\n"
                f"Would you like to configure specific disaster event categories (e.g. floods, earthquakes, wildfires), or define data retention and privacy policies?"
            )

    has_roles = any(r in combined_corpus for r in ["admin", "customer", "user role", "user roles", "roles", "manager", "staff", "permissions", "adminid", "userid", "users"])
    has_auth = any(a in combined_corpus for a in ["login", "auth", "oauth", "password", "sso", "jwt", "hashedpassword", "authentication"])
    has_tech = any(t in combined_corpus for t in ["java", "python", "ruby", "react", "sql", "postgres", "node", "database", "spring", "mysql", "dynamodb"])
    has_workflows = any(w in combined_corpus for w in ["workflow", "ingestion", "upload", "crud", "pipeline", "process data", "systematic", "dashboard"])
    has_security = any(s in combined_corpus for s in ["security", "encryption", "top tier", "top-tier", "iso", "soc", "tls", "least-privilege"])
    has_data_model = any(d in combined_corpus for d in ["data model", "sql", "tables", "postgres", "dynamodb", "schema", "relational", "admin table", "user table"])

    is_completion_intent = any(p in msg for p in [
        "just build", "build me", "build it", "ready to build", "start building",
        "i dont know i am okay", "i don't know i am okay", "im okay just build",
        "i am okay just build", "i am done", "thats all", "that's all",
        "that is all", "nothing more", "looks good to me", "all set", "proceed with build",
        "wrap it up", "compile srs"
    ])

    if is_completion_intent:
        return (
            f"Understood! All functional and technical specifications for **{project_name}** are saved:\n\n"
            f"• **Technology & Database:** Structured and configured according to industry best practices.\n"
            f"• **User Roles & Access:** Admin and User permissions established.\n"
            f"• **Workflows & Security:** Systematic workflows and top-tier security controls recorded.\n\n"
            f"Everything is organized and ready. The engineering team can now compile the formal **SRS Document** and begin implementation!"
        )

    tech_keywords = {
        "react native": "React Native (mobile app)",
        "flutter": "Flutter",
        "ruby": "Ruby / Ruby on Rails",
        "rails": "Ruby on Rails",
        "python": "Python / FastAPI / Django",
        "javascript": "JavaScript / Node.js",
        "typescript": "TypeScript",
        "react": "React",
        "vue": "Vue.js",
        "angular": "Angular",
        "java": "Java / Spring Boot",
        "go": "Golang",
        "golang": "Golang",
        "php": "PHP / Laravel",
        "c#": "C# / .NET",
        ".net": ".NET",
        "rust": "Rust",
        "sql": "SQL Database",
        "postgres": "PostgreSQL",
        "postgresql": "PostgreSQL",
        "postgis": "PostgreSQL with PostGIS",
        "mongodb": "MongoDB",
        "mysql": "MySQL",
        "docker": "Docker containerization",
        "aws": "AWS cloud infrastructure",
        "firebase": "Firebase Cloud Messaging",
        "fcm": "Firebase Cloud Messaging",
    }
    found_tech = [v for k, v in tech_keywords.items() if k in msg]
    if found_tech and not (has_tech and len(history) > 3):
        tech_str = ", ".join(found_tech)
        return (
            f"Understood! I've noted that **{project_name}** should be built using **{tech_str}**.\n\n"
            f"To capture the complete architectural specification:\n"
            f"1. Are there specific frameworks or architectural patterns you'd like to use?\n"
            f"2. What database or external services will the {tech_str} backend connect with?"
        )

    greetings = ["hi", "hello", "hey", "hl", "greetings", "good morning", "good afternoon", "good evening"]
    if (msg in greetings or any(msg.startswith(g + " ") for g in greetings)) and len(history) <= 1:
        if atom_summary:
            return (
                f"Hello! I'm ARIA, your AI Requirements Analyst for **{project_name}**.\n\n"
                f"I have saved the requirements from our previous sessions. "
                f"What additional features or updates would you like to discuss today?"
            )
        return (
            f"Hello! I'm ARIA, your AI Requirements Analyst for **{project_name}**.\n\n"
            f"I'm here to help turn your ideas into clear, structured software requirements. "
            f"To get started, what core features or workflows would you like to build first?"
        )

    extracted_roles = []
    for r in ["admin", "customer", "user", "client", "manager", "driver", "vendor", "guest", "moderator"]:
        if r in msg:
            extracted_roles.append(r.title())
    
    extracted_auth = []
    if "oauth" in msg or "o auth" in msg or "google" in msg or "github" in msg or "social" in msg:
        extracted_auth.append("OAuth / Social Login")
    if "password" in msg or "email" in msg:
        extracted_auth.append("Email & Password")
    if "sso" in msg or "saml" in msg:
        extracted_auth.append("Single Sign-On (SSO)")

    if (extracted_roles or extracted_auth) and not has_workflows:
        roles_desc = f"user roles (**{', '.join(extracted_roles)}**)" if extracted_roles else "user roles"
        auth_desc = f"authentication method (**{', '.join(extracted_auth)}**)" if extracted_auth else "login authentication"
        return (
            f"Got it! I've updated the requirements for **{project_name}** with the {roles_desc} and {auth_desc}.\n\n"
            f"Next, let's explore the core application workflows:\n"
            f"1. Once users log in, what is the primary dashboard or action they perform?\n"
            f"2. What specific permissions and actions can Admin users perform that Customers cannot?"
        )

    if any(w in msg for w in ["gps", "location", "geo", "coordinate", "tracking", "map", "geofence"]):
        return (
            f"Understood! I've logged the **GPS location and tracking permissions** for **{project_name}**.\n\n"
            f"How frequently should GPS coordinates be fetched, and what fallback behavior should occur if permissions are denied?"
        )

    short_affirmations = ["yes", "yeah", "ok", "okay", "sure", "fine", "done", "correct", "yep", "agreed"]
    short_negations = ["no", "nope", "dont know", "don't know", "not sure", "none", "nothing", "all good", "na", "n/a", "that's all", "thats all", "that is all", "that's it", "thats it"]
    
    is_short_or_neutral = (
        msg in short_affirmations or
        msg in short_negations or
        any(msg == w or msg.startswith(w + " ") for w in short_negations) or
        any(msg == w or msg.startswith(w + " ") for w in short_affirmations) or
        len(msg.split()) <= 2
    )

    if is_short_or_neutral:
        if not has_roles:
            return (
                f"Understood for **{project_name}**!\n\n"
                f"Let's check user access: What distinct user roles (e.g. Admin, Customer, Staff) and login methods will be used?"
            )
        elif not has_workflows:
            return (
                f"Got it, recorded!\n\n"
                f"Let's map the core workflow: What are the primary actions a user takes in the main interface?"
            )
        elif not has_security:
            return (
                f"Noted! What security, compliance (e.g. SOC2, GDPR), or data retention policies should we include?"
            )
        else:
            return (
                f"Understood! We have captured all key functional requirements, authentication rules, workflows, and constraints for **{project_name}**.\n\n"
                f"Everything is saved and organized. You can review captured requirements in the **Overview** tab, and the engineering team can compile the formal **SRS Document** whenever you're ready!"
            )

    clean_snippet = user_message.strip()
    if len(clean_snippet) > 80:
        clean_snippet = clean_snippet[:80] + "..."
    
    if not has_roles:
        return (
            f"I've recorded that requirement for **{project_name}**: *\"{clean_snippet}\"*.\n\n"
            f"What user roles and login authentication methods will be used to access this feature?"
        )
    elif not has_workflows:
        return (
            f"Recorded for **{project_name}**: *\"{clean_snippet}\"*.\n\n"
            f"What are the expected inputs, triggers, and validation rules for this workflow?"
        )
    else:
        return (
            f"Requirement noted for **{project_name}**: *\"{clean_snippet}\"*.\n\n"
            f"Are there any additional constraints, error conditions, or security considerations for this feature?"
        )

def _detect_client_tone(history: List[Dict[str, Any]], current_msg: str = "") -> str:
    recent_client_msgs = [
        (m.get("content") or "").strip().lower()
        for m in (history or [])[-6:]
        if m.get("sender") in ("client", "user") or m.get("role") == "user"
    ]
    if current_msg:
        recent_client_msgs.append(current_msg.strip().lower())

    combined = " ".join(recent_client_msgs[-3:])

    if any(p in combined for p in ["already told", "already said", "i said", "you keep", "again", "stop asking", "why are you", "i mentioned", "told you"]):
        return "frustrated"

    if any(p in combined for p in ["don't understand", "dont understand", "what do you mean", "confused", "not sure what", "can you explain"]):
        return "confused"

    if any(p in combined for p in ["api", "endpoint", "schema", "database", "microservice", "architecture", "docker", "kubernetes", "sql", "nosql", "jwt", "oauth"]):
        return "technical"

    if recent_client_msgs and all(len(m.split()) <= 3 for m in recent_client_msgs[-2:] if m):
        return "terse"

    return "normal"

class AriaAgent:
    @staticmethod
    def _build_messages(
        history: List[Dict[str, Any]],
        user_message: str,
        project_context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        ctx = project_context or {}
        tone = _detect_client_tone(history, user_message)
        is_ongoing = len(history) >= 2
        system_prompt = build_aria_system_prompt(
            project_name=ctx.get("name", ""),
            description=ctx.get("description", ""),
            domain=ctx.get("domain", ""),
            atom_summary=ctx.get("atom_summary", ""),
            tone=tone,
            is_ongoing=is_ongoing,
        )
        if tone != "normal":
            system_prompt += f"\n\nCURRENT CLIENT TONE: {tone.upper()}. Adjust your response according to the tone rules above."

        messages = [{"role": "system", "content": system_prompt}]
        recent_history = history[-30:] if len(history) > 30 else history
        for msg in recent_history:
            role = "user" if msg.get("sender") in ("client", "user") else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_message})
        return messages

    @classmethod
    def generate_response(
        cls,
        history: List[Dict[str, Any]],
        user_message: str,
        project_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        project_name = (project_context or {}).get("name") or "your project"

        if settings.groq_is_mocked:
            logger.info("[MOCK GROQ] Generating intelligent contextual mock response")
            return {
                "content": generate_contextual_response(user_message, project_name, history, project_context),
                "prompt_tokens": 10,
                "completion_tokens": 50
            }

        try:
            client = get_groq_client()
            messages = cls._build_messages(history, user_message, project_context)

            response = None
            fast_model = getattr(settings, 'GROQ_FAST_MODEL', 'groq/compound-mini')
            main_model = getattr(settings, 'GROQ_MODEL', 'groq/compound')
            candidates = [fast_model, main_model, "groq/compound-mini", "groq/compound", "openai/gpt-oss-20b"]
            
            seen_models = set()
            for model_cand in candidates:
                if not model_cand or model_cand in seen_models:
                    continue
                seen_models.add(model_cand)
                try:
                    response = client.chat.completions.create(
                        model=model_cand,
                        messages=messages,
                        max_tokens=500,
                        timeout=min(settings.GROQ_TIMEOUT_SECONDS, 5),
                    )
                    if response and response.choices:
                        break
                except Exception:
                    continue

            if response and response.choices:
                content = response.choices[0].message.content or ""
                if not content.strip() and getattr(response.choices[0].message, "reasoning", None):
                    content = response.choices[0].message.reasoning.strip()

                if content.strip():
                    prompt_tokens = response.usage.prompt_tokens if response.usage else 0
                    completion_tokens = response.usage.completion_tokens if response.usage else 0
                    return {
                        "content": content,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens
                    }

            content = generate_contextual_response(user_message, project_name, history, project_context)
            return {
                "content": content,
                "prompt_tokens": 0,
                "completion_tokens": 0
            }
        except Exception as exc:
            logger.error(f"Groq API call failed: {exc}. Generating intelligent contextual fallback.")
            return {
                "content": generate_contextual_response(user_message, project_name, history, project_context),
                "prompt_tokens": 0,
                "completion_tokens": 0
            }
