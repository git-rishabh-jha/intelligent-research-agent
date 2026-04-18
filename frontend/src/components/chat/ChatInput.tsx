import { useState } from "react";

interface Props {
  onSend: (text: string) => void;
  loading: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  loading,
  placeholder = "Ask about your research papers…",
}: Props) {
  const [message, setMessage] = useState("");

  const canSend = message.trim().length > 0 && !loading;

  const handleSend = () => {
    if (!canSend) return;
    onSend(message.trim());
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 gap-3 focus-within:border-emerald-600 transition-colors">
      <input
        type="text"
        placeholder={placeholder}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        className="flex-1 bg-transparent outline-none text-slate-200 placeholder-slate-500 disabled:opacity-50 text-sm"
        autoFocus
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-black disabled:cursor-not-allowed px-5 py-2 rounded-xl text-sm font-medium transition-colors"
      >
        {loading ? (
          <span className="flex gap-0.5 items-center">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
          </span>
        ) : (
          "Send"
        )}
      </button>
    </div>
  );
}
