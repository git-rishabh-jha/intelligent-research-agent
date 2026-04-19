"""
Thin synchronous wrapper around the local Ollama HTTP API.
Used by rag_pipeline.py for both embedding generation and answer synthesis.

Ollama must be running at http://localhost:11434
Required models:
  - nomic-embed-text   (for embeddings)
  - llama3.2:3b        (for RAG answer generation — ~1.9 GiB RAM)

Pull them with:
  ollama pull nomic-embed-text
  ollama pull llama3.2:3b

RAM guidance:
  llama3.2:3b needs ~1.9 GiB free RAM — works fine on 8 GiB machines when
  other heavy apps (Chrome, etc.) are closed. Close unnecessary apps if Ollama
  returns "model requires more system memory".
  If RAM is still tight, llama3.2:1b (~1.3 GiB) is a smaller fallback:
    CHAT_MODEL = "llama3.2:1b"
"""

import os
import httpx

OLLAMA_BASE = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = "nomic-embed-text"
CHAT_MODEL = "llama3.2:3b"

# Dedicated summarisation model.
# Swap this to "gemma2:2b" for ~40% faster summaries with better quality
# (pull with: ollama pull gemma2:2b).  Falls back to CHAT_MODEL if not pulled.
SUMMARIZE_MODEL = "gemma2:2b"

# Timeouts: embedding is fast (~2s), generation can take longer for large context
EMBED_TIMEOUT = 60.0
GENERATE_TIMEOUT = 180.0


def embed(text: str, model: str = EMBED_MODEL) -> list[float]:
    """
    Get an embedding vector for `text` using Ollama's /api/embed endpoint.
    Returns a flat list of floats (768-dim for nomic-embed-text).
    """
    with httpx.Client(timeout=EMBED_TIMEOUT) as client:
        response = client.post(
            f"{OLLAMA_BASE}/api/embed",
            json={"model": model, "input": text},
        )
        response.raise_for_status()
        data = response.json()
        return data["embeddings"][0]


def generate(
    prompt: str,
    model: str = CHAT_MODEL,
    system: str = "",
    num_predict: int | None = None,
) -> str:
    """
    Generate a text completion using Ollama's /api/generate endpoint.
    Returns the response string (non-streaming).

    num_predict: max tokens to generate. Pass a small value (e.g. 120) for
    short outputs like page summaries to reduce latency significantly.

    Surfaces Ollama-specific error messages (e.g. out-of-memory) so callers
    receive actionable feedback instead of a generic HTTP error string.
    """
    options: dict = {"num_gpu": int(os.environ.get("OLLAMA_NUM_GPU", "0"))}
    if num_predict is not None:
        options["num_predict"] = num_predict

    payload: dict = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        # Force CPU-only inference. The MX130 GPU has only 2 GB VRAM which is
        # fully consumed by the model weights, leaving no room for runtime
        # buffers — the llama runner crashes with exit status 2 when GPU is used.
        # CPU inference is stable with the available 3+ GiB free system RAM.
        "options": options,
    }
    if system:
        payload["system"] = system

    with httpx.Client(timeout=GENERATE_TIMEOUT) as client:
        response = client.post(f"{OLLAMA_BASE}/api/generate", json=payload)

        # Surface Ollama's own error detail (e.g. out-of-memory message)
        # instead of a generic httpx HTTPStatusError.
        if not response.is_success:
            try:
                ollama_error = response.json().get("error", response.text)
            except Exception:
                ollama_error = response.text
            raise RuntimeError(f"Ollama error: {ollama_error}")

        return response.json()["response"]


def is_ollama_running() -> bool:
    """Quick health check — returns True if Ollama is reachable."""
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{OLLAMA_BASE}/api/tags")
            return r.status_code == 200
    except Exception:
        return False
