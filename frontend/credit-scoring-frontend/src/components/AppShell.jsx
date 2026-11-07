import { NavLink, useNavigate } from "react-router-dom";
import { clearSession } from "../lib/api";

const links = [
  { to: "/home", label: "Overview" },
  { to: "/assessment/new", label: "New assessment" },
  { to: "/assessments", label: "History" },
  { to: "/analytics", label: "Analytics" },
  { to: "/profile", label: "Business profile" },
];

// Top-bar layout for borrower pages. Replaces the dark sidebar.
export default function AppShell({ user, children }) {
  const navigate = useNavigate();
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "";

  function signOut() {
    clearSession();
    navigate("/login");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--line)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: "var(--measure)",
            margin: "0 auto",
            padding: "var(--space-5) var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-8)",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600 }}>
            BiasharaScore
          </span>

          <nav aria-label="Main" style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", flex: 1 }}>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                style={({ isActive }) => ({
                  color: isActive ? "var(--ink)" : "var(--ink-2)",
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: "none",
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  paddingBottom: "2px",
                })}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginLeft: "auto", paddingLeft: "var(--space-6)", borderLeft: "1px solid var(--line)" }}>
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "grid",
                placeItems: "center",
                fontWeight: 600,
                fontSize: "var(--text-xs)",
              }}
            >
              {initials || "?"}
            </span>
            <div style={{ fontSize: "var(--text-xs)", lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600 }}>{user?.full_name || "Signed in"}</div>
              <div style={{ color: "var(--ink-2)" }}>{user?.email || ""}</div>
            </div>
            <button type="button" className="btn btn-secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "var(--measure)", margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
        {children}
      </main>
    </div>
  );
}
