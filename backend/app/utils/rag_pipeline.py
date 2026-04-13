"""
Vanilla RAG pipeline for document-level Q&A (Feature 2).

Flow
----
Upload  → index_document_task()
              ↓
          extract_text_from_pdf()          [stops at References, handles tables/images]
              ↓
          chunk_text()                     [300-char chunks, 100-char overlap]
              ↓
          ollama_client.embed()            [nomic-embed-text via Ollama]
              ↓
          faiss_store.save_document()      [L2-normalised IndexFlatIP on disk]

Query   → query_document()
              ↓
          embed question                   [nomic-embed-text]
              ↓
          faiss_store.query_similar_chunks() top-5 by cosine similarity
              ↓
          Ollama generate answer           [llama3.2:3b]
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional

from sqlalchemy.orm import Session

from app import models
from app.utils.pdf import extract_text_from_pdf
from app.utils import ollama_client
from app.utils.faiss_store import save_document, count_chunks, query_similar_chunks

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

TOP_K = 5  # number of chunks retrieved from FAISS and passed directly to the LLM


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str, chunk_size: int = 300, overlap: int = 100) -> list[str]:
    """
    Split `text` into overlapping character-level chunks.

    Boundary preference (descending priority):
      1. Sentence end  — '. ', '? ', '! ' near the target position.
      2. Word boundary — last space before the target position.
      3. Hard cut      — exactly at chunk_size.

    Chunks shorter than 20 characters are dropped.
    """
    if not text or not text.strip():
        return []

    text = text.strip()
    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        if end >= len(text):
            tail = text[start:].strip()
            if len(tail) >= 20:
                chunks.append(tail)
            break

        search_floor = start + chunk_size // 2
        break_point = end

        found = False
        for i in range(end, search_floor, -1):
            if text[i] in ".!?" and i + 1 < len(text) and text[i + 1] in " \n":
                break_point = i + 1
                found = True
                break

        if not found:
            for i in range(end, search_floor, -1):
                if text[i] == " ":
                    break_point = i
                    break

        chunk = text[start:break_point].strip()
        if len(chunk) >= 20:
            chunks.append(chunk)

        next_start = break_point - overlap
        start = next_start if next_start > start else break_point

    return chunks


# ---------------------------------------------------------------------------
# Indexing
# ---------------------------------------------------------------------------

def index_document_task(doc_id: int, filepath: str) -> None:
    """Entry point for FastAPI BackgroundTask — creates its own DB session."""
    from app.database import SessionLocal

    db: Session = SessionLocal()
    try:
        _index_document(doc_id, filepath, db)
    finally:
        db.close()


def _index_document(doc_id: int, filepath: str, db: Session) -> None:
    status: Optional[models.DocumentEmbeddingStatus] = (
        db.query(models.DocumentEmbeddingStatus)
        .filter(models.DocumentEmbeddingStatus.document_id == doc_id)
        .first()
    )

    try:
        logger.info("[doc %d] Extracting text from %s", doc_id, filepath)
        text = extract_text_from_pdf(filepath)

        if not text.strip():
            raise ValueError(
                "No extractable text found. The PDF may be scanned (image-only) "
                "or password-protected."
            )

        chunks = chunk_text(text, chunk_size=300, overlap=100)
        if not chunks:
            raise ValueError("Text was extracted but no valid chunks were produced.")

        logger.info("[doc %d] %d chunks created", doc_id, len(chunks))

        embeddings: list[list[float]] = []
        for i, chunk in enumerate(chunks):
            try:
                vec = ollama_client.embed(chunk)
                embeddings.append(vec)
            except Exception as emb_err:
                raise RuntimeError(
                    f"Embedding failed at chunk {i}. "
                    "Is Ollama running? Have you pulled nomic-embed-text?"
                ) from emb_err

        save_document(doc_id, chunks, embeddings)
        logger.info("[doc %d] Saved FAISS index with %d chunks", doc_id, len(chunks))

        if status:
            status.is_indexed = 1
            status.chunk_count = len(chunks)
            status.indexed_at = datetime.now(IST)
            status.error_message = None

    except Exception as exc:
        logger.exception("[doc %d] Indexing failed: %s", doc_id, exc)
        if status:
            status.is_indexed = 2
            status.error_message = str(exc)[:500]

    finally:
        db.commit()


# ---------------------------------------------------------------------------
# Querying
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are a precise research-paper assistant. "
    "Answer the user's question using ONLY the context excerpts provided below. "
    "Cite specific details from the excerpts when possible. "
    "If the excerpts do not contain enough information to answer the question, "
    "say so clearly rather than guessing or hallucinating."
)


def query_document(doc_id: int, question: str) -> str:
    """
    Answer `question` about `doc_id` using vanilla RAG:
      embed question → FAISS top-5 cosine similarity → LLM answer.
    Never raises — errors are returned as user-readable strings.
    """
    try:
        if count_chunks(doc_id) == 0:
            return (
                "This document has not been indexed yet. "
                "Please wait for indexing to complete and try again."
            )

        try:
            q_vec = ollama_client.embed(question)
        except Exception as e:
            return (
                f"Could not reach Ollama for embedding: {e}. "
                "Please make sure Ollama is running."
            )

        top_chunks = query_similar_chunks(doc_id, q_vec, top_k=TOP_K)
        if not top_chunks:
            return "No relevant passages were found in this document for your question."

        context = "\n\n---\n\n".join(
            f"[Excerpt {i + 1}]\n{chunk}" for i, chunk in enumerate(top_chunks)
        )
        prompt = (
            f"Context excerpts from the document:\n\n"
            f"{context}\n\n"
            f"Question: {question}\n\n"
            f"Answer:"
        )

        try:
            answer = ollama_client.generate(prompt, system=_SYSTEM_PROMPT)
        except Exception as e:
            return (
                f"Could not reach Ollama for answer generation: {e}. "
                "Please make sure Ollama is running."
            )

        return answer.strip()

    except Exception as exc:
        logger.exception("query_document failed for doc %s: %s", doc_id, exc)
        return f"An unexpected error occurred while querying the document: {exc}"
