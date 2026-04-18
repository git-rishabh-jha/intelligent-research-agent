<h1 align="center">🔬 Intelligent Research Agent</h1>

<p align="center">
  <strong>A full-stack AI-powered document management system for researchers</strong><br/>
  Upload papers · Ask questions · Get summaries · Chat with your library
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Ollama-LLM-black?style=flat-square&logo=ollama&logoColor=white"/>
  <img src="https://img.shields.io/badge/FAISS-Vector_Search-0052CC?style=flat-square"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.0-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white"/>
</p>

---

## ✨ What is this?

**Intelligent Research Agent** is a locally-hosted, AI-first document management platform built for researchers. It lets you upload research papers, extract insights through natural language, and maintain an intelligent chatbot that understands your entire library — all running **100% offline** using Ollama.

No cloud. No API keys. No data leaving your machine.

---

## 🚀 Key Features

### 📂 Document Management
- Upload, view, download and delete PDF research papers
- In-browser PDF viewer with page navigation and zoom controls
- Automatic background indexing on upload — ready to query in seconds

### 🤖 Global Research Chatbot
- Multi-turn conversational agent with **4 intelligent intents**:
  - **Paper Search** — *"Show me papers on transformers"* → ranked results with summaries
  - **Count** — *"How many ML papers do I have?"* → instant count with context
  - **Q&A** — *"What optimization method did this paper use?"* → multi-document RAG answer
  - **Off-topic guard** — politely declines irrelevant queries
- Rule-based fast classification + LLM fallback for ambiguous queries
- Retains conversation context across message turns
- Clickable paper links in responses navigate directly to the PDF viewer
- Session history in sidebar (last 3 chats, up to 20 messages each)

### 📄 Per-Document RAG Chat
- Ask targeted questions about a specific paper
- Retrieves the most relevant chunks using FAISS similarity search
- Answers grounded in the paper's actual content

### 📝 AI Summarization
- **Full Paper Summary** — single-pass for short papers; map-reduce pipeline for long ones
- **Selected Text Summary** — highlight any text in the PDF viewer and summarize it instantly
- Summaries cached in the database — first generation is slow, every subsequent click is instant

### 🔐 Authentication
- JWT-based login and registration
- All routes and documents are user-scoped

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  PDF Viewer  │  │  RAG Chat    │  │   Research Chatbot   │  │
│  │  + Zoom/Nav  │  │  Panel       │  │   + Intent Router    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │        Summarize Panel (Full Paper / Selected Text)      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API (JWT)
┌─────────────────────────▼───────────────────────────────────────┐
│                      FastAPI Backend                            │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │   Auth   │  │Documents │  │   Chat   │  │  Summarize   │   │
│  │  Router  │  │  Router  │  │  Router  │  │   Router     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Core AI Layer                         │   │
│  │  Intent Classifier → RAG Pipeline → Summarizer          │   │
│  │  FAISS Vector Store  ←→  Ollama (llama3.2:3b)           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌───────────────────────┐   ┌──────────────────────────────┐   │
│  │  SQLite + SQLAlchemy  │   │  pdfplumber (text extract)   │   │
│  └───────────────────────┘   └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend Framework | React 19 + TypeScript | UI with strict typing |
| Styling | Tailwind CSS v4 | Dark-themed, responsive UI |
| Routing | React Router v7 | SPA navigation + URL state |
| PDF Rendering | react-pdf + pdf.js | In-browser PDF viewer |
| Build Tool | Vite 7 | Fast HMR dev server + bundler |
| Backend Framework | FastAPI | Async REST API |
| ORM + Database | SQLAlchemy + SQLite | Persistent storage |
| Authentication | JWT (python-jose) + bcrypt | Secure stateless auth |
| LLM Inference | Ollama (`llama3.2:3b`) | Local chat + summarization |
| Embeddings | Ollama (`nomic-embed-text`) | Semantic vector generation |
| Vector Search | FAISS (faiss-cpu) | Fast similarity retrieval |
| PDF Extraction | pdfplumber | Text, table & image extraction |
| HTTP Client | httpx | Async Ollama API calls |

---

## 📁 Project Structure

```
Intelligent-Research-Agent/
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── auth.py          # Register / Login
│   │   │   ├── documents.py     # Upload / View / Delete + background indexing
│   │   │   ├── chat.py          # Session management + agent message endpoint
│   │   │   └── summarize.py     # Full paper + selected text summarization
│   │   ├── utils/
│   │   │   ├── agent.py         # Intent router (4 intents) + RAG handlers
│   │   │   ├── rag_pipeline.py  # FAISS index/query pipeline
│   │   │   ├── summarizer.py    # Map-reduce summarization
│   │   │   ├── ollama_client.py # Ollama HTTP wrapper
│   │   │   └── faiss_store.py   # FAISS persistence helpers
│   │   ├── models.py            # SQLAlchemy models
│   │   └── schemas.py           # Pydantic request/response schemas
│   └── main.py                  # FastAPI app + startup backfill
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── Chat.tsx          # Global chatbot page
        │   └── dashboard.tsx     # Document library + PDF viewer
        ├── components/
        │   ├── chat/
        │   │   ├── ChatMessage.tsx    # Bubble + intent badge + markdown links
        │   │   ├── ChatWindow.tsx     # Message list + typing indicator
        │   │   ├── ChatInput.tsx      # Input bar + send button
        │   │   ├── DocChatPanel.tsx   # Per-doc RAG chat panel
        │   │   └── SummarizePanel.tsx # Summarize panel (full + selected text)
        │   └── ui/
        ├── layouts/
        │   └── MainLayout.tsx    # Sidebar with live session history
        └── services/
            └── api.ts            # Typed API client
```

---

## ⚙️ Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com) installed and running

### 1. Pull required models

```bash
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### 4. Open the app

Navigate to `http://localhost:5173`, register an account, and start uploading papers.

---

## 💡 How It Works

### RAG Pipeline
1. On upload, each PDF is extracted with **pdfplumber** (preserving tables and structure)
2. Text is chunked (800-char chunks, 150-char overlap) and embedded via `nomic-embed-text`
3. Vectors are stored in a per-document **FAISS** index on disk
4. At query time, the user's question is embedded and the top-K most similar chunks are retrieved
5. Retrieved chunks are injected into the LLM prompt for grounded answers

### Intent Classification
```
User Query
    │
    ▼
 Rule-based regex  ──────►  LIST / COUNT / IRRELEVANT (instant, ~0ms)
    │ (ambiguous)
    ▼
 LLM fallback      ──────►  ANSWER_QUESTION (default safe intent)
  (num_predict=12,
   ~5-8s on CPU)
```

### Summarization
- **Short papers** (≤ 3,500 chars): single LLM pass
- **Long papers**: map-reduce — each 2,500-char chunk summarized independently, then synthesized into one final summary
- Results cached in SQLite — subsequent loads are instant

---

## 🖥️ UI Highlights

- **Dark slate theme** throughout with emerald accents
- **Fixed layout** — sidebar and input bar are always visible; only the chat area scrolls
- **Optimistic UI** — user messages appear instantly before the server responds
- **Intent badges** on every AI message (color-coded by type)
- **Live session sidebar** — last 3 chats loaded from DB, hover-to-delete, highlights active session
- **Clickable paper links** — paper names in chat navigate directly to the PDF viewer

---

## 🔭 Potential Enhancements

- [ ] ArXiv paper search and one-click import
- [ ] Streaming LLM responses (SSE)
- [ ] Multi-user document sharing
- [ ] Export chat transcripts as PDF
- [ ] Reranking retrieved chunks with a cross-encoder model
- [ ] Mobile-responsive layout

---

## 👤 Author

**Rishabh Jha**

> Built as a full-stack AI engineering project demonstrating end-to-end LLM integration, retrieval-augmented generation, and modern web development — all running locally without any cloud dependency.
