"""
Singleton ChromaDB persistent client.
Each uploaded document gets its own isolated collection named "doc_{document_id}".
This prevents cross-document contamination during RAG queries.

The chroma_store/ directory is created automatically in the backend working directory
(i.e., wherever uvicorn is launched from, typically backend/).
"""

import os

import chromadb

# Opt out of ChromaDB's anonymous usage telemetry without importing Settings
# (the Settings class has a pydantic v1/v2 compat issue in chromadb <0.6.0).
os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")

_client: chromadb.PersistentClient | None = None


def get_client() -> chromadb.PersistentClient:
    """Return the module-level ChromaDB singleton, initialising it on first call."""
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path="./chroma_store")
    return _client


def get_or_create_collection(name: str) -> chromadb.Collection:
    """
    Return an existing collection or create a new one.
    All collections use cosine similarity, which is appropriate for text embeddings.
    """
    client = get_client()
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def collection_name_for_doc(doc_id: int) -> str:
    return f"doc_{doc_id}"


def delete_collection_for_doc(doc_id: int) -> None:
    """
    Remove a document's ChromaDB collection when the document is deleted.
    Silently ignores the case where the collection does not exist yet
    (e.g., indexing failed before the collection was created).
    """
    client = get_client()
    name = collection_name_for_doc(doc_id)
    try:
        client.delete_collection(name)
    except Exception:
        pass
