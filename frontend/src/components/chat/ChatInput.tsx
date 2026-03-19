import { useState, useRef } from "react";

interface ChatInputProps {
  onFirstMessage?: () => void;
  showUpload?: boolean;
}

export default function ChatInput({ onFirstMessage, showUpload=false }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [openMenu, setOpenMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!message.trim()) return;

    if (onFirstMessage) {
      onFirstMessage();
    }

    console.log("Message:", message);
    setMessage("");
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
    setOpenMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("Uploaded file:", file.name);
    }
  };

  const handleArxivClick = () => {
    console.log("arXiv option selected");
    setOpenMenu(false);
  };

  return (
    <div className="relative">
      
      <div className="flex items-center bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 w-full">

        {/* + Button */}
        {showUpload && (
          <button
            onClick={() => setOpenMenu(!openMenu)}
            className="mr-3 text-emerald-400 text-xl hover:text-emerald-300 transition"
          >
            +
          </button>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <input
          type="text"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 bg-transparent outline-none text-slate-200 placeholder-slate-400"
        />

        <button
          onClick={handleSend}
          className="ml-3 bg-emerald-500 hover:bg-emerald-600 text-black px-5 py-2 rounded-xl transition"
        >
          Send
        </button>
      </div>

      {/* Dropdown Menu */}
      {openMenu && (
        <div className="absolute bottom-16 left-2 bg-slate-900 border border-slate-700 rounded-xl shadow-lg w-40 overflow-hidden animate-fadeIn">
          
          <button
            onClick={handleUploadClick}
            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-800 transition"
          >
            📄 Choose File
          </button>

          <button
            onClick={handleArxivClick}
            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-800 transition"
          >
            📚 arXiv
          </button>

        </div>
      )}
    </div>
  );
}