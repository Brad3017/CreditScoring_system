import { useNavigate, useLocation } from "react-router-dom";
import { clearSession } from "../lib/api";
import {
  LayoutDashboard,
  FileText,
  Building2,
  BarChart3,
  History,
  User,
  LogOut,
  Bell,
  Settings,
} from "lucide-react";

export default function AnalystLayout({ title, subtitle, user, children, actions }) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "CA";

  const navItems = [
    { label: "Overview", icon: LayoutDashboard, path: "/analyst" },
    { label: "Assessment Requests", icon: FileText, path: "/analyst/requests" },
    { label: "MSME Records", icon: Building2, path: "/analyst/msmes" },
    { label: "Risk Analytics", icon: BarChart3, path: "/analyst/analytics" },
    { label: "Review History", icon: History, path: "/analyst/reviews" },
    { label: "My Profile", icon: User, path: "analyst/profile" },
  ];

  return (
    <div className="flex h-screen bg-[#F4F6FA] font-sans antialiased text-slate-800 overflow-hidden">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-64 bg-[#090D14] flex flex-col justify-between border-r border-slate-900 z-20 shrink-0">
        <div>
          <div className="px-6 py-6 border-b border-white/5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg shadow-md">
              BS
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight tracking-tight">
                BiasharaScore
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                AI-Powered Credit Intelligence
              </span>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const active = location.pathname === item.path ||
           (item.path !== "/analyst" && location.pathname.startsWith(item.path + "/"));
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? "bg-white text-black shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} className={active ? "text-black" : "text-slate-400"} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#070A0F] space-y-2">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-slate-800 text-white border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                {initials}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.full_name || "Credit Analyst"}
                </p>
                <p className="text-[10px] text-slate-400 truncate">Credit Analyst</p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between px-2 text-xs text-slate-400">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Settings size={14} />
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors"
            >
              <LogOut size={14} />
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between bg-white border-b border-slate-200/80 sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-4">
            {actions}
            <button className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 relative">
              <Bell size={16} />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">{children}</main>
      </div>
    </div>
  );
}