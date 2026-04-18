from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from zoneinfo import ZoneInfo
from .database import Base

IST = ZoneInfo("Asia/Kolkata")

class Users(Base):

    __tablename__ = "Users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(IST))
    documents = relationship("Documents", back_populates="owner")

class Documents(Base):

    __tablename__ = "Documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    filepath = Column(String)
    owner_id = Column(Integer, ForeignKey("Users.id"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(IST))

    owner = relationship("Users", back_populates="documents")
    embedding_status = relationship(
        "DocumentEmbeddingStatus",
        back_populates="document",
        uselist=False,
        cascade="all, delete-orphan",
    )
    summarization_status = relationship(
        "DocumentSummarizationStatus",
        back_populates="document",
        uselist=False,
        cascade="all, delete-orphan",
    )
    summaries = relationship(
        "DocumentSummary",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class DocumentEmbeddingStatus(Base):
    """Tracks the ChromaDB indexing state for each uploaded document."""

    __tablename__ = "DocumentEmbeddingStatus"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("Documents.id"), unique=True, nullable=False)
    # 0 = pending, 1 = indexed, 2 = failed
    is_indexed = Column(Integer, default=0, nullable=False)
    chunk_count = Column(Integer, default=0)
    indexed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(String, nullable=True)

    document = relationship("Documents", back_populates="embedding_status")


class DocumentSummarizationStatus(Base):
    """Tracks the summarization job state for each document."""

    __tablename__ = "DocumentSummarizationStatus"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("Documents.id"), unique=True, nullable=False)
    # 0 = in-progress, 1 = done, 2 = failed
    status = Column(Integer, default=0, nullable=False)
    total_pages = Column(Integer, default=0)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(String, nullable=True)

    document = relationship("Documents", back_populates="summarization_status")


class DocumentSummary(Base):
    """Stores cached summaries (full paper or per-page) for a document."""

    __tablename__ = "DocumentSummary"
    __table_args__ = (
        UniqueConstraint(
            "document_id", "summary_type", "page_number",
            name="uq_doc_summary_type_page",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("Documents.id"), nullable=False)
    # "full" or "page"
    summary_type = Column(String, nullable=False)
    page_number = Column(Integer, nullable=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(IST))

    document = relationship("Documents", back_populates="summaries")