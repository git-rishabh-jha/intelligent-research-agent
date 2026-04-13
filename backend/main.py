import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, SessionLocal
from app.models import Base
from app.routes import auth, documents, chat, arxiv

logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later restrict to localhost:5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(arxiv.router)


@app.on_event("startup")
def backfill_missing_index_statuses() -> None:
    """
    On every server start, find any documents that have no DocumentEmbeddingStatus
    row and kick off their FAISS indexing in background threads.

    This handles:
      - Documents uploaded before the RAG feature was added (legacy docs)
      - Any edge-case where the status row was accidentally deleted
    """
    from app.models import Documents, DocumentEmbeddingStatus
    from app.utils.rag_pipeline import index_document_task

    db = SessionLocal()
    try:
        all_docs = db.query(Documents).all()
        for doc in all_docs:
            existing = (
                db.query(DocumentEmbeddingStatus)
                .filter(DocumentEmbeddingStatus.document_id == doc.id)
                .first()
            )
            if existing is None:
                logger.info(
                    "Startup backfill: creating pending status for doc %d (%s)",
                    doc.id, doc.filename,
                )
                status = DocumentEmbeddingStatus(document_id=doc.id, is_indexed=0)
                db.add(status)
                db.commit()

                # Run indexing in a daemon thread so it doesn't block startup
                t = threading.Thread(
                    target=index_document_task,
                    args=(doc.id, doc.filepath),
                    daemon=True,
                )
                t.start()
    finally:
        db.close()
