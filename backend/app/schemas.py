from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: int
    filename: str
    filepath: str
    owner_id: int
    created_at: datetime
    owner: UserResponse

    class Config:
        from_attributes = True

class EmbeddingStatusResponse(BaseModel):
    document_id: int
    is_indexed: int
    chunk_count: int
    indexed_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True

class DocumentQuestionRequest(BaseModel):
    question: str

class DocumentChatResponse(BaseModel):
    answer: str
    doc_id: int


# ---------------------------------------------------------------------------
# Summarization
# ---------------------------------------------------------------------------

class SummarizationStatusResponse(BaseModel):
    document_id: int
    status: int          # 0 = in-progress, 1 = done, 2 = failed
    total_pages: int
    completed_at: Optional[datetime]
    error_message: Optional[str]
    has_full_summary: bool = False

    class Config:
        from_attributes = True


class SummaryResponse(BaseModel):
    content: str
    summary_type: str
    page_number: Optional[int] = None


class TextSummarizeRequest(BaseModel):
    selected_text: str