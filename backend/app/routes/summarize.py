"""
Summarization endpoints.

POST /summarize/{doc_id}/full   — return cached summary, or generate + cache + return
POST /summarize/{doc_id}/text   — runtime selected-text summary (never cached)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.routes.auth import get_current_user
from app.utils.summarizer import summarize_full_paper, summarize_text

router = APIRouter(prefix="/summarize", tags=["Summarization"])


def _get_doc_or_404(doc_id: int, db: Session) -> models.Documents:
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ---------------------------------------------------------------------------
# Full-paper summary  (cached after first generation)
# ---------------------------------------------------------------------------

@router.post("/{doc_id}/full", response_model=schemas.SummaryResponse)
def get_or_generate_full_summary(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    """
    Return the cached full-paper summary if it exists.
    On first call, generate it now (may take 1–3 min), save to DB, then return.
    Subsequent calls are instant (DB read).
    """
    doc = _get_doc_or_404(doc_id, db)

    cached = (
        db.query(models.DocumentSummary)
        .filter(
            models.DocumentSummary.document_id == doc_id,
            models.DocumentSummary.summary_type == "full",
        )
        .first()
    )
    if cached:
        return schemas.SummaryResponse(content=cached.content, summary_type="full")

    # Not cached — generate synchronously
    try:
        content = summarize_full_paper(doc.filepath)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {exc}")

    db.add(models.DocumentSummary(
        document_id=doc_id,
        summary_type="full",
        page_number=None,
        content=content,
    ))
    db.commit()

    return schemas.SummaryResponse(content=content, summary_type="full")


# ---------------------------------------------------------------------------
# Selected-text summary  (always runtime, never cached)
# ---------------------------------------------------------------------------

@router.post("/{doc_id}/text", response_model=schemas.SummaryResponse)
def summarize_selected_text(
    doc_id: int,
    body: schemas.TextSummarizeRequest,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    _get_doc_or_404(doc_id, db)

    if not body.selected_text.strip():
        raise HTTPException(status_code=400, detail="selected_text must not be empty")

    try:
        content = summarize_text(body.selected_text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {exc}")

    return schemas.SummaryResponse(content=content, summary_type="text")
