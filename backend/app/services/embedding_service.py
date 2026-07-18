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

class EmbeddingService:
    @staticmethod
    def get_embedding(text: str) -> List[float]:
        """Generate embedding vector for a given text."""
        model = get_model()
        embedding = model.encode(text)
        return embedding.tolist()

    @staticmethod
    def get_model_info() -> dict:
        """Get the model metadata."""
        return {
            "embedding_model": settings.embedding_model,
            "embedding_version": settings.embedding_version
        }
