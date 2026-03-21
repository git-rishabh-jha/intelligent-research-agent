import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState(false);

  const username = localStorage.getItem("username") || "User";
  const firstLetter = username.charAt(0).toUpperCase();

  const isDashboard = location.pathname === "/dashboard";
  const isChat = location.pathname === "/chat";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");

    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">

      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between">

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
              onClick={() => navigate("/chat", { replace: false })}
              className={`w-full text-sm py-2 rounded-lg transition
                ${
                  isChat
                    ? "bg-slate-700"
                    : "bg-slate-800 hover:bg-slate-700"
                }
              `}
            >
              + New Chat
            </button>
          </div>

          {/* Chat History */}
          <div className="mt-8 px-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">
              Recent Chats
            </p>

            <div className="space-y-2">
              <div className="px-3 py-2 rounded-md bg-slate-800 text-sm truncate cursor-pointer hover:bg-slate-700">
                AI Research Discussion
              </div>

              <div className="px-3 py-2 rounded-md text-sm truncate cursor-pointer hover:bg-slate-800">
                Marketing Strategy Ideas
              </div>

              <div className="px-3 py-2 rounded-md text-sm truncate cursor-pointer hover:bg-slate-800">
                Code Optimization Help
              </div>
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
      <main className="flex-1 p-8 overflow-hidden">
        {children}
      </main>

    </div>
  );
}