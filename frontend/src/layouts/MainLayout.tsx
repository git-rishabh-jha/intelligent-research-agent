import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getChatSessions, deleteChatSession, type ChatSession } from "../services/api";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const username = localStorage.getItem("username") || "User";
  const firstLetter = username.charAt(0).toUpperCase();

  const isDashboard = location.pathname === "/dashboard";

  const activeSessionId = (() => {
    const p = new URLSearchParams(location.search);
    const v = p.get("session");
    return v ? parseInt(v, 10) : null;
  })();

  useEffect(() => {
    getChatSessions().then(setSessions).catch(() => {});
  }, [location]);

  const handleNewChat = () => {
    navigate("/chat");
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteChatSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) navigate("/chat");
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");

    navigate("/", { replace: true });
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex overflow-hidden">

      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between h-full overflow-y-auto">

        {/* Top Section */}
        <div>
          {/* Doc Dashboard Button */}
          <div className="p-4">
            <button
              onClick={() => navigate("/dashboard")}
              className={`w-full font-semibold py-2 rounded-lg shadow-md transition-all duration-300
                ${
                  isDashboard
                    ? "bg-emerald-500 text-black shadow-emerald-500/30"
                    : "bg-slate-800 hover:bg-slate-700"
                }
              `}
            >
              Doc Dashboard
            </button>
          </div>

          {/* New Chat Button */}
          <div className="px-4">
            <button
              onClick={handleNewChat}
              className="w-full text-sm py-2 rounded-lg transition bg-slate-800 hover:bg-slate-700"
            >
              + New Chat
            </button>
          </div>

          {/* Chat History */}
          <div className="mt-8 px-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">
              Recent Chats
            </p>

            <div className="space-y-1">
              {sessions.length === 0 ? (
                <p className="text-xs text-slate-600 px-3 py-2">No chats yet</p>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => navigate(`/chat?session=${s.id}`)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer transition ${
                        isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate flex-1 min-w-0">{s.title}</span>
                      <button
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        disabled={deletingId === s.id}
                        className="ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity disabled:opacity-30"
                        title="Delete chat"
                      >
                        {deletingId === s.id ? "…" : "×"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom User Section */}
        <div className="relative p-4 border-t border-slate-800">

          <button
            onClick={() => setOpenMenu(!openMenu)}
            className="w-full flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg transition"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-semibold text-black">
              {firstLetter}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">{username}</p>
              <p className="text-xs text-slate-400">Pro Plan</p>
            </div>
          </button>

          {/* Dropdown */}
          {openMenu && (
            <div className="absolute bottom-16 left-4 right-4 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 text-sm hover:bg-slate-700 transition"
              >
                Logout
              </button>
            </div>
          )}

        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>

    </div>
  );
}