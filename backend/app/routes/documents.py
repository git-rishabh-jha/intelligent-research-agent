import os
import shutil
import uuid

from fastapi import File, APIRouter, UploadFile, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse

from app.database import get_db
from app import models, schemas
from app.routes.auth import get_current_user
from app.utils.rag_pipeline import index_document_task
from app.utils.faiss_store import delete_document as delete_faiss_index
from app.utils.pdf_validator import is_research_paper

router = APIRouter(prefix="/documents", tags=["Documents"])
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=schemas.DocumentResponse)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDFs are allowed.")

    unique_name = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, unique_name)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Validate that the uploaded PDF is a research paper before persisting
    valid, reason = is_research_paper(filepath)
    if not valid:
        os.remove(filepath)
        raise HTTPException(status_code=422, detail=reason)

    document = models.Documents(
        filename=file.filename,
        filepath=filepath,
        owner_id=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # Create an embedding-status row immediately so the frontend can poll it
    status = models.DocumentEmbeddingStatus(
        document_id=document.id,
        is_indexed=0,
    )
    db.add(status)
    db.commit()

    # Kick off background indexing — runs after the response is sent.
    # index_document_task creates its own DB session internally.
    background_tasks.add_task(index_document_task, document.id, filepath)

    return document


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[schemas.DocumentResponse])
def get_document(
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    docs = db.query(models.Documents).all()
    return docs


# ---------------------------------------------------------------------------
# Index status  — must be declared before /{doc_id} routes
# ---------------------------------------------------------------------------

@router.get("/index-status/{doc_id}", response_model=schemas.EmbeddingStatusResponse)
def get_index_status(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    """
    Returns the FAISS indexing status for a document.
    is_indexed: 0 = pending, 1 = done, 2 = failed

    Self-healing: if no status row exists (e.g. document was uploaded before
    this feature was added), a pending row is created and indexing is triggered
    automatically. The frontend will keep polling and eventually see is_indexed=1.
    """
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    status = (
        db.query(models.DocumentEmbeddingStatus)
        .filter(models.DocumentEmbeddingStatus.document_id == doc_id)
        .first()
    )

    if not status:
        # Pre-existing document with no status row — create one and kick off indexing
        status = models.DocumentEmbeddingStatus(document_id=doc_id, is_indexed=0)
        db.add(status)
        db.commit()
        db.refresh(status)
        background_tasks.add_task(index_document_task, doc_id, doc.filepath)

    return status


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document Not Found")

    if doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Deletion Not Allowed")

    # Remove FAISS index for this document (silently ignored if absent)
    delete_faiss_index(doc_id)

    if os.path.exists(doc.filepath):
        os.remove(doc.filepath)

    db.delete(doc)
    db.commit()

    return {"message": "Document Deleted"}


# ---------------------------------------------------------------------------
# View / Download
# ---------------------------------------------------------------------------

@router.get("/{doc_id}/view")
def view_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return FileResponse(
        doc.filepath,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={doc.filename}"},
    )


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return FileResponse(
        doc.filepath,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={doc.filename}"},
    )


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@router.get("/search/")
def search_documents(
    query: str,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    docs = db.query(models.Documents).filter(
        models.Documents.filename.contains(query)
    ).all()
    return docs
