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
            if settings.chroma_is_mocked:
                logger.info("Chroma API key is mock/empty, initializing EphemeralClient for testing")
                _chroma_client = chromadb.EphemeralClient()
            else:
                headers = {}
                if settings.CHROMA_API_KEY:
                    headers["Authorization"] = f"Bearer {settings.CHROMA_API_KEY}"
                
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
    def _get_collection_name(collection_id: uuid.UUID) -> str:
        clean_id = str(collection_id).replace("-", "_")
        return f"project_{clean_id}"

    @classmethod
    def get_or_create_collection(cls, collection_id: uuid.UUID):
        client = get_chroma_client()
        collection_name = cls._get_collection_name(collection_id)
        return client.get_or_create_collection(name=collection_name)

    @classmethod
    def upsert_atoms(cls, collection_id: uuid.UUID, atoms: List[Dict[str, Any]]) -> None:
        """
        Upsert requirement atoms into project-scoped Chroma collection.
        Each atom dict should have: 'id', 'embedding', 'document' (raw_text), and optional 'metadata'.
        Automatically ensures 'status': 'active' is present in metadata if omitted.
        """
        if not atoms:
            return

        collection = cls.get_or_create_collection(collection_id)
        ids = [str(atom["id"]) for atom in atoms]
        embeddings = [atom["embedding"] for atom in atoms]
        documents = [atom["document"] for atom in atoms]
        
        metadatas = []
        for atom in atoms:
            meta = dict(atom.get("metadata", {}))
            if "status" not in meta:
                meta["status"] = "active"
            metadatas.append(meta)

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        logger.info(f"Upserted {len(atoms)} atoms to collection {collection.name}")

    @classmethod
    def update_atom_status(cls, collection_id: uuid.UUID, atom_id: uuid.UUID, new_status: str) -> None:
        """
        Update the status metadata field of an atom in ChromaDB without re-embedding.
        """
        try:
            collection = cls.get_or_create_collection(collection_id)
            existing = collection.get(ids=[str(atom_id)])
            if existing and existing.get("metadatas") and existing["metadatas"]:
                meta = dict(existing["metadatas"][0])
                meta["status"] = new_status
                collection.update(ids=[str(atom_id)], metadatas=[meta])
                logger.info(f"Updated Chroma atom {atom_id} status to '{new_status}' in collection {collection.name}")
        except Exception as exc:
            logger.warning(f"Failed to update Chroma atom status for {atom_id}: {exc}")

    @classmethod
    def query_similar_atoms(
        cls,
        session_id: uuid.UUID,  # project_id
        query_embedding: List[float],
        limit: int = 5,
        status_filter: str = "active"
    ) -> List[Dict[str, Any]]:
        """
        Query the project collection for active atoms similar to the query embedding.
        Passes where={"status": status_filter} to filter out superseded/resolved atoms natively in Chroma.
        """
        collection = cls.get_or_create_collection(session_id)
        where_clause = {"status": status_filter} if status_filter else None
        
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=where_clause
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

