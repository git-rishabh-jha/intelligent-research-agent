import { useState } from "react";
import ChatWindow from "../components/chat/ChatWindow";
import ChatInput from "../components/chat/ChatInput";

export default function Chat() {
  const [chatStarted, setChatStarted] = useState(false);

  return (
      <div className="h-full flex flex-col">

        {!chatStarted ? (
          // Landing State
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center w-full max-w-2xl">
              <h1 className="text-5xl font-bold mb-10">
                Research Assistant
              </h1>

              <ChatInput 
                showUpload={!chatStarted}
                onFirstMessage={() => setChatStarted(true)} 
              />
            </div>
          </div>
        ) : (
          // Active Chat State
          <>
            <h1 className="text-2xl font-semibold mb-6 text-center">
              Research Assistant
            </h1>

            <div className="flex-1 overflow-y-auto">
              <ChatWindow />
            </div>

            <div className="mt-6">
              <ChatInput showUpload={false} />
            </div>
          </>
        )}

      </div>
  );
}