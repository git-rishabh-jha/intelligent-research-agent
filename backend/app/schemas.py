from pydantic import BaseModel
from datetime import datetime

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
        from_attributes: True

class DocumentResponse(BaseModel):
    id: int
    filename: str
    filepath: str
    owner_id: int
    created_at: datetime
    owner: UserResponse

    class Config:
        from_attributes = True