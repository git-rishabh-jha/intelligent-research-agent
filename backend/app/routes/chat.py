from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.routes.auth import get_current_user
from app.utils.rag_pipeline import query_document

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/document/{doc_id}", response_model=schemas.DocumentChatResponse)
def chat_with_document(
    doc_id: int,
    body: schemas.DocumentQuestionRequest,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    """
    Answer a question about a specific document using RAG + cross-encoder reranking.

    Retrieval pipeline:
      1. Embed the question with nomic-embed-text (Ollama).
      2. Retrieve top-15 candidate chunks from ChromaDB via cosine similarity.
      3. Rerank the 15 candidates with cross-encoder/ms-marco-MiniLM-L-6-v2.
      4. Pass the top-5 reranked chunks as context to mistral:7b-instruct (Ollama).
      5. Return the generated answer.

    The endpoint does NOT own the user's question — the question is in the request
    body so it is not logged in server URL access logs.
    """
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check indexing status
    status = (
        db.query(models.DocumentEmbeddingStatus)
        .filter(models.DocumentEmbeddingStatus.document_id == doc_id)
        .first()
    )
    if not status or status.is_indexed == 0:
        raise HTTPException(
            status_code=202,
            detail="Document is still being indexed. Please try again shortly.",
        )
    if status.is_indexed == 2:
        raise HTTPException(
            status_code=422,
            detail=f"Document indexing failed: {status.error_message}",
        )

    answer = query_document(doc_id=doc_id, question=body.question)
    return schemas.DocumentChatResponse(answer=answer, doc_id=doc_id)
