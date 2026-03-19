from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.routes.auth import get_current_user
from app.utils.pdf import extract_text_from_pdf

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/{doc_id}")
def chat_with_document(
    doc_id: int,
    question: str,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):

    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    text = extract_text_from_pdf(doc.filepath)

    # Simple logic (replace later with LLM)
    if question.lower() in text.lower():
        return {"answer": "Found relevant content in document."}
    else:
        return {"answer": "No relevant info found."}