"""
Research paper validator.

Checks whether a PDF is a research paper / journal article by scanning
the first 6 pages for standard academic section headings.

Scoring
-------
Each unique matched heading family adds to the score:
  - "abstract"  → +2  (very strong single-word signal)
  - any other   → +1

Threshold: score >= 3 to be accepted.

Examples
--------
  Abstract (2) + Introduction (1)                        = 3  → PASS
  Introduction (1) + Methods (1) + Results (1)           = 3  → PASS
  Introduction (1) + Conclusion (1)                      = 2  → FAIL
  Random PDF with no recognised headings                 = 0  → FAIL
"""

import re
import logging
import pdfplumber

logger = logging.getLogger(__name__)

_PASS_THRESHOLD = 3

# Each tuple: (family_name, compiled_pattern, score_weight)
_HEADING_RULES: list[tuple[str, re.Pattern, int]] = [
    ("abstract",       re.compile(r"\babstract\b",                      re.I), 2),
    ("introduction",   re.compile(r"\bintroduction\b",                  re.I), 1),
    ("related_work",   re.compile(r"\brelated\s+work\b",                re.I), 1),
    ("lit_review",     re.compile(r"\bliterature\s+review\b",           re.I), 1),
    ("background",     re.compile(r"\bbackground\b",                    re.I), 1),
    ("methodology",    re.compile(r"\bmethodology\b",                   re.I), 1),
    ("methods",        re.compile(r"\bmethods?\b",                      re.I), 1),
    ("proposed",       re.compile(r"\bproposed\s+(method|approach|model|framework|system)\b",
                                                                        re.I), 1),
    ("experiments",    re.compile(r"\bexperiments?\b",                  re.I), 1),
    ("experimental",   re.compile(r"\bexperimental\s+(setup|results?|evaluation)\b",
                                                                        re.I), 1),
    ("results",        re.compile(r"\bresults?\b",                      re.I), 1),
    ("evaluation",     re.compile(r"\bevaluation\b",                    re.I), 1),
    ("discussion",     re.compile(r"\bdiscussion\b",                    re.I), 1),
    ("conclusion",     re.compile(r"\bconclusions?\b",                  re.I), 1),
    ("future_work",    re.compile(r"\bfuture\s+work\b",                 re.I), 1),
    ("references",     re.compile(r"\breferences\b",                    re.I), 1),
    ("bibliography",   re.compile(r"\bbibliography\b",                  re.I), 1),
    ("acknowledgments",re.compile(r"\backnowledg(e?ments?)\b",          re.I), 1),
    ("appendix",       re.compile(r"\bappendix\b",                      re.I), 1),
    # Journal/conference metadata signals
    ("doi_issn",       re.compile(r"\b(doi|issn|arxiv|preprint|proceedings|journal\s+of)\b",
                                                                        re.I), 1),
]

# Strip leading section numbers: "1.", "2.1", "I.", "II.", etc.
_NUMBER_PREFIX = re.compile(r"^[\d]+(?:\.[\d]*)?\s+|^[ivxlcIVXLC]+\.\s+")


def is_research_paper(filepath: str) -> tuple[bool, str]:
    """
    Returns (True, "") if the PDF is a research paper / journal article.
    Returns (False, reason_string) otherwise.
    """
    try:
        lines: list[str] = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages[:6]:
                raw = page.extract_text() or ""
                lines.extend(raw.splitlines())
    except Exception as exc:
        logger.warning("pdf_validator: could not read %s — %s", filepath, exc)
        return False, "Could not read the PDF. The file may be corrupted."

    if not lines:
        return (
            False,
            "No extractable text found. The PDF may be image-only or scanned. "
            "Please upload a text-based research paper.",
        )

    score = 0
    matched_families: set[str] = set()

    for raw_line in lines:
        line = raw_line.strip()
        # Headings are short standalone lines — skip long prose sentences
        if not line or len(line) > 90:
            continue

        # Normalise: remove leading numbers, lower-case
        normalised = _NUMBER_PREFIX.sub("", line).lower()

        for family, pattern, weight in _HEADING_RULES:
            if family in matched_families:
                continue
            if pattern.search(normalised):
                matched_families.add(family)
                score += weight
                break  # one rule per line is enough

    logger.debug(
        "pdf_validator: score=%d  families=%s  file=%s",
        score, matched_families, filepath,
    )

    if score >= _PASS_THRESHOLD:
        return True, ""

    return (
        False,
        "This PDF does not appear to be a research paper or journal article. "
        f"Only {len(matched_families)} standard academic section heading(s) were detected "
        f"({', '.join(sorted(matched_families)) or 'none'}). "
        "Please upload a PDF that contains sections such as Abstract, Introduction, "
        "Methods, Results, and References.",
    )
