import { useEffect, useRef, useState } from "react";
import { getFullSummary, summarizeSelectedText } from "../../services/api";

type Mode = "full" | "text" | null;

type Props = {
  docId: number;
  onClose: () => void;
};

export default function SummarizePanel({ docId, onClose }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [summaryText, setSummaryText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ------------------------------------------------------------------
  // Listen for text selections in the PDF viewer and mirror them into
  // the textarea automatically, without waiting for a button click.
  // We skip selections that originate inside our own textarea so manual
  // edits aren't overwritten.
  // ------------------------------------------------------------------
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text) return;

      // Ignore selections that are inside the textarea itself
      const anchor = sel?.anchorNode;
      if (anchor && textareaRef.current?.contains(anchor)) return;

      setSelectedText(text);
      // Auto-switch to text mode so the user sees the textarea fill up
      setMode("text");
      setSummaryText("");
      setError(null);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  // Scroll output to top whenever new summary arrives
  const showSummary = (text: string) => {
    setSummaryText(text);
    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollTop = 0;
    }, 0);
  };

  const handleFullSummary = async () => {
    setMode("full");
    setSummaryText("");
    setError(null);
    setLoading(true);
    try {
      const res = await getFullSummary(docId);
      showSummary(res.content);
    } catch (err: any) {
      setError(err.message || "Summarization failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTextModeOpen = () => {
    // Capture whatever is currently selected (may already be set by
    // the selectionchange listener, but grab it again as a fallback)
    const sel = window.getSelection()?.toString().trim() ?? "";
    if (sel) setSelectedText(sel);
    setSummaryText("");
    setError(null);
    setMode("text");
  };

  const handleTextSummarize = async () => {
    if (!selectedText.trim()) {
      setError("No text to summarize. Highlight text in the PDF viewer or paste it below.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await summarizeSelectedText(docId, selectedText);
      showSummary(res.content);
    } catch (err: any) {
      setError(err.message || "Summarization failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (summaryText) navigator.clipboard.writeText(summaryText);
  };

  const modeLabel =
    mode === "full" ? "Full Paper Summary" : mode === "text" ? "Selected Text Summary" : "";

  return (
    <div className="w-80 flex-shrink-0 border-l border-slate-700 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-base">📄</span>
          <span className="text-sm font-semibold text-white">Summarize</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-lg leading-none transition"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">

        {/* Mode buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleFullSummary}
            disabled={loading}
            className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition disabled:opacity-50 ${
              mode === "full"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            📰 Full Paper Summary
          </button>

          <button
            onClick={handleTextModeOpen}
            disabled={loading}
            className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition disabled:opacity-50 ${
              mode === "text"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            ✏️ Selected Text
          </button>
        </div>

        {/* Selected text area */}
        {mode === "text" && (
          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
              placeholder="Highlight text in the PDF — it appears here automatically. Or paste manually."
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-300 resize-none h-24 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleTextSummarize}
              disabled={loading || !selectedText.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded transition"
            >
              {loading ? "Summarizing…" : "Summarize"}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-4 text-slate-400 text-sm text-center">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            {mode === "full" ? (
              <>
                <p>Generating summary…</p>
                <p className="text-xs text-slate-500">
                  First run takes 1–3 min. Result is cached — instant next time.
                </p>
              </>
            ) : (
              <p>Summarizing selected text…</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <p className="text-red-400 text-xs px-1">{error}</p>
        )}

        {/* Output */}
        {summaryText && !loading && (
          <div className="flex flex-col flex-1 overflow-hidden gap-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-slate-500 uppercase tracking-wide">
                {modeLabel}
              </span>
              <button
                onClick={handleCopy}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
            <div
              ref={outputRef}
              className="flex-1 overflow-y-auto bg-slate-800 rounded p-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap"
            >
              {summaryText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
