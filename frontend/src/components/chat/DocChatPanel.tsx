import { useEffect, useRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import {
  getIndexStatus,
  chatWithDocument,
  type EmbeddingStatus,
} from "../../services/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DocChatPanelProps {
  docId: number;
  docName: string;
  onClose: () => void;
}

export default function DocChatPanel({
  docId,
  docName,
  onClose,
}: DocChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [indexStatus, setIndexStatus] = useState<EmbeddingStatus | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Poll indexing status every 3 s until is_indexed === 1 or 2
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Reset state when document changes
    setMessages([]);
    setInput("");
    setIndexStatus(null);

    let cancelled = false;

    const poll = async () => {
      try {
        const status = await getIndexStatus(docId);
        if (!cancelled) {
          setIndexStatus(status);
        }
      } catch {
        // Ollama or server not ready yet — keep polling
      }
    };

    poll(); // Immediate first check

    const interval = setInterval(async () => {
      try {
        const status = await getIndexStatus(docId);
        if (cancelled) return;
        setIndexStatus(status);
        if (status.is_indexed !== 0) {
          clearInterval(interval);
        }
      } catch {
        // ignore transient errors
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [docId]);

  // ---------------------------------------------------------------------------
  // Auto-scroll to newest message
  // ---------------------------------------------------------------------------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ---------------------------------------------------------------------------
  // Focus input when indexing completes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (indexStatus?.is_indexed === 1) {
      inputRef.current?.focus();
    }
  }, [indexStatus?.is_indexed]);

  // ---------------------------------------------------------------------------
  // Send a message
  // ---------------------------------------------------------------------------
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || indexStatus?.is_indexed !== 1) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setIsLoading(true);

    try {
      const data = await chatWithDocument(docId, trimmed);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message ?? "Unknown error"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---------------------------------------------------------------------------
  // Indexing state helpers
  // ---------------------------------------------------------------------------
  const isPending = !indexStatus || indexStatus.is_indexed === 0;
  const isFailed = indexStatus?.is_indexed === 2;
  const isReady = indexStatus?.is_indexed === 1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="w-80 flex flex-col bg-slate-900 border-l border-slate-700 flex-shrink-0">
      {/* Header */}
      <div className="flex items-start justify-between p-3 border-b border-slate-700">
        <div className="min-w-0">
          <p className="text-emerald-400 text-sm font-semibold">Document Chat</p>
          <p className="text-slate-400 text-xs truncate mt-0.5" title={docName}>
            {docName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-lg ml-2 flex-shrink-0 transition"
          aria-label="Close chat panel"
        >
          ✕
        </button>
      </div>

      {/* Indexing pending */}
      {isPending && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-slate-600 border-t-emerald-400 animate-spin mb-4" />
          <p className="text-slate-300 text-sm font-medium">Indexing document…</p>
          <p className="text-slate-500 text-xs mt-2 leading-relaxed">
            Extracting text, chunking, and generating embeddings.
            <br />
            This usually takes 30–90 seconds.
          </p>
        </div>
      )}

      {/* Indexing failed */}
      {isFailed && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-red-400 text-sm font-medium mb-2">Indexing failed</p>
          <p className="text-slate-500 text-xs leading-relaxed">
            {indexStatus?.error_message ?? "Unknown error during indexing."}
          </p>
          <p className="text-slate-600 text-xs mt-3">
            Try re-uploading the document or check that Ollama is running.
          </p>
        </div>
      )}

      {/* Chat area — only shown when indexed */}
      {isReady && (
        <>
          {/* Message list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <p className="text-slate-500 text-xs leading-relaxed">
                  Ask anything about this paper.
                  <br />
                  The AI answers based only on the document content.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-emerald-300 px-4 py-3 rounded-lg text-sm font-mono">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>•</span>
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="p-3 border-t border-slate-700">
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 gap-2 focus-within:border-emerald-500 transition">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about this paper…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1 bg-transparent outline-none text-slate-200 placeholder-slate-500 text-sm disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
