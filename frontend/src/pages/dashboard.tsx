import { useEffect, useState, useRef } from "react";
import DocumentTile from "../components/ui/DocumentTile";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
} from "../services/api";

import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ✅ REQUIRED for react-pdf
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

  const username = localStorage.getItem("username");

  const loadDocs = async () => {
    const data = await fetchDocuments();
    setDocuments(data);
  };

  useEffect(() => {
    loadDocs();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowMenu(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

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
      {
        threshold: 0.6,
      }
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
    } catch (err) {
      alert("Upload failed");
    }
  };

  const handleView = async (doc: any) => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `http://localhost:8000/documents/${doc.id}/view`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // ✅ VERY IMPORTANT CHECK
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed");
      }

      // ✅ Check content type
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/pdf")) {
        throw new Error("Invalid file type received");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setSelectedDoc(doc);
      setFileUrl(url);

    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleDownload = async () => {
    try {
      if (!selectedDoc) return;

      const token = localStorage.getItem("token");

      const res = await fetch(
        `http://localhost:8000/documents/${selectedDoc.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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
    await deleteDocument(id);
    loadDocs();
  };

  return (
      <div className="flex flex-col h-full">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 relative">
          <h1 className="text-2xl font-semibold text-emerald-400">
            Document Dashboard
          </h1>

          {/* Upload Button */}
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

        {/* Documents Grid */}
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

        {/* PDF MODAL */}
        {selectedDoc && fileUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col z-50">

            {/* Top Bar */}
            <div className="flex justify-between items-center p-4 bg-slate-900">
              <h2 className="text-white">{selectedDoc.filename}</h2>

              <div className="flex gap-4 items-center">
                <button
                  onClick={handleDownload}
                  className="bg-emerald-500 px-4 py-2 rounded"
                >
                  Download
                </button>

                <button
                  onClick={() => {
                    setSelectedDoc(null);
                    setFileUrl(null);
                    setCurrentPage(1);
                  }}
                  className="text-white text-xl"
                >
                  ✖
                </button>
              </div>
            </div>

            {/* Viewer */}
            <div
              ref={containerRef}
              className="flex flex-col items-center overflow-auto bg-slate-700 flex-1 p-4"
            >

              {/* Zoom Controls */}
              <div className="fixed top-20 right-6 z-50 flex gap-2">
                <button
                  onClick={() => setScale((prev) => prev + 0.2)}
                  className="bg-slate-900 text-white px-3 py-1 rounded"
                >
                  +
                </button>
                <button
                  onClick={() => setScale((prev) => Math.max(0.6, prev - 0.2))}
                  className="bg-slate-900 text-white px-3 py-1 rounded"
                >
                  -
                </button>
              </div>

              {/* SINGLE Document */}
              <Document
                file={fileUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={(error) => console.error("PDF load error:", error)}
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

            {/* Footer Page Indicator */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full text-white">
              {currentPage} / {numPages}
            </div>
          </div>
        )}

      </div>
  );
}