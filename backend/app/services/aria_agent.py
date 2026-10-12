import asyncio
import logging
from typing import List, Dict, Any, Optional
import groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import get_settings
from app.utils.prompts import build_aria_system_prompt, PROMPT_VERSION
from app.utils.helpers import contains_keyword

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

NEUTRAL_FALLBACK_MESSAGE = (
    "Thank you for sharing those details! I've recorded that requirement for your project. "
    "Could you tell me more about any specific user roles, permissions, or rules needed for this feature?"
)

def _parse_dynamic_atoms(atom_summary: str) -> List[Dict[str, str]]:
    """Dynamically parses structured requirement atoms from atom_summary without hardcoding."""
    parsed = []
    if not atom_summary:
        return parsed
    for line in atom_summary.split("\n"):
        line = line.strip()
        if not line or not ("Subject:" in line or "Action:" in line):
            continue
        atom_info = {}
        for part in line.split(" | "):
            if ":" in part:
                k, v = part.split(":", 1)
                atom_info[k.strip().lower()] = v.strip()
        if atom_info:
            parsed.append(atom_info)
    return parsed

def generate_contextual_response(
    user_message: str,
    project_name: str,
    history: List[Dict[str, Any]],
    project_context: Optional[Dict[str, Any]] = None,
) -> str:
    import re
    msg = (user_message or "").strip().lower()
    ctx = project_context or {}
    atom_summary = ctx.get("atom_summary", "")
    pending_conflicts = ctx.get("pending_conflicts_summary", "").strip()
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
    dynamic_atoms = _parse_dynamic_atoms(atom_summary)


    if pending_conflicts:

        is_asking_spec = any(k in msg for k in [
            "what", "which", "show", "tell me", "list", "who", "how", "requirements", "choice", "language", "database", "stack", "tech", "role", "platform"
        ])
        if is_asking_spec:

            conflict_words = set(re.findall(r'[a-zA-Z0-9_]{3,}', pending_conflicts.lower()))
            msg_words = set(re.findall(r'[a-zA-Z0-9_]{3,}', msg))
            common_topics = (conflict_words & msg_words) - {"the", "and", "for", "with", "what", "which", "are", "project", "wait", "you", "now", "use"}

            is_general_stack_query = any(q in msg for q in ["what programming", "what language", "which language", "what tech", "what backend", "programming lan"]) and\
                any(k in pending_conflicts.lower() for k in ["backend", "framework", "language", "stack", "tech", "platform"])
            is_general_db_query = any(q in msg for q in ["what database", "which database", "what db", "which db", "what data base"]) and\
                any(k in pending_conflicts.lower() for k in ["database", "storage", "db"])
            is_general_role_query = any(q in msg for q in ["what role", "who are the user", "what access", "permissions"]) and\
                any(k in pending_conflicts.lower() for k in ["role", "user", "access", "permission", "admin", "customer", "manager"])

            if common_topics or is_general_stack_query or is_general_db_query or is_general_role_query:
                return (
                    f"There is currently an active contradiction pending review for **{project_name}**:\n\n"
                    f"{pending_conflicts}\n\n"
                    f"Neither choice has been finalized or replaced yet. The proposed change is under pending review by the development team, and the previously established baseline requirement remains the active specification until approved."
                )


    if any(q in msg for q in ["what programming", "what language", "which language", "what tech", "what backend", "programming lan", "tech stack", "technology stack"]):
        tech_atoms = [
            a.get("action", "") or a.get("constraint", "")
            for a in dynamic_atoms
            if any(k in a.get("subject", "").lower() for k in ["tech", "stack", "architecture", "backend", "frontend", "language"])
        ]
        if tech_atoms:
            tech_str = ", ".join(tech_atoms)
            return (
                f"For **{project_name}**, the recorded technology choices are: **{tech_str}**.\n\n"
                f"Would you like to adjust these technical specifications or add any other requirements?"
            )

        # Fallback: scan raw atom_summary text for backend tech keywords
        backend_kw = {"python": "Python", "django": "Django", "fastapi": "FastAPI", "java": "Java",
                      "spring": "Spring Boot", "ruby": "Ruby on Rails", "node": "Node.js",
                      "golang": "Golang", "rust": "Rust", "php": "PHP"}
        if atom_summary:
            found_techs = [name for kw, name in backend_kw.items() if kw in atom_summary.lower()]
            if found_techs:
                return (
                    f"For **{project_name}**, the confirmed backend technology is: **{', '.join(found_techs)}**.\n\n"
                    f"Would you like to explore any other area of the project?"
                )

        # Only ask if truly nothing is recorded
        if not atom_summary:
            return (
                f"We haven't finalized the programming language or technology stack for **{project_name}** yet.\n\n"
                f"Do you have a preferred stack, or would you like me to note specific technical requirements?"
            )
        # If atom_summary exists but didn't match, let LLM handle it
        return None


    if any(q in msg for q in ["what database", "which database", "what db", "which db", "what data base", "storage"]):
        db_atoms = [
            a.get("action", "") or a.get("constraint", "")
            for a in dynamic_atoms
            if any(k in a.get("subject", "").lower() for k in ["database", "storage", "data"])
        ]
        if db_atoms:
            db_str = ", ".join(db_atoms)
            return (
                f"For **{project_name}**, the recorded database engine is: **{db_str}**.\n\n"
                f"Would you like to configure specific database requirements or proceed with other features?"
            )

        # Fallback: scan raw atom_summary text for DB keywords
        db_kw = {"postgresql": "PostgreSQL", "postgres": "PostgreSQL", "postgree": "PostgreSQL",
                 "mysql": "MySQL", "mongodb": "MongoDB", "sqlite": "SQLite"}
        if atom_summary:
            found_dbs = [name for kw, name in db_kw.items() if kw in atom_summary.lower()]
            if found_dbs:
                return (
                    f"For **{project_name}**, the confirmed database is: **{found_dbs[0]}**.\n\n"
                    f"Would you like to configure any other area?"
                )

        if not atom_summary:
            return (
                f"We haven't recorded a specific database engine for **{project_name}** yet.\n\n"
                f"What database or storage system would you prefer to use?"
            )
        return None


    if any(q in msg for q in ["what role", "who are the user", "what user", "what access", "permissions"]):
        role_atoms = [
            a.get("action", "") or a.get("constraint", "")
            for a in dynamic_atoms
            if any(k in a.get("subject", "").lower() for k in ["role", "user", "access", "permission", "auth"])
        ]
        if role_atoms:
            role_str = ", ".join(role_atoms)
            return (
                f"For **{project_name}**, the recorded user roles and access rules are: **{role_str}**.\n\n"
                f"Would you like to modify any role permissions or add other workflows?"
            )

        return (
            f"We haven't finalized the user roles or access permissions for **{project_name}** yet.\n\n"
            f"What distinct user types or access tiers (such as Administrator, Standard User, or Guest) will use the system?"
        )

    # ── Feature & functional requirement queries ──
    if any(q in msg for q in ["what are the features", "what feature", "which feature", "list features", "show features", "features captured", "features we have", "what have we decided", "features so far", "what requirements", "show requirements", "list requirements"]):
        features_list = []
        for a in dynamic_atoms:
            subj = a.get("subject", "Feature")
            action = a.get("action", "") or a.get("constraint", "")
            raw = a.get("raw_text", "")
            desc = action or raw
            if desc:
                features_list.append(f"• **{subj}:** {desc}")

        if not features_list and atom_summary:
            for line in atom_summary.split("\n"):
                if line.strip():
                    features_list.append(f"• {line.strip()}")

        if features_list:
            feat_text = "\n".join(features_list[:20])
            conflict_notice = f"\n\n⚠️ **Pending Contradiction (Under Review):**\n{pending_conflicts}" if pending_conflicts else ""
            return (
                f"Here are the recorded requirements and features for **{project_name}**:\n\n"
                f"{feat_text}"
                f"{conflict_notice}\n\n"
                f"What additional workflow or feature would you like to define next?"
            )
        else:
            return (
                f"We haven't recorded specific features for **{project_name}** yet.\n\n"
                f"What core functionality or user workflows would you like to build?"
            )


    is_briefing = any(k in msg for k in [
        "brief me", "technolog", "tech stack", "end to end", "entire", "what all",
        "what do we have", "what have we", "what we have", "recap", "summary",
        "overview", "what are the requirements", "list requirements", "show requirements",
        "show me the requirements", "requirements captured", "what requirements", "tell me the requirements"
    ])

    if is_briefing:
        frontend_tech = []
        backend_tech = []
        db_tech = []
        msg_tech = []


        search_target = atom_summary.lower() if atom_summary else combined_corpus

        if "react native" in search_target:
            frontend_tech.append("React Native (Cross-platform iOS & Android mobile application)")
        elif "flutter" in search_target:
            frontend_tech.append("Flutter (Cross-platform mobile application)")
        elif "react" in search_target:
            frontend_tech.append("React (Web Application)")

        if "java" in search_target:
            backend_tech.append("Java / Spring Boot (Backend API)")
        elif "ruby" in search_target or "rails" in search_target:
            backend_tech.append("Ruby on Rails (Backend API)")
        elif "python" in search_target or "fastapi" in search_target or "django" in search_target:
            backend_tech.append("Python / FastAPI (Backend API)")
        elif "node" in search_target:
            backend_tech.append("Node.js / Express (Backend services)")
        elif "golang" in search_target or "go" in search_target:
            backend_tech.append("Go (Backend API)")

        if "postgis" in search_target:
            db_tech.append("PostgreSQL with PostGIS extension")
        elif "postgres" in search_target or "postgree" in search_target:
            db_tech.append("PostgreSQL Database")
        elif "mongo" in search_target:
            db_tech.append("MongoDB Database")
        elif "mysql" in search_target:
            db_tech.append("MySQL Database")

        if "firebase" in search_target or "fcm" in search_target or "push notification" in search_target:
            msg_tech.append("Firebase Cloud Messaging (FCM)")


        if pending_conflicts:
            if any(k in pending_conflicts.lower() for k in ["backend", "framework", "language", "python", "java", "ruby", "rails", "node"]):
                backend_tech = ["Under Review / Conflict Pending Resolution"]
            if any(k in pending_conflicts.lower() for k in ["database", "postgres", "mysql", "mongo", "sqlite"]):
                db_tech = ["Under Review / Conflict Pending Resolution"]
            if any(k in pending_conflicts.lower() for k in ["platform", "mobile", "web", "desktop"]):
                frontend_tech = ["Under Review / Conflict Pending Resolution"]

        frontend_line = frontend_tech[0] if frontend_tech else "Web / Mobile Interface (To be finalized)"
        backend_line = backend_tech[0] if backend_tech else "Backend Services (To be finalized)"
        db_line = db_tech[0] if db_tech else "Database Layer (To be finalized)"
        msg_line = msg_tech[0] if msg_tech else "Notification Service"

        conflict_block = ""
        if pending_conflicts:
            conflict_block = f"\n\n⚠️ **Pending Contradictions (Under Review):**\n{pending_conflicts}\n"

        return (
            f"Here are the captured specifications recorded for **{project_name}**:\n\n"
            f"• **Backend & Tech Stack:** {backend_line}\n"
            f"• **Database:** {db_line}\n"
            f"• **Frontend / Client:** {frontend_line}\n"
            f"• **Notifications & Services:** {msg_line}"
            f"{conflict_block}\n\n"
            f"Everything is structured and tracked. If all requirements are complete, please **End the Session** so I can forward these specifications directly to the development team to generate the formal SRS document!"
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
            f"Understood! All functional and technical specifications for **{project_name}** have been successfully captured:\n\n"
            f"• **Technology & Database:** Structured and recorded for engineering.\n"
            f"• **User Roles & Access:** Permissions and roles clearly defined.\n"
            f"• **Workflows & Operations:** Business rules and lifecycle steps saved.\n\n"
            f"Everything is organized and ready. Please click **End Session** to conclude our session and forward the full specifications to the development team for SRS compilation and implementation!"
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
        "golang": "Golang",
        "go lang": "Golang",
        "go language": "Golang",
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
    sorted_tech_kw = sorted(tech_keywords.items(), key=lambda item: len(item[0]), reverse=True)
    found_tech = []
    seen_tech_labels = set()
    for k, v in sorted_tech_kw:
        if contains_keyword(msg, k) and v not in seen_tech_labels:
            seen_tech_labels.add(v)
            found_tech.append(v)
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
                f"Understood! All key functional requirements, user access roles, workflows, and specifications for **{project_name}** have been recorded.\n\n"
                f"If you are finished adding requirements, please click **End Session** so I can forward these specifications directly to the development team to generate your formal SRS document!"
            )

    clean_snippet = user_message.strip()
    if len(clean_snippet) > 80:
        clean_snippet = clean_snippet[:80] + "..."

    if not has_roles:
        return (
            f"Understood! What distinct user roles (such as Admin, Customer, or Staff) and login methods will be used to access this feature?"
        )
    elif not has_workflows:
        return (
            f"Got it! What are the expected step-by-step user actions, inputs, and validation rules for this workflow?"
        )
    else:
        return (
            f"Noted! Are there any additional business constraints, edge cases, or security considerations for this feature?"
        )

def _detect_client_tone(history: List[Dict[str, Any]], current_msg: str = "") -> str:
    import re
    recent_client_msgs = [
        (m.get("content") or "").strip().lower()
        for m in (history or [])[-6:]
        if m.get("sender") in ("client", "user") or m.get("role") == "user"
    ]
    if current_msg:
        recent_client_msgs.append(current_msg.strip().lower())

    combined = " ".join(recent_client_msgs[-3:])

    frustrated_patterns = [r"\balready told\b", r"\balready said\b", r"\bi said\b", r"\byou keep\b", r"\bagain\b", r"\bstop asking\b", r"\bwhy are you\b", r"\bi mentioned\b", r"\btold you\b"]
    if any(re.search(p, combined) for p in frustrated_patterns):
        return "frustrated"

    confused_patterns = [r"\bdon't understand\b", r"\bdont understand\b", r"\bwhat do you mean\b", r"\bconfused\b", r"\bnot sure what\b", r"\bcan you explain\b"]
    if any(re.search(p, combined) for p in confused_patterns):
        return "confused"

    tech_patterns = [r"\bapi\b", r"\bendpoint\b", r"\bschema\b", r"\bdatabase\b", r"\bmicroservice\b", r"\barchitecture\b", r"\bdocker\b", r"\bkubernetes\b", r"\bsql\b", r"\bnosql\b", r"\bjwt\b", r"\boauth\b"]
    if any(re.search(p, combined) for p in tech_patterns):
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
            pending_conflicts_summary=ctx.get("pending_conflicts_summary", ""),
            tone=tone,
            is_ongoing=is_ongoing,
        )
        if tone != "normal":
            system_prompt += f"\n\nCURRENT CLIENT TONE: {tone.upper()}. Adjust your response according to the tone rules above."

        messages = [{"role": "system", "content": system_prompt}]
        recent_history = history[-16:] if len(history) > 16 else history
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
            fast_model = getattr(settings, 'GROQ_FAST_MODEL', 'openai/gpt-oss-20b')
            main_model = getattr(settings, 'GROQ_MODEL', 'qwen/qwen3.8-27b')
            _valid_fallbacks = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
            candidates = [main_model, fast_model] + [m for m in _valid_fallbacks if m not in (main_model, fast_model)]

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
                        temperature=0.7,
                        timeout=min(settings.GROQ_TIMEOUT_SECONDS, 10),
                    )
                    if response and response.choices:
                        break
                except Exception as _model_err:
                    logger.warning("Model %s failed: %s", model_cand, _model_err)
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
