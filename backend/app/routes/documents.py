import os
import shutil
import uuid

from fastapi import File, APIRouter, UploadFile, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse

from app.database import get_db
from app import models, schemas
from app.routes.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# API to upload the document
@router.post("/upload", response_model=schemas.DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user)
):

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDFs allowed")

    unique_name = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, unique_name)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    document = models.Documents(
        filename=file.filename,
        filepath=filepath,
        owner_id=current_user.id
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return document

#API to get all the document list
@router.get("/", response_model=list[schemas.DocumentResponse])
def get_document(
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user)
):
    
    docs = db.query(models.Documents).all()
    return docs

# Delete Document
@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user)
):
    
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document Not Found")
    
    if doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Deletion Not Allowed")
    
    if os.path.exists(doc.filepath):
        os.remove(doc.filepath)

    db.delete(doc)
    db.commit()
    
    return {"message": "Document Deleted"}

@router.get("/{doc_id}/view")
def view_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.Users = Depends(get_current_user),
):
    doc = db.query(models.Documents).filter(models.Documents.id == doc_id).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # ✅ Allow all users to view
    return FileResponse(
        doc.filepath,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={doc.filename}"}
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

    # ✅ Allow all users to download (or restrict if needed)
    return FileResponse(
        doc.filepath,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={doc.filename}"}
    )


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