"""
Research-paper assistant agent.

Architecture: intent router (no external agent framework — avoids Python 3.14
compatibility risk with LangGraph/LangChain).

Flow per message
----------------
1. classify_intent()  — rule-based first; LLM fallback for ambiguous queries.
2. Route to one of four handlers.
3. Return (response_text, intent_name).

Intents
-------
LIST_PAPERS     — list top-5 relevant papers with 1-2 sentence descriptions
COUNT_PAPERS    — count documents matching user criteria
ANSWER_QUESTION — multi-document RAG across all indexed papers
IRRELEVANT      — politely decline unrelated queries
"""

import re
import logging
from typing import Literal

from sqlalchemy.orm import Session

from app import models
from app.utils import ollama_client
from app.utils.faiss_store import query_similar_chunks

logger = logging.getLogger(__name__)

Intent = Literal["LIST_PAPERS", "COUNT_PAPERS", "ANSWER_QUESTION", "IRRELEVANT"]

# How many recent message pairs to include as conversation context
_MAX_HISTORY_PAIRS = 4

# ---------------------------------------------------------------------------
# Regex patterns for fast rule-based classification
# ---------------------------------------------------------------------------

_LIST_RE = re.compile(
    r"\b(list|show\s+me|find|search|what\s+papers?|which\s+papers?|"
    r"papers?\s+(about|on|related\s+to|covering)|research\s+on|"
    r"do\s+you\s+have\s+papers?|any\s+papers?)\b",
    re.IGNORECASE,
)
_COUNT_RE = re.compile(
    r"\b(how\s+many|count|number\s+of|total\s+papers?|how\s+much)\b",
    re.IGNORECASE,
)
_IRRELEVANT_RE = re.compile(
    r"\b(weather|temperature|rain|sunny|forecast|recipe|cook(ing)?|"
    r"food|restaurant|meal|sport|soccer|football|cricket|basketball|"
    r"movie|film|actor|music|song|band|fruit|vegetable|animal|"
    r"stock\s+market|crypto|bitcoin|price|lottery|joke|poem)\b",
    re.IGNORECASE,
)

_INTENT_SYSTEM = (
    "You are an intent classifier for a research-paper assistant. "
    "Classify the user message into exactly ONE of these intents:\n"
    "LIST_PAPERS — user wants to find or list papers on a topic\n"
    "COUNT_PAPERS — user wants to know how many papers match criteria\n"
    "ANSWER_QUESTION — user asks about paper content, concepts, methods, findings\n"
    "IRRELEVANT — query is unrelated to research papers\n"
    "Reply with ONLY the intent name, nothing else."
)

_STOPWORDS = {
    "what", "which", "are", "the", "a", "an", "on", "about", "show",
    "me", "list", "find", "give", "tell", "related", "to", "papers",
    "research", "documents", "studies", "do", "you", "have", "is",
    "was", "were", "of", "in", "for", "and", "or", "any", "all",
    "how", "many", "count", "number", "total",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_history(history: list[dict]) -> str:
    """Format the last N message pairs as plain text for LLM context."""
    pairs = history[-(_MAX_HISTORY_PAIRS * 2):]
    return "\n".join(
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in pairs
    )


def _extract_keywords(query: str) -> list[str]:
    words = re.findall(r"\b\w{3,}\b", query.lower())
    return [w for w in words if w not in _STOPWORDS]


_PREAMBLE_RE = re.compile(
    r"^(here\s+is\s+a\s+.*?:|"
    r"the\s+following\s+is\s+a\s+.*?:|"
    r"below\s+is\s+a\s+.*?:|"
    r"this\s+paper\s+can\s+be\s+summarized\s+as\s*:?)\s*",
    re.IGNORECASE,
)


def _brief_summary(doc: models.Documents, db: Session) -> str:
    """First 2 sentences of cached full summary, stripped of LLM preamble."""
    row = (
        db.query(models.DocumentSummary)
        .filter(
            models.DocumentSummary.document_id == doc.id,
            models.DocumentSummary.summary_type == "full",
        )
        .first()
    )
    if row and row.content.strip():
        text = _PREAMBLE_RE.sub("", row.content.strip())
        sentences = re.split(r"(?<=[.!?])\s+", text)
        brief = " ".join(sentences[:2])
        return (brief[:220] + "...") if len(brief) > 220 else brief
    return "No summary cached — open the document and click **Full Paper Summary** to generate one."


# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

def classify_intent(query: str, history: list[dict]) -> Intent:
    """Rule-based fast path; LLM fallback only for ambiguous queries."""

    if _IRRELEVANT_RE.search(query):
        return "IRRELEVANT"
    if _COUNT_RE.search(query):
        return "COUNT_PAPERS"
    if _LIST_RE.search(query):
        return "LIST_PAPERS"

    # LLM fallback — tight token cap keeps it fast (~5-8 s on CPU)
    history_str = _format_history(history)
    context_line = f"Conversation so far:\n{history_str}\n\n" if history_str else ""
    prompt = f"{context_line}User message: {query}\n\nIntent:"
    try:
        raw = ollama_client.generate(
            prompt, system=_INTENT_SYSTEM, num_predict=12
        ).strip().upper()
        if "LIST" in raw:
            return "LIST_PAPERS"
        if "COUNT" in raw:
            return "COUNT_PAPERS"
        if "IRRELEVANT" in raw:
            return "IRRELEVANT"
    except Exception as exc:
        logger.warning("Intent classification LLM call failed: %s", exc)

    return "ANSWER_QUESTION"  # safe default


# ---------------------------------------------------------------------------
# Handler: LIST_PAPERS
# ---------------------------------------------------------------------------

def handle_list_papers(query: str, db: Session) -> str:
    all_docs = db.query(models.Documents).all()

    if not all_docs:
        return (
            "Your library is empty. Upload some research papers via the "
            "Document Dashboard first."
        )

    keywords = _extract_keywords(query)

    # Score by keyword hits in filename; fall back to all docs if nothing matches
    scored = sorted(
        ((doc, sum(1 for kw in keywords if kw in doc.filename.lower())) for doc in all_docs),
        key=lambda x: x[1],
        reverse=True,
    )
    top = [doc for doc, _ in scored[:5]]

    lines = [f"Found **{len(top)}** paper(s) in your library:\n"]
    for i, doc in enumerate(top, 1):
        brief = _brief_summary(doc, db)
        lines.append(f"**{i}.** [{doc.filename}](/dashboard?view={doc.id})\n{brief}")

    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# Handler: COUNT_PAPERS
# ---------------------------------------------------------------------------

def handle_count_papers(query: str, db: Session) -> str:
    total = db.query(models.Documents).count()

    if total == 0:
        return "There are no papers in the library yet."

    keywords = _extract_keywords(query)
    if not keywords:
        return f"There are **{total}** paper(s) in the library."

    all_docs = db.query(models.Documents).all()
    matches = [
        doc for doc in all_docs
        if any(kw in doc.filename.lower() for kw in keywords)
    ]
    topic = " ".join(keywords[:3])

    if not matches:
        return (
            f"No papers found matching '{topic}'. "
            f"There are **{total}** paper(s) in total."
        )
    return (
        f"Found **{len(matches)}** paper(s) related to '{topic}' "
        f"out of **{total}** total in the library."
    )


# ---------------------------------------------------------------------------
# Handler: ANSWER_QUESTION  (multi-document RAG)
# ---------------------------------------------------------------------------

_QA_SYSTEM = (
    "You are a helpful research assistant. "
    "Answer the user's question using the provided passages from research papers. "
    "When citing content from a specific paper, mention its filename. "
    "Write a clear, direct answer in plain prose — do not enumerate passages. "
    "If the passages don't contain enough information, say so clearly."
)


def handle_answer_question(query: str, history: list[dict], db: Session) -> str:
    indexed = (
        db.query(models.DocumentEmbeddingStatus)
        .filter(models.DocumentEmbeddingStatus.is_indexed == 1)
        .all()
    )

    if not indexed:
        return (
            "No documents are indexed yet. Upload research papers and wait for "
            "indexing to complete before asking questions."
        )

    try:
        q_vec = ollama_client.embed(query)
    except Exception as exc:
        return (
            f"Could not connect to Ollama for embedding: {exc}. "
            "Please make sure Ollama is running (`ollama serve`)."
        )

    context_parts: list[str] = []
    for status in indexed:
        doc = db.query(models.Documents).filter(
            models.Documents.id == status.document_id
        ).first()
        if not doc:
            continue
        for chunk in query_similar_chunks(status.document_id, q_vec, top_k=2):
            context_parts.append(f"[Source: {doc.filename}]\n{chunk}")

    if not context_parts:
        return "No relevant content found across the indexed papers for your question."

    context = "\n\n---\n\n".join(context_parts[:8])  # cap at 8 chunks
    history_str = _format_history(history)
    conv_prefix = f"Conversation history:\n{history_str}\n\n" if history_str else ""

    prompt = (
        f"{conv_prefix}"
        f"Relevant passages from research papers:\n\n{context}\n\n"
        f"Question: {query}\n\n"
        "Answer:"
    )

    try:
        return ollama_client.generate(prompt, system=_QA_SYSTEM, num_predict=400)
    except Exception as exc:
        return (
            f"Could not generate answer: {exc}. "
            "Please make sure Ollama is running (`ollama serve`)."
        )


# ---------------------------------------------------------------------------
# Handler: IRRELEVANT
# ---------------------------------------------------------------------------

_IRRELEVANT_MSG = (
    "Query Irrelevant — I can only assist with your research papers: "
    "finding documents, counting papers, or answering questions about their content."
)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_agent(
    query: str,
    history: list[dict],
    db: Session,
) -> tuple[str, Intent]:
    """
    Run the agent for one user turn.
    Returns (response_text, intent).
    history is a list of {"role": "user"|"assistant", "content": str} dicts,
    ordered oldest-first.
    """
    intent = classify_intent(query, history)
    logger.info("Agent intent=%s  query=%s", intent, query[:80])

    if intent == "LIST_PAPERS":
        response = handle_list_papers(query, db)
    elif intent == "COUNT_PAPERS":
        response = handle_count_papers(query, db)
    elif intent == "IRRELEVANT":
        response = _IRRELEVANT_MSG
    else:
        response = handle_answer_question(query, history, db)

    return response, intent
