export default function ChatMessage({
  role,
  content,
}: {
  role: "user" | "assistant"
  content: string
}) {
  const isUser = role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-xl px-4 py-3 rounded-lg text-sm
          ${
            isUser
              ? "bg-indigo-600 dark:bg-cyan-600 text-white"
              : "bg-gray-200 dark:bg-slate-800 text-gray-900 dark:text-emerald-300 font-mono"
          }
        `}
      >
        {content}
      </div>
    </div>
  )
}