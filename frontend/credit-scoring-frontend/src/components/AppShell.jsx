import { NavLink, Link, useNavigate } from "react-router-dom";
import { clearSession } from "../lib/api";

const links = [
  { to: "/home", label: "Overview" },
  { to: "/assessment/new", label: "New assessment" },
  { to: "/assessments", label: "History" },
  { to: "/analytics", label: "Analytics" },
  { to: "/profile", label: "Business profile" },
];

// Top-bar layout for borrower pages. Styles live in tokens.css (.app-*), because the
// bar needs breakpoints: full-width header, 1440px inner grid, scrollable nav below 900px.
export default function AppShell({ user, children }) {
  const navigate = useNavigate();
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : (user?.email || "").slice(0, 2).toUpperCase();

  function signOut() {
    clearSession();
    navigate("/login");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/home" className="app-brand">
            <span className="app-brand-mark" aria-hidden="true">B</span>
            BiasharaScore
          </Link>

          <nav aria-label="Main" className="app-nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="app-user">
            <span className="app-avatar" aria-hidden="true">{initials || "?"}</span>
            <div className="app-user-text">
              <div className="app-user-name">{user?.full_name || "Signed in"}</div>
              {user?.email && <div className="app-user-email">{user.email}</div>}
            </div>
            <span className="app-divider" aria-hidden="true" />
            <button type="button" className="btn btn-secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
