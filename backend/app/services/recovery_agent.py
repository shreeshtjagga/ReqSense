import logging
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class RecoveryAgent:
    @staticmethod
    def get_connection_fallback_message() -> str:
        """Fallback message when LLM/Chroma is unavailable."""
        return "I am currently experiencing minor connectivity issues. Let's continue capturing your requirements once connection is restored."

    @staticmethod
    def get_contradiction_clarification_message(aria_message: str) -> str:
        """Returns the polite ARIA clarification message formatted for the conversation."""
        return aria_message or "I noticed a small conflict in the requirements. Let's clarify this before moving forward."
