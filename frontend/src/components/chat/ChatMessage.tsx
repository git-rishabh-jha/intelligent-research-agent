import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  role: "user" | "assistant";
  content: string;
  intent?: string | null;
}

/** Parse inline tokens: **bold** and [label](url) */
function parseInline(text: string, navigate: ReturnType<typeof useNavigate>): ReactNode[] {
  const TOKEN_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(TOKEN_RE);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = href.startsWith("/");
      return isInternal ? (
        <button
          key={i}
          onClick={() => navigate(href)}
          className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 cursor-pointer"
        >
          {label}
        </button>
      ) : (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
        >
          {label}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Render full content: split on newlines, parse inline tokens per line. */
function renderContent(text: string, navigate: ReturnType<typeof useNavigate>): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, li) => (
    <span key={li}>
      {parseInline(line, navigate)}
      {li < lines.length - 1 && <br />}
    </span>
  ));
}

const INTENT_BADGE: Record<string, string> = {
  LIST_PAPERS:     "bg-blue-900/50 text-blue-300 border-blue-700/50",
  COUNT_PAPERS:    "bg-purple-900/50 text-purple-300 border-purple-700/50",
  ANSWER_QUESTION: "bg-slate-700/50 text-slate-400 border-slate-600/50",
  IRRELEVANT:      "bg-amber-900/40 text-amber-300 border-amber-700/50",
};

const INTENT_LABEL: Record<string, string> = {
  LIST_PAPERS:     "Paper Search",
  COUNT_PAPERS:    "Count",
  ANSWER_QUESTION: "Q&A",
  IRRELEVANT:      "Off-topic",
};

export default function ChatMessage({ role, content, intent }: Props) {
  const navigate = useNavigate();
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-emerald-600 text-white rounded-2xl rounded-br-none px-4 py-3 text-sm leading-relaxed">
          {content}
        </div>
      </div>
    );
  }

  const badgeClass = intent ? INTENT_BADGE[intent] ?? INTENT_BADGE.ANSWER_QUESTION : null;
  const badgeLabel = intent ? INTENT_LABEL[intent] ?? intent : null;

  return (
    <div className="flex items-start gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-emerald-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white select-none">
        AI
      </div>

      <div className="flex flex-col gap-1.5 max-w-[80%]">
        {/* Intent badge */}
        {badgeLabel && (
          <span
            className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}
          >
            {badgeLabel}
          </span>
        )}

        {/* Bubble */}
        <div
          className={`rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed ${
            intent === "IRRELEVANT"
              ? "bg-amber-900/30 border border-amber-700/40 text-amber-200"
              : "bg-slate-800 text-slate-200"
          }`}
        >
          {renderContent(content, navigate)}
        </div>
      </div>
    </div>
  );
}
