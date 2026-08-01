import logging
from typing import List
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_model = None

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading embedding model: {settings.embedding_model}")
        _model = SentenceTransformer(settings.embedding_model)
    return _model

from functools import lru_cache

@lru_cache(maxsize=1024)
def _cached_encode(text: str) -> List[float]:
    model = get_model()
    embedding = model.encode(text)
    return embedding.tolist()

class EmbeddingService:
    @staticmethod
    def get_embedding(text: str) -> List[float]:
        """Generate embedding vector for a given text (cached)."""
        return _cached_encode(text)

    @staticmethod
    def embed(text: str) -> List[float]:
        """Alias for get_embedding — use this for consistency across callers."""
        return _cached_encode(text)

    @staticmethod
    def preload_model() -> None:
        """Pre-warm SentenceTransformer model during app startup so cold-start delay is zero."""
        try:
            get_model()
            logger.info("SentenceTransformer embedding model pre-loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not preload embedding model: {e}")

    @staticmethod
    def get_model_info() -> dict:
        """Get the model metadata."""
        return {
            "embedding_model": settings.embedding_model,
            "embedding_version": settings.embedding_version
        }
