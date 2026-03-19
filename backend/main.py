from fastapi import FastAPI
from app.database import engine
from app.models import Base
from fastapi.middleware.cors import CORSMiddleware


from app.routes import auth, documents, chat, arxiv

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