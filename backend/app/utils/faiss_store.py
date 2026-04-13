"""
FAISS-based persistent vector store — replaces ChromaDB.

Why FAISS instead of ChromaDB?
  ChromaDB (all versions ≤1.5.0) imports `pydantic.v1` which is incompatible
  with Python 3.14+. FAISS is a pure C++/CUDA library with Python bindings that
  has no pydantic dependency and ships native Python 3.14 wheels.

Layout on disk
--------------
./faiss_store/
    doc_{id}/
        index.faiss   — FAISS IndexFlatIP (inner-product index on L2-normalised
                         vectors, equivalent to cosine similarity)
        chunks.json   — ordered list of text strings (same order as FAISS rows)

Cosine similarity via inner product
------------------------------------
FAISS's IndexFlatIP computes dot products. If we L2-normalise every vector
before adding it to the index (and also normalise every query vector at search
time), the dot product equals cosine similarity. This is the standard pattern
for cosine retrieval with FAISS.
"""

import json
import shutil
from pathlib import Path

import faiss
import numpy as np

STORE_ROOT = Path("./faiss_store")


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def _doc_dir(doc_id: int) -> Path:
    return STORE_ROOT / f"doc_{doc_id}"


def _index_path(doc_id: int) -> Path:
    return _doc_dir(doc_id) / "index.faiss"


def _chunks_path(doc_id: int) -> Path:
    return _doc_dir(doc_id) / "chunks.json"


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def save_document(
    doc_id: int,
    chunks: list[str],
    embeddings: list[list[float]],
) -> None:
    """
    Persist `chunks` and their `embeddings` for `doc_id`.
    Overwrites any previously stored data for this document.

    Vectors are L2-normalised before storing so that IndexFlatIP returns
    cosine similarity scores directly.
    """
    doc_dir = _doc_dir(doc_id)
    doc_dir.mkdir(parents=True, exist_ok=True)

    arr = np.array(embeddings, dtype=np.float32)

    # L2-normalise in place (each row becomes a unit vector)
    faiss.normalize_L2(arr)

    dim = arr.shape[1]
    index = faiss.IndexFlatIP(dim)   # inner-product = cosine after normalisation
    index.add(arr)

    faiss.write_index(index, str(_index_path(doc_id)))

    with open(_chunks_path(doc_id), "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def delete_document(doc_id: int) -> None:
    """
    Remove the FAISS index and chunk list for a document.
    Silently does nothing if the document was never indexed.
    """
    doc_dir = _doc_dir(doc_id)
    if doc_dir.exists():
        shutil.rmtree(doc_dir)


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def count_chunks(doc_id: int) -> int:
    """Return the number of indexed chunks, or 0 if not yet indexed."""
    cp = _chunks_path(doc_id)
    if not cp.exists():
        return 0
    with open(cp, encoding="utf-8") as f:
        data = json.load(f)
    return len(data)


# ---------------------------------------------------------------------------
# Similarity search
# ---------------------------------------------------------------------------

def query_similar_chunks(
    doc_id: int,
    query_embedding: list[float],
    top_k: int = 15,
) -> list[str]:
    """
    Return the `top_k` chunks most similar to `query_embedding`.

    Returns an empty list when the document is not yet indexed or has no chunks.
    """
    ip = _index_path(doc_id)
    cp = _chunks_path(doc_id)

    if not ip.exists() or not cp.exists():
        return []

    with open(cp, encoding="utf-8") as f:
        chunks: list[str] = json.load(f)

    if not chunks:
        return []

    index = faiss.read_index(str(ip))

    # Normalise query vector to match how index vectors were stored
    q = np.array([query_embedding], dtype=np.float32)
    faiss.normalize_L2(q)

    k = min(top_k, len(chunks))
    _scores, indices = index.search(q, k)   # returns (1, k) arrays

    return [chunks[int(i)] for i in indices[0] if i != -1]
