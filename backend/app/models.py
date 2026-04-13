from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
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