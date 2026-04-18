import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ChatWindow from "../components/chat/ChatWindow";
import ChatInput from "../components/chat/ChatInput";
import {
  createChatSession,
  getChatSession,
  sendChatMessage,
  type ChatMessage,
} from "../services/api";

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const creatingSession = useRef(false);

  const sessionParam = searchParams.get("session");

  // Load session when URL param changes
  useEffect(() => {
    if (!sessionParam) {
      setSessionId(null);
      setMessages([]);
      setMessageCount(0);
      setError(null);
      return;
    }
    const id = parseInt(sessionParam, 10);
    if (isNaN(id)) {
      setSearchParams({});
      return;
    }
    setSessionLoading(true);
    getChatSession(id)
      .then((s) => {
        setSessionId(s.id);
        setMessages(s.messages);
        setMessageCount(s.messages.filter((m) => m.role === "user").length);
        setError(null);
      })
      .catch(() => {
        setSearchParams({});
      })
      .finally(() => setSessionLoading(false));
  }, [sessionParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (text: string) => {
    if (loading) return;

    setError(null);
    setLoading(true);

    // Optimistic user bubble
    const tempId = Date.now();
    const optimistic: ChatMessage = {
      id: tempId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      let activeId = sessionId;

      if (!activeId) {
        if (creatingSession.current) return;
        creatingSession.current = true;
        const session = await createChatSession();
        activeId = session.id;
        setSessionId(activeId);
        setSearchParams({ session: String(activeId) });
        creatingSession.current = false;
      }

      const res = await sendChatMessage(activeId, text);

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        res.user_message,
        res.assistant_message,
      ]);
      setMessageCount((c) => c + 1);
    } catch (err: any) {
      // Remove optimistic message and show inline error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hasMessages = messages.length > 0;
  const atLimit = messageCount >= 20;

  return (
    <div className="h-full flex flex-col">
      {!hasMessages && !sessionLoading ? (
        /* ── Landing state ── */
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-2xl text-center">
            <h1 className="text-4xl font-bold text-white mb-3">
              Research Assistant
            </h1>
            <p className="text-slate-400 text-sm mb-10">
              Find papers · Count documents · Ask questions about your research library
            </p>
            <ChatInput onSend={handleSend} loading={loading} />
            {error && (
              <p className="mt-3 text-red-400 text-sm">{error}</p>
            )}
          </div>
        </div>
      ) : (
        /* ── Active chat ── */
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {sessionLoading ? (
              <div className="flex justify-center items-center h-full text-slate-500 text-sm">
                Loading conversation…
              </div>
            ) : (
              <ChatWindow messages={messages} loading={loading} />
            )}
          </div>

          {/* Message limit warning */}
          {atLimit && (
            <div className="text-center py-2 text-amber-400 text-xs border-t border-slate-800">
              This chat has reached the 20-message limit — start a new chat to continue.
            </div>
          )}

          {/* Error banner */}
          {error && (
            <p className="text-center text-red-400 text-xs py-1">{error}</p>
          )}

          {/* Input */}
          <div className="border-t border-slate-800 px-4 py-4">
            <div className="max-w-3xl mx-auto">
              <ChatInput
                onSend={handleSend}
                loading={loading}
                placeholder={
                  atLimit
                    ? "Message limit reached — start a new chat"
                    : "Ask about your research papers…"
                }
              />
              {!atLimit && (
                <p className="text-right text-xs text-slate-600 mt-1">
                  {messageCount}/20 messages
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
