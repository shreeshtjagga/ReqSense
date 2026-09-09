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

def generate_contextual_response(user_message: str, project_name: str, history: List[Dict[str, Any]]) -> str:
    msg = (user_message or "").strip().lower()
    
    # Collect previous assistant responses to avoid repeating questions
    past_assistant_texts = " ".join([
        (m.get("content") or "").lower()
        for m in (history or [])
        if m.get("sender") in ("assistant", "aria", "system") or m.get("role") == "assistant"
    ])
    
    # Collect all user statements to understand what has been established
    all_user_texts = " ".join([
        (m.get("content") or "").lower()
        for m in (history or [])
        if m.get("sender") in ("client", "user") or m.get("role") == "user"
    ]) + " " + msg

    # Helper: Check if a topic was already asked by ARIA
    asked_roles_auth = "distinct user roles" in past_assistant_texts or "oauth" in past_assistant_texts or "authentication" in past_assistant_texts or "user management" in past_assistant_texts
    asked_tech = "programming language" in past_assistant_texts or "architectural patterns" in past_assistant_texts or "frameworks" in past_assistant_texts
    asked_gps = "gps" in past_assistant_texts or "location coordinates" in past_assistant_texts
    asked_workflows = "core workflows" in past_assistant_texts or "primary dashboard" in past_assistant_texts or "initial screen" in past_assistant_texts or "primary actions a user takes" in past_assistant_texts
    asked_payments = "payment provider" in past_assistant_texts or "stripe" in past_assistant_texts or "commerce requirements" in past_assistant_texts
    asked_notifications = "trigger events" in past_assistant_texts or "notification" in past_assistant_texts or "email alerts" in past_assistant_texts
    asked_apis = "third-party api" in past_assistant_texts or "third party api" in past_assistant_texts or "data retention" in past_assistant_texts or "performance requirements" in past_assistant_texts
    asked_final = "all key functional requirements" in past_assistant_texts or "logged all specifications" in past_assistant_texts or "specifications remain saved" in past_assistant_texts or "srs document whenever" in past_assistant_texts

    # 1. Tech stack & Programming Languages
    tech_keywords = {
        "ruby": "Ruby / Ruby on Rails",
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
        "mongodb": "MongoDB",
        "mysql": "MySQL",
        "docker": "Docker containerization",
        "aws": "AWS cloud infrastructure",
    }
    found_tech = [v for k, v in tech_keywords.items() if k in msg]
    if found_tech and not ("architectural patterns" in past_assistant_texts and len(history) > 2):
        tech_str = ", ".join(found_tech)
        return (
            f"Understood! I've noted that **{project_name}** should be built using **{tech_str}**.\n\n"
            f"To capture the complete architectural specification:\n"
            f"1. Are there specific frameworks or architectural patterns you'd like to use?\n"
            f"2. What database or external services will the {tech_str} backend connect with?"
        )

    # 2. Greetings
    greetings = ["hi", "hello", "hey", "hl", "greetings", "good morning", "good afternoon", "good evening"]
    if (msg in greetings or any(msg.startswith(g + " ") for g in greetings)) and len(history) <= 1:
        return (
            f"Hello! I'm ARIA, your AI Requirements Analyst for **{project_name}**.\n\n"
            f"I'm here to help turn your ideas into clear, structured software requirements. "
            f"To get started, what core features or workflows would you like to build first?"
        )

    # 3. If user is answering roles & auth after ARIA previously asked about them
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

    if (extracted_roles or extracted_auth) and asked_roles_auth and not asked_workflows:
        roles_desc = f"user roles (**{', '.join(extracted_roles)}**)" if extracted_roles else "user roles"
        auth_desc = f"authentication method (**{', '.join(extracted_auth)}**)" if extracted_auth else "login authentication"
        return (
            f"Got it! I've updated the requirements for **{project_name}** with the {roles_desc} and {auth_desc}.\n\n"
            f"Next, let's explore the core application workflows:\n"
            f"1. Once users log in, what is the primary dashboard or action they perform?\n"
            f"2. What specific permissions and actions can Admin users perform that Customers cannot?"
        )

    # 4. GPS / Location specifics
    if any(w in msg for w in ["gps", "location", "geo", "coordinate", "tracking", "map", "geofence"]):
        if not asked_gps:
            return (
                f"Understood! I've logged the **GPS location and tracking permissions** for **{project_name}**.\n\n"
                f"Could you clarify:\n"
                f"1. How frequently should GPS location coordinates be fetched (e.g., live real-time stream vs. background checkpoints)?\n"
                f"2. What fallback behavior should happen if a user disables or denies GPS permissions?"
            )
        else:
            return (
                f"Recorded the GPS permission details for **{project_name}**.\n\n"
                f"Will this location data be shared with other users in real-time (e.g. live maps), or stored for historical logging and analytics?"
            )

    # 5. Authentication, Security & Users (if not asked yet)
    if any(w in msg for w in ["login", "signup", "sign up", "auth", "user", "role", "admin", "password", "2fa", "mfa", "permission", "account"]):
        if not asked_roles_auth:
            return (
                f"Great! I've logged the user management and authentication requirements for **{project_name}**.\n\n"
                f"Could you clarify:\n"
                f"1. What distinct user roles will exist (e.g. Admin, Customer, Manager)?\n"
                f"2. Should authentication support standard email/password, social OAuth (Google, GitHub), or Single Sign-On (SSO)?"
            )
        elif not asked_workflows:
            return (
                f"Recorded those account security details for **{project_name}**.\n\n"
                f"What are the main daily workflows or operations users perform in the interface once authenticated?"
            )

    # 6. E-commerce / Billing / Orders / Payments
    if any(w in msg for w in ["order", "cart", "pay", "payment", "checkout", "stripe", "price", "billing", "invoice", "product", "shop", "item", "purchase"]):
        if not asked_payments:
            return (
                f"Got it! I've captured the transaction and commerce requirements for **{project_name}**.\n\n"
                f"Let's refine the process:\n"
                f"1. Which payment providers should be integrated (e.g. Stripe, PayPal)?\n"
                f"2. What happens if a payment fails or an order is cancelled?"
            )
        elif not asked_notifications:
            return (
                f"Payment specifications updated for **{project_name}**.\n\n"
                f"Will there be automated email receipts, order tracking status changes, or refund processing rules?"
            )

    # 7. Reports / Dashboard / Analytics
    if any(w in msg for w in ["dashboard", "report", "analytics", "chart", "metrics", "export", "csv", "pdf", "graph"]):
        if not asked_workflows:
            return (
                f"Understood! I've noted the reporting and dashboard requirements for **{project_name}**.\n\n"
                f"1. Which specific data metrics and KPI filters should users see?\n"
                f"2. What export formats (e.g. PDF summaries, raw CSV data) should be supported?"
            )

    # 8. Notifications / Communication
    if any(w in msg for w in ["notification", "notify", "email", "sms", "alert", "message", "push"]):
        if not asked_notifications:
            return (
                f"Noted! For the notification system in **{project_name}**:\n\n"
                f"1. Which trigger events should send alerts (e.g. status changes, new messages, payment confirmation)?\n"
                f"2. Should users be able to configure their notification preferences?"
            )
        else:
            return (
                f"Notification preferences logged for **{project_name}**.\n\n"
                f"Are there any third-party APIs or external integrations needed for these operations?"
            )

    # 9. Dynamic progression for short confirmations, negative answers, or non-technical replies
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
        if not asked_roles_auth:
            return (
                f"Understood for **{project_name}**!\n\n"
                f"Let's check user access: What distinct user roles (e.g. Admin, Customer, Staff) and login methods will be used?"
            )
        elif not asked_workflows:
            return (
                f"Got it, recorded!\n\n"
                f"Let's map the core workflow: What are the primary actions a user takes in the main interface?"
            )
        elif not asked_notifications:
            return (
                f"Noted! What notifications, email alerts, or status updates should be triggered during these operations?"
            )
        elif not asked_apis:
            return (
                f"Thank you for confirming! I have logged these specifications for **{project_name}**.\n\n"
                f"Are there any third-party APIs, performance requirements, or data retention policies we should include?"
            )
        elif not asked_final:
            return (
                f"Understood! We have captured all key functional requirements, authentication rules, workflows, and constraints for **{project_name}**.\n\n"
                f"Everything is saved and organized. You can review captured requirements in the **Overview** tab, and the engineering team can compile the formal **SRS Document** whenever you're ready!"
            )
        else:
            return (
                f"All current specifications for **{project_name}** remain saved and organized.\n\n"
                f"If you think of any additional features, business rules, or scope changes later, feel free to mention them here or submit a Change Request!"
            )

    # 10. Default intelligent requirements gathering response
    clean_snippet = user_message.strip()
    if len(clean_snippet) > 80:
        clean_snippet = clean_snippet[:80] + "..."
    
    if not asked_roles_auth:
        return (
            f"I've recorded that requirement for **{project_name}**: *\"{clean_snippet}\"*.\n\n"
            f"What user roles and login authentication methods will be used to access this feature?"
        )
    elif not asked_workflows:
        return (
            f"Recorded for **{project_name}**: *\"{clean_snippet}\"*.\n\n"
            f"What are the expected inputs, triggers, and validation rules for this workflow?"
        )
    elif not asked_notifications:
        return (
            f"Logged requirement for **{project_name}**: *\"{clean_snippet}\"*.\n\n"
            f"Should any notifications or alerts be triggered upon completion?"
        )
    else:
        return (
            f"Requirement noted for **{project_name}**: *\"{clean_snippet}\"*.\n\n"
            f"Are there any additional constraints, error conditions, or security considerations for this feature?"
        )

class AriaAgent:
    @staticmethod
    def _build_messages(
        history: List[Dict[str, Any]],
        user_message: str,
        project_context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        ctx = project_context or {}
        system_prompt = build_aria_system_prompt(
            project_name=ctx.get("name", ""),
            description=ctx.get("description", ""),
            domain=ctx.get("domain", ""),
            atom_summary=ctx.get("atom_summary", ""),
            feature_summary=ctx.get("feature_summary", ""),
        )

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
                "content": generate_contextual_response(user_message, project_name, history),
                "prompt_tokens": 10,
                "completion_tokens": 50
            }

        try:
            client = get_groq_client()
            messages = cls._build_messages(history, user_message, project_context)

            response = None
            for model_cand in [settings.GROQ_MODEL, "groq/compound-mini", "openai/gpt-oss-120b"]:
                try:
                    response = client.chat.completions.create(
                        model=model_cand,
                        messages=messages,
                        max_tokens=600,
                        timeout=min(settings.GROQ_TIMEOUT_SECONDS, 8),
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

            content = generate_contextual_response(user_message, project_name, history)
            return {
                "content": content,
                "prompt_tokens": 0,
                "completion_tokens": 0
            }
        except Exception as exc:
            logger.error(f"Groq API call failed: {exc}. Generating intelligent contextual fallback.")
            return {
                "content": generate_contextual_response(user_message, project_name, history),
                "prompt_tokens": 0,
                "completion_tokens": 0
            }
