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
  await fetch(`${API_BASE}/documents/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });
};