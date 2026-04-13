const API_BASE = "http://127.0.0.1:8000";
export const getToken = () => localStorage.getItem("token");

export const api = async (
  endpoint: string,
  method: string = "GET",
  body?: any,
  isFormData: boolean = false
) => {
  const headers: any = {};

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Something went wrong");
  }

  return res.json();
};

export const fetchDocuments = async () => {
  const res = await fetch(`${API_BASE}/documents/`, {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });
  return res.json();
};

export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`
    },
    body: formData
  });

  return res.json();
};

export const deleteDocument = async (id: number) => {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Delete failed" }));
    throw new Error(err.detail || "Delete failed");
  }
};

// ---------------------------------------------------------------------------
// RAG – document index status
// ---------------------------------------------------------------------------

export interface EmbeddingStatus {
  document_id: number;
  /** 0 = pending, 1 = indexed, 2 = failed */
  is_indexed: 0 | 1 | 2;
  chunk_count: number;
  indexed_at: string | null;
  error_message: string | null;
}

export const getIndexStatus = async (docId: number): Promise<EmbeddingStatus> => {
  const res = await fetch(`${API_BASE}/documents/index-status/${docId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to fetch index status");
  }
  return res.json();
};

// ---------------------------------------------------------------------------
// RAG – document chat
// ---------------------------------------------------------------------------

export interface DocumentChatResponse {
  answer: string;
  doc_id: number;
}

export const chatWithDocument = async (
  docId: number,
  question: string
): Promise<DocumentChatResponse> => {
  const res = await fetch(`${API_BASE}/chat/document/${docId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Chat request failed");
  }
  return res.json();
};