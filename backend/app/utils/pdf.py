"""
PDF text extraction using pdfplumber.

Improvements over the original PyPDF2 implementation:
  - Tables are extracted as pipe-delimited structured text instead of garbled runs
  - Pages that contain embedded raster images get a [Figure on page N] placeholder
    so the LLM knows visual content exists even though pixel data can't be embedded
  - Extraction stops at the References / Bibliography section because that content
    is not useful for Q&A and would pollute the vector store with citation noise
  - A single-page extraction helper is provided for the Summarization feature (Feature 3)
"""

import re
import pdfplumber
from typing import Optional

# ---------------------------------------------------------------------------
# Reference-section detection
# ---------------------------------------------------------------------------

_REF_PATTERNS = [
    r"^\s*references\s*$",
    r"^\s*bibliography\s*$",
    r"^\s*works\s+cited\s*$",
    # Numbered section headers like "7. References" or "VII. References"
    r"^\s*\d+[\.\s]+references\s*$",
    r"^\s*[ivxlcdmIVXLCDM]+[\.\s]+references\s*$",
]
_REF_RE = [re.compile(p, re.IGNORECASE) for p in _REF_PATTERNS]


def _is_reference_header(line: str) -> bool:
    stripped = line.strip()
    return any(r.match(stripped) for r in _REF_RE)


# ---------------------------------------------------------------------------
# Per-page extraction
# ---------------------------------------------------------------------------

def _extract_page_content(page: "pdfplumber.page.Page", page_num: int) -> str:
    """
    Extract the text content of a single pdfplumber Page object.

    Strategy:
      1. Detect embedded raster images → insert a human-readable placeholder.
      2. Detect tables → extract as pipe-delimited rows and exclude their bounding
         boxes from the regular text pass to avoid duplication.
      3. Extract non-table text using pdfplumber's word-level API so we can filter
         out words that fall inside a table bounding box.

    Returns a plain-text string for this page.
    """
    parts: list[str] = []

    # --- 1. Image placeholders --------------------------------------------------
    try:
        if page.images:
            parts.append(f"[Figure/Image on page {page_num}]")
    except Exception:
        pass

    # --- 2. Table extraction ----------------------------------------------------
    table_bboxes: list[tuple] = []
    try:
        found_tables = page.find_tables()
        for tbl in found_tables:
            table_bboxes.append(tbl.bbox)  # (x0, top, x1, bottom)
            data = tbl.extract()
            if not data:
                continue
            rows: list[str] = []
            for row in data:
                cleaned = [str(cell or "").strip().replace("\n", " ") for cell in row]
                rows.append(" | ".join(cleaned))
            parts.append("[TABLE]\n" + "\n".join(rows) + "\n[/TABLE]")
    except Exception:
        # pdfplumber can fail on malformed PDF table structures; fall through
        table_bboxes = []

    # --- 3. Non-table text ------------------------------------------------------
    try:
        if table_bboxes:
            # Collect individual words and keep only those outside every table bbox
            words = page.extract_words() or []
            non_table_words: list[str] = []
            for w in words:
                in_table = any(
                    w["x0"] >= bbox[0] - 2
                    and w["x1"] <= bbox[2] + 2
                    and w["top"] >= bbox[1] - 2
                    and w["bottom"] <= bbox[3] + 2
                    for bbox in table_bboxes
                )
                if not in_table:
                    non_table_words.append(w["text"])
            text = " ".join(non_table_words)
        else:
            text = page.extract_text() or ""
        if text.strip():
            parts.append(text)
    except Exception:
        pass

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_text_from_pdf(filepath: str) -> str:
    """
    Extract the full body text of a research-paper PDF, stopping before the
    References / Bibliography section.

    Used by:
      - rag_pipeline.py  (indexing)
    """
    full_text_parts: list[str] = []

    with pdfplumber.open(filepath) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            page_content = _extract_page_content(page, page_num)

            # Check every line for a reference-section header
            lines = page_content.splitlines()
            ref_line_idx: Optional[int] = None
            for i, line in enumerate(lines):
                if _is_reference_header(line):
                    ref_line_idx = i
                    break

            if ref_line_idx is not None:
                # Keep the text on this page up to (not including) the header
                before_refs = "\n".join(lines[:ref_line_idx]).strip()
                if before_refs:
                    full_text_parts.append(before_refs)
                # Stop processing further pages
                break

            if page_content.strip():
                full_text_parts.append(page_content)

    return "\n\n".join(full_text_parts)


def extract_page_text(filepath: str, page_number: int) -> str:
    """
    Extract text from a single page (1-indexed).
    Does NOT stop at References — used for page-level summarisation.
    """
    with pdfplumber.open(filepath) as pdf:
        if page_number < 1 or page_number > len(pdf.pages):
            return ""
        page = pdf.pages[page_number - 1]
        return _extract_page_content(page, page_number)
