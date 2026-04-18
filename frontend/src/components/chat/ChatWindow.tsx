import { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import type { ChatMessage as ChatMessageType } from "../../services/api";

interface Props {
  messages: ChatMessageType[];
  loading: boolean;
}

export default function ChatWindow({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex flex-col space-y-5 px-4 py-4 max-w-3xl mx-auto w-full">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          role={msg.role}
          content={msg.content}
          intent={msg.intent}
        />
      ))}

      {loading && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white select-none">
            AI
          </div>
          <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3">
            <div className="flex gap-1 items-center h-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
