import { useNavigate, useLocation } from "react-router-dom";
import { clearSession } from "../lib/api";
import { LayoutDashboard, Cpu, Scale, Users, ClipboardList, Database, LogOut } from "lucide-react";

const NAV = [
  { label: "Overview", icon: LayoutDashboard, path: "/console" },
  { label: "Model monitor", icon: Cpu, path: "/console/model" },
  { label: "Fairness check", icon: Scale, path: "/console/fairness" },
  { label: "Users", icon: Users, path: "/console/users" },
];

export default function AdminLayout({ title, subtitle, user, actions, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : "AD";

  function logout() {
    clearSession();
    navigate("/login");
  }

  const linkBtn =
    "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-slate-400 hover:text-white hover:bg-white/5";

  return (
    <div className="flex h-screen bg-[#F4F6FA] font-sans antialiased text-slate-800 overflow-hidden">
      <aside className="w-64 bg-[#090D14] flex flex-col justify-between border-r border-slate-900 z-20 shrink-0">
        <div>
          <div className="px-6 py-6 border-b border-white/5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg shadow-md">B</div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight tracking-tight">BiasharaScore</h2>
              <span className="text-[11px] text-slate-400 font-medium">Administration</span>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            {NAV.map((item) => {
              const active =
                location.pathname === item.path ||
                (item.path !== "/console" && location.pathname.startsWith(item.path + "/"));
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    active ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-white/5 space-y-1.5">
              <button onClick={() => navigate("/analyst/requests")} className={linkBtn}>
                <ClipboardList size={18} /> Review queue
              </button>
              {/* Full page load on purpose: this path is served by Django, not React. */}
              <a href="/admin/" className={linkBtn}>
                <Database size={18} /> Data admin (Django)
              </a>
            </div>
          </nav>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#070A0F] space-y-2">
          <div className="flex items-center gap-3 p-2 overflow-hidden">
            <div className="h-9 w-9 rounded-full bg-slate-800 text-white border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">{initials}</div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || user?.email || "Administrator"}</p>
              <p className="text-[10px] text-slate-400 truncate">Administrator</p>
            </div>
          </div>
          <div className="pt-2 border-t border-white/5 px-2 text-xs">
            <button onClick={logout} className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors">
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between bg-white border-b border-slate-200/80 sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">{actions}</div>
        </header>
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6">{children}</main>
      </div>
    </div>
  );
}
