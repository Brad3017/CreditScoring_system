// Shared shell for the analyst and admin areas. Pure inline styles + the design
// tokens, so it does not depend on Tailwind.
import { useNavigate, useLocation } from "react-router-dom";
import { clearSession } from "../lib/api";
import { LogOut } from "lucide-react";

const SIDEBAR = "#14201c";
const SIDEBAR_LINE = "rgba(255,255,255,0.09)";
const SIDEBAR_TEXT = "#c9d3cd";

const css = `
.sb-root{display:grid;grid-template-columns:256px minmax(0,1fr);height:100vh;background:var(--paper);color:var(--ink);font-family:var(--font-body)}
.sb-side{background:${SIDEBAR};color:${SIDEBAR_TEXT};display:flex;flex-direction:column;justify-content:space-between;min-height:0;overflow-y:auto}
.sb-item{display:flex;align-items:center;gap:var(--space-3);width:100%;padding:var(--space-3) var(--space-4);border:0;border-radius:var(--radius);background:transparent;color:${SIDEBAR_TEXT};font:inherit;font-weight:600;text-align:left;text-decoration:none;cursor:pointer;box-sizing:border-box}
.sb-item:hover{background:rgba(255,255,255,0.07);color:#fff}
.sb-item:focus-visible{outline:2px solid #fff;outline-offset:2px}
.sb-item[aria-current="page"]{background:var(--accent-soft);color:#0a4541}
.sb-main{overflow-y:auto;min-width:0}
@media (max-width: 820px){
  .sb-root{grid-template-columns:1fr;height:auto;min-height:100vh}
  .sb-side{flex-direction:column}
  .sb-main{overflow:visible}
}
`;

export default function Sidebar({ title, subtitle, user, actions, children, nav, extras, roleLabel, brandNote }) {
  const navigate = useNavigate();
  const location = useLocation();

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : (user?.email || roleLabel || "U").substring(0, 2).toUpperCase();

  const isActive = (path, root) =>
    location.pathname === path || (path !== root && location.pathname.startsWith(path + "/"));

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="sb-root">
      <style>{css}</style>

      <aside className="sb-side">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-6)", borderBottom: `1px solid ${SIDEBAR_LINE}` }}>
            <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>B</div>
            <div>
              <div style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--text-lg)", lineHeight: 1.1 }}>BiasharaScore</div>
              <div style={{ fontSize: 12, color: "#8fa098" }}>{brandNote}</div>
            </div>
          </div>

          <nav aria-label="Main" style={{ padding: "var(--space-4)", display: "grid", gap: 4 }}>
            {nav.items.map(({ label, icon: Icon, path }) => (
              <button key={path} type="button" className="sb-item" onClick={() => navigate(path)} aria-current={isActive(path, nav.root) ? "page" : undefined}>
                <Icon size={18} aria-hidden="true" /> {label}
              </button>
            ))}
            {extras && (
              <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: `1px solid ${SIDEBAR_LINE}`, display: "grid", gap: 4 }}>
                {extras.map(({ label, icon: Icon, path, href }) =>
                  href ? (
                    // Full page load on purpose: this path is served by Django, not React.
                    <a key={href} href={href} className="sb-item"><Icon size={18} aria-hidden="true" /> {label}</a>
                  ) : (
                    <button key={path} type="button" className="sb-item" onClick={() => navigate(path)}><Icon size={18} aria-hidden="true" /> {label}</button>
                  )
                )}
              </div>
            )}
          </nav>
        </div>

        <div style={{ padding: "var(--space-4)", borderTop: `1px solid ${SIDEBAR_LINE}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2)", minWidth: 0 }}>
            <div aria-hidden="true" style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", border: `1px solid ${SIDEBAR_LINE}`, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.full_name || user?.email || roleLabel}</div>
              <div style={{ fontSize: 12, color: "#8fa098" }}>{roleLabel}</div>
            </div>
          </div>
          <button type="button" className="sb-item" onClick={logout} style={{ marginTop: "var(--space-2)", color: "#f0a999" }}>
            <LogOut size={16} aria-hidden="true" /> Log out
          </button>
        </div>
      </aside>

      <div className="sb-main">
        <header style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap", padding: "var(--space-5) var(--space-8)", background: "var(--surface)", borderBottom: "1px solid var(--line-strong)" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: "var(--text-xl)" }}>{title}</h1>
            {subtitle && <p style={{ margin: "2px 0 0", color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{subtitle}</p>}
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>{actions}</div>
        </header>
        <main style={{ padding: "var(--space-8)", maxWidth: 1240, margin: "0 auto", display: "grid", gap: "var(--space-6)", boxSizing: "border-box" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
