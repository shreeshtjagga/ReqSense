import logging
import time
from typing import List, Dict, Any, AsyncGenerator
import groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import get_settings
from app.utils.prompts import ARIA_SYSTEM_PROMPT, PROMPT_VERSION

logger = logging.getLogger(__name__)
settings = get_settings()

_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        logger.info("Initializing Groq client")
        # Handle dummy/testing API keys
        api_key = settings.GROQ_API_KEY
        if not api_key or api_key.startswith("test") or api_key.startswith("mock"):
            api_key = "mock_key_for_testing"
        _groq_client = groq.Groq(api_key=api_key)
    return _groq_client


class AriaAgent:
    @staticmethod
    def _build_messages(history: List[Dict[str, Any]], user_message: str) -> List[Dict[str, Any]]:
        messages = [{"role": "system", "content": ARIA_SYSTEM_PROMPT}]
        # Map history messages to role/content
        for msg in history:
            role = "user" if msg.get("sender") == "client" else "assistant"
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
        user_message: str
    ) -> Dict[str, Any]:
        """
        Generates a full response from ARIA.
        Returns a dict: {"content": str, "prompt_tokens": int, "completion_tokens": int}
        """
        client = get_groq_client()
        # Mock logic for tests
        if settings.GROQ_API_KEY.startswith("test") or settings.GROQ_API_KEY.startswith("mock"):
            logger.info("[MOCK GROQ] Generating mock response")
            return {
                "content": f"ARIA mock reply to: {user_message}",
                "prompt_tokens": 10,
                "completion_tokens": 20
            }

        messages = cls._build_messages(history, user_message)
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            max_tokens=250,
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

    @classmethod
    async def stream_aria_response(
        cls,
        history: List[Dict[str, Any]],
        user_message: str
    ) -> AsyncGenerator[str, None]:
        """
        Asynchronously streams the ARIA response token-by-token.
        """
        # Mock logic for tests
        if settings.GROQ_API_KEY.startswith("test") or settings.GROQ_API_KEY.startswith("mock"):
            logger.info("[MOCK GROQ] Streaming mock response")
            words = f"ARIA mock streaming reply to: {user_message}".split(" ")
            for word in words:
                yield word + " "
                time.sleep(0.05)
            return

        client = get_groq_client()
        messages = cls._build_messages(history, user_message)

        # Groq SDK doesn't natively support async client out of the box unless we use AsyncGroq.
        # But we can call synchronous client.chat.completions.create in a thread pool, or stream using normal groq client
        # with include_usage to match token usages.
        # Let's run the sync stream in a thread safe generator or simply yield chunks.
        # In python, running it in executor is standard to avoid blocking event loop.
        import asyncio
        loop = asyncio.get_running_loop()

        def get_stream():
            return client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=messages,
                max_tokens=250,
                stream=True,
                stream_options={"include_usage": True},
                timeout=settings.GROQ_TIMEOUT_SECONDS
            )

        stream = await loop.run_in_executor(None, get_stream)

        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
            # Keep usage if included
            if chunk.usage:
                # We can log usage here or handle it at caller
                pass
