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
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((groq.APIConnectionError, groq.APITimeoutError)),
        reraise=True
    )
    def generate_response(
        cls,
        history: List[Dict[str, Any]],
        user_message: str,
        project_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if settings.groq_is_mocked:
            logger.info("[MOCK GROQ] Generating mock response")
            project_name = (project_context or {}).get("name", "this project")
            return {
                "content": f"ARIA mock reply for {project_name}: {user_message}",
                "prompt_tokens": 10,
                "completion_tokens": 20
            }

        client = get_groq_client()
        messages = cls._build_messages(history, user_message, project_context)

        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=messages,
                max_tokens=300,
                timeout=settings.GROQ_TIMEOUT_SECONDS
            )

            content = response.choices[0].message.content
            prompt_tokens = response.usage.prompt_tokens if response.usage else 0
            completion_tokens = response.usage.completion_tokens if response.usage else 0

            return {
                "content": content,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens
            }
        except groq.RateLimitError as rle:
            logger.warning(f"Groq RateLimitError encountered: {rle}")
            raise
        except groq.APIStatusError as ase:
            logger.error(f"Groq APIStatusError (status {ase.status_code}): {ase.message}")
            raise
