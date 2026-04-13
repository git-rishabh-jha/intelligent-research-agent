import { useEffect, useState, useRef } from "react";
import DocumentTile from "../components/ui/DocumentTile";
import DocChatPanel from "../components/chat/DocChatPanel";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
} from "../services/api";

import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;


export default function Dashboard() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Doc-chat panel visibility
  const [showDocChat, setShowDocChat] = useState(false);

  const username = localStorage.getItem("username");

  const loadDocs = async () => {
    const data = await fetchDocuments();
    setDocuments(data);
  };

  useEffect(() => {
    loadDocs();
  }, []);

  // Close upload dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowMenu(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // IntersectionObserver: track which page is currently visible
  useEffect(() => {
    if (!numPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = pageRefs.current.findIndex(
              (el) => el === entry.target
            );
            if (index !== -1) {
              setCurrentPage(index + 1);
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    pageRefs.current.forEach((page) => {
      if (page) observer.observe(page);
    });

    return () => observer.disconnect();
  }, [numPages, scale]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadDocument(file);
      loadDocs();
    } catch {
      alert("Upload failed");
    }
  };

  const handleView = async (doc: any) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/documents/${doc.id}/view`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed");
      }

      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/pdf")) {
        throw new Error("Invalid file type received");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setSelectedDoc(doc);
      setFileUrl(url);
      setShowDocChat(false); // reset panel when opening a new doc
      setCurrentPage(1);
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleDownload = async () => {
    if (!selectedDoc) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://localhost:8000/documents/${selectedDoc.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Download failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedDoc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDocument(id);
      loadDocs();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCloseModal = () => {
    setSelectedDoc(null);
    setFileUrl(null);
    setCurrentPage(1);
    setShowDocChat(false);
  };

  return (
    <div className="flex flex-col h-full">

      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex justify-between items-center mb-6 relative">
        <h1 className="text-2xl font-semibold text-emerald-400">
          Document Dashboard
        </h1>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="bg-emerald-500 px-4 py-2 rounded"
          >
            Upload
          </button>

          {showMenu && (
            <div
              className="absolute right-0 mt-2 w-40 bg-slate-800 rounded shadow-lg border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-700"
              >
                📄 Choose File
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  alert("arXiv coming soon 🚀");
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-700"
              >
                📚 arXiv
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="application/pdf"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Documents Grid                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map((doc) => (
          <DocumentTile
            key={doc.id}
            id={doc.id}
            title={doc.filename}
            user={doc.owner?.username || "Unknown"}
            uploadedAt={doc.created_at}
            isOwner={doc.owner?.username === username}
            onDelete={handleDelete}
            onView={() => handleView(doc)}
          />
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PDF MODAL                                                           */}
      {/* ------------------------------------------------------------------ */}
      {selectedDoc && fileUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col z-50">

          {/* Top Bar */}
          <div className="flex justify-between items-center px-4 py-3 bg-slate-900 border-b border-slate-800">
            {/* Left: filename */}
            <h2 className="text-white text-sm font-medium truncate max-w-xs" title={selectedDoc.filename}>
              {selectedDoc.filename}
            </h2>

            {/* Right: actions */}
            <div className="flex gap-3 items-center flex-shrink-0">
              {/* Chat toggle button */}
              <button
                onClick={() => setShowDocChat((v) => !v)}
                title={showDocChat ? "Close document chat" : "Chat about this paper"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition ${
                  showDocChat
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                <span>💬</span>
                <span>{showDocChat ? "Close Chat" : "Chat"}</span>
              </button>

              <button
                onClick={handleDownload}
                className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded text-sm font-medium transition"
              >
                Download
              </button>

              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white text-xl leading-none transition"
                aria-label="Close PDF viewer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Main area: viewer + optional chat panel */}
          <div className="flex flex-row flex-1 overflow-hidden">

            {/* PDF Viewer */}
            <div
              ref={containerRef}
              className="flex-1 overflow-y-auto bg-slate-700 p-4"
            >
              {/* Zoom controls — sticky so they stay visible while scrolling */}
              <div className="sticky top-0 z-10 flex justify-end gap-2 mb-3">
                <button
                  onClick={() => setScale((prev) => Math.min(prev + 0.2, 3.0))}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded shadow text-sm transition"
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={() => setScale((prev) => Math.max(0.6, prev - 0.2))}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded shadow text-sm transition"
                  title="Zoom out"
                >
                  −
                </button>
              </div>

              {/* PDF Document */}
              <div className="flex flex-col items-center">
                <Document
                  file={fileUrl}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  onLoadError={(error) =>
                    console.error("PDF load error:", error)
                  }
                >
                  {Array.from(new Array(numPages), (_, index) => (
                    <div
                      key={index}
                      ref={(el) => {
                        pageRefs.current[index] = el;
                      }}
                      className="mb-4"
                    >
                      <Page pageNumber={index + 1} scale={scale} />
                    </div>
                  ))}
                </Document>
              </div>
            </div>

            {/* Doc Chat Panel (right side) */}
            {showDocChat && (
              <DocChatPanel
                docId={selectedDoc.id}
                docName={selectedDoc.filename}
                onClose={() => setShowDocChat(false)}
              />
            )}
          </div>

          {/* Page indicator — centred, above the bottom edge */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-1.5 rounded-full text-white text-sm pointer-events-none">
            {currentPage} / {numPages}
          </div>
        </div>
      )}

    </div>
  );
}
