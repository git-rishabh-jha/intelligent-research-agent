"""
Chat session management + global research assistant agent.

Endpoints
---------
POST   /chat/sessions                      — create a new session
GET    /chat/sessions                      — list last 3 sessions (most recent first)
GET    /chat/sessions/{id}                 — full session with all messages
DELETE /chat/sessions/{id}                 — delete a session
POST   /chat/sessions/{id}/message         — send a message, receive agent response
POST   /chat/document/{doc_id}             — per-document RAG (Feature 2, unchanged)
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.routes.auth import get_current_user
from app.utils.agent import run_agent
from app.utils.rag_pipeline import query_document

IST = ZoneInfo("Asia/Kolkata")
MAX_USER_MESSAGES = 20
HISTORY_WINDOW = 8

router = APIRouter(prefix="/chat", tags=["Chat"])


def _own_session(session_id: int, user_id: int, db: Session) -> models.ChatSession:
    session = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == user_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions", response_model=schemas.ChatSessionResponse, status_code=201)
def create_session(
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    session = models.ChatSession(user_id=current_user.id, title="New Chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return schemas.ChatSessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=0,
    )


@router.get("/sessions", response_model=list[schemas.ChatSessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    sessions = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .limit(3)
        .all()
    )
    return [
        schemas.ChatSessionResponse(
            id=s.id,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
            message_count=sum(1 for m in s.messages if m.role == "user"),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=schemas.ChatSessionDetail)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    return _own_session(session_id, current_user.id, db)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    session = _own_session(session_id, current_user.id, db)
    db.delete(session)
    db.commit()


@router.post("/sessions/{session_id}/message", response_model=schemas.SendMessageResponse)
def send_message(
    session_id: int,
    body: schemas.SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    session = _own_session(session_id, current_user.id, db)

    user_count = sum(1 for m in session.messages if m.role == "user")
    if user_count >= MAX_USER_MESSAGES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"This chat has reached the {MAX_USER_MESSAGES}-message limit. "
                "Please start a new chat."
            ),
        )

    recent = session.messages[-HISTORY_WINDOW:]
    history = [{"role": m.role, "content": m.content} for m in recent]

    response_text, intent = run_agent(body.message, history, db)

    user_msg = models.ChatMessage(
        session_id=session_id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    db.flush()

    asst_msg = models.ChatMessage(
        session_id=session_id,
        role="assistant",
        content=response_text,
        intent=intent,
    )
    db.add(asst_msg)

    if user_count == 0:
        title = body.message.strip()[:50]
        if len(body.message.strip()) > 50:
            title += "..."
        session.title = title

    session.updated_at = datetime.now(IST)
    db.commit()
    db.refresh(user_msg)
    db.refresh(asst_msg)

    return schemas.SendMessageResponse(
        session_id=session_id,
        user_message=schemas.ChatMessageResponse.model_validate(user_msg),
        assistant_message=schemas.ChatMessageResponse.model_validate(asst_msg),
        intent=intent,
    )


@router.post("/document/{doc_id}", response_model=schemas.DocumentChatResponse)
def chat_with_document(
    doc_id: int,
    body: schemas.DocumentQuestionRequest,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

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
