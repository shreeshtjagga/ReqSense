import logging
import uuid
from typing import List, Dict, Any, Optional
import chromadb
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        if settings.CHROMA_MODE == "local":
            logger.info(f"Initializing local ChromaDB client at: {settings.CHROMA_PERSIST_DIRECTORY}")
            _chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        else:
            logger.info("Initializing hosted/remote ChromaDB client")
            # In hosted/cloud mode, we connect via HttpClient.
            # We configure tenant, database, and auth credentials.
            # Cloud Chroma is typically at: https://api.trychroma.com
            # If CHROMA_API_KEY starts with 'test' or 'mock', we fallback to ephemeral client for testing.
            is_mock = (
                not settings.CHROMA_API_KEY or
                settings.CHROMA_API_KEY.startswith("test") or
                settings.CHROMA_API_KEY.startswith("mock")
            )
            if is_mock:
                logger.info("Chroma API key is mock/empty, initializing EphemeralClient for testing")
                _chroma_client = chromadb.EphemeralClient()
            else:
                headers = {}
                if settings.CHROMA_API_KEY:
                    headers["Authorization"] = f"Bearer {settings.CHROMA_API_KEY}"
                
                # By default, use trychroma or custom host. Since host is not in env, we default to trychroma
                host = "https://api.trychroma.com"
                _chroma_client = chromadb.HttpClient(
                    host=host,
                    headers=headers,
                    tenant=settings.CHROMA_TENANT,
                    database=settings.CHROMA_DATABASE
                )
    return _chroma_client


class VectorStore:
    @staticmethod
    def _get_collection_name(session_id: uuid.UUID) -> str:
        # Chroma collections must be between 3 and 63 chars and contain alphanumeric/dash/underscore
        clean_id = str(session_id).replace("-", "_")
        return f"session_{clean_id}"

    @classmethod
    def get_or_create_collection(cls, session_id: uuid.UUID):
        client = get_chroma_client()
        collection_name = cls._get_collection_name(session_id)
        return client.get_or_create_collection(name=collection_name)

    @classmethod
    def upsert_atoms(cls, session_id: uuid.UUID, atoms: List[Dict[str, Any]]) -> None:
        """
        Upsert requirement atoms into session-specific Chroma collection.
        Each atom dict should have: 'id', 'embedding', 'document' (raw_text), and optional 'metadata'.
        """
        if not atoms:
            return

        collection = cls.get_or_create_collection(session_id)
        ids = [str(atom["id"]) for atom in atoms]
        embeddings = [atom["embedding"] for atom in atoms]
        documents = [atom["document"] for atom in atoms]
        metadatas = [atom.get("metadata", {}) for atom in atoms]

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        logger.info(f"Upserted {len(atoms)} atoms to collection {collection.name}")

    @classmethod
    def query_similar_atoms(
        cls,
        session_id: uuid.UUID,
        query_embedding: List[float],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Query the session collection for atoms similar to the query embedding.
        """
        collection = cls.get_or_create_collection(session_id)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=limit
        )

        formatted_results = []
        if results and results.get("ids") and len(results["ids"][0]) > 0:
            for i in range(len(results["ids"][0])):
                formatted_results.append({
                    "id": uuid.UUID(results["ids"][0][i]),
                    "document": results["documents"][0][i] if results.get("documents") else "",
                    "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                    "distance": results["distances"][0][i] if results.get("distances") else 0.0
                })
        return formatted_results
