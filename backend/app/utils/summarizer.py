"""
PDF summarization utilities.

Two modes only:
  - summarize_full_paper(filepath)  — whole document, cached in DB after first run
  - summarize_text(text)            — selected text, always runtime (never cached)

Strategy for full-paper summary
--------------------------------
- Short papers (text ≤ 3 500 chars): single LLM call.
- Long papers: map-reduce — chunk into ~2 500-char pieces, summarise each with
  a tight token cap (num_predict=150), then synthesise with num_predict=350.
  This keeps every individual Ollama call under ~25 s on CPU.
"""

import logging

from app.utils.pdf import extract_text_from_pdf
from app.utils.ollama_client import generate, SUMMARIZE_MODEL, CHAT_MODEL

logger = logging.getLogger(__name__)

_SINGLE_PASS_LIMIT = 3_500
_MAP_CHUNK_SIZE    = 2_500
_MAP_CHUNK_OVERLAP = 200

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_FULL_SINGLE_SYSTEM = (
    "You are an expert research paper summariser. "
    "Write a clear, well-structured summary covering: "
    "main objective, methodology, key findings, and conclusions. "
    "Mention any significant tables or figures briefly. "
    "Keep the summary under 300 words."
)

_MAP_SYSTEM = (
    "Summarise the following excerpt from a research paper in 3–5 factual sentences."
)

_REDUCE_SYSTEM = (
    "You are synthesising partial summaries of a research paper. "
    "Write one cohesive final summary covering: main objective, methodology, "
    "key findings, and conclusions in under 300 words. Do not repeat yourself."
)

_TEXT_SYSTEM = (
    "Summarise the following passage from a research paper in 2–5 clear, "
    "factual sentences preserving the original meaning."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks, breaking on sentence boundaries."""
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + _MAP_CHUNK_SIZE, n)
        if end < n:
            for boundary in (". ", ".\n", "! ", "? "):
                idx = text.rfind(boundary, start, end)
                if idx != -1 and idx > start + _MAP_CHUNK_SIZE // 2:
                    end = idx + len(boundary)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - _MAP_CHUNK_OVERLAP if end < n else n
    return chunks


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def summarize_full_paper(filepath: str) -> str:
    """
    Summarise the full paper.
    - Short (≤ 3 500 chars): single LLM call with SUMMARIZE_MODEL.
    - Long: map-reduce — each chunk uses SUMMARIZE_MODEL with num_predict=150
      to stay fast; synthesis uses num_predict=350.
    """
    text = extract_text_from_pdf(filepath)
    if not text.strip():
        return (
            "Unable to extract text from this document. "
            "It may be a scanned PDF with no embedded text layer."
        )

    if len(text) <= _SINGLE_PASS_LIMIT:
        return generate(
            prompt=f"Summarise the following research paper:\n\n{text}",
            system=_FULL_SINGLE_SYSTEM,
            model=SUMMARIZE_MODEL,
            num_predict=350,
        )

    # Map phase
    chunks = _chunk_text(text)
    logger.info("summarize_full_paper: %d chunks for map-reduce", len(chunks))

    partials: list[str] = []
    for i, chunk in enumerate(chunks, 1):
        logger.info("map chunk %d/%d", i, len(chunks))
        try:
            partials.append(
                generate(
                    prompt=f"Summarise this research paper excerpt:\n\n{chunk}",
                    system=_MAP_SYSTEM,
                    model=SUMMARIZE_MODEL,
                    num_predict=150,
                )
            )
        except Exception as exc:
            logger.warning("Map chunk %d failed: %s", i, exc)
            partials.append(f"[Excerpt {i}: unavailable]")

    combined = "\n\n".join(f"[Part {i}]\n{s}" for i, s in enumerate(partials, 1))
    if len(combined) > 4_000:
        combined = combined[:4_000] + "\n...[truncated]"

    return generate(
        prompt=(
            "Synthesise these partial summaries into one final research paper "
            "summary:\n\n" + combined
        ),
        system=_REDUCE_SYSTEM,
        model=SUMMARIZE_MODEL,
        num_predict=350,
    )


def summarize_text(text: str) -> str:
    """Summarise arbitrary selected text — always called at runtime."""
    text = text.strip()
    if not text:
        return "No text provided."
    if len(text) > _SINGLE_PASS_LIMIT:
        text = text[:_SINGLE_PASS_LIMIT] + "\n...[truncated]"
    return generate(
        prompt=f"Summarise the following text from a research paper:\n\n{text}",
        system=_TEXT_SYSTEM,
        model=CHAT_MODEL,
        num_predict=200,
    )
