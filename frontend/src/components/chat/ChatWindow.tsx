import ChatMessage from "./ChatMessage";

export default function ChatWindow() {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto space-y-6 pr-4">
      
      <ChatMessage
        role="user"
        content="What are the latest advancements in AI research?"
      />

      <ChatMessage
        role="assistant"
        content="Recent advancements include multimodal models, agent-based systems, and reasoning-optimized LLMs."
      />

    </div>
  );
}