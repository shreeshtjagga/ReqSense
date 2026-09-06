import logging
from functools import lru_cache
from typing import List

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_model = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model


@lru_cache(maxsize=1024)
def _cached_encode(text: str) -> List[float]:
    model = get_model()
    embedding = model.encode(text)
    return embedding.tolist()


class EmbeddingService:
    @staticmethod
    def get_embedding(text: str) -> List[float]:
        return _cached_encode(text)

    @staticmethod
    def embed(text: str) -> List[float]:
        return _cached_encode(text)

    @staticmethod
    def preload_model() -> None:
        try:
            get_model()
            logger.info("SentenceTransformer embedding model pre-loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not preload embedding model: {e}")

    @staticmethod
    def get_model_info() -> dict:
        return {
            "embedding_model": settings.EMBEDDING_MODEL,
            "embedding_version": settings.EMBEDDING_VERSION
        }
