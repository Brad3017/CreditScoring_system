import { NavLink, Link, useNavigate } from "react-router-dom";
import { clearSession, getSessionUser } from "../lib/api";

const links = [
  { to: "/home", label: "Overview" },
  { to: "/assessment/new", label: "New assessment" },
  { to: "/assessments", label: "History" },
  { to: "/analytics", label: "Analytics" },
  { to: "/profile", label: "Business profile" },
];

// Top-bar layout for borrower pages. Styles live in tokens.css (.app-*), because the
// bar needs breakpoints: full-width header, 1440px inner grid, scrollable nav below 900px.
export default function AppShell({ user: userProp, children }) {
  const navigate = useNavigate();
  // The user stored at login is always available, so the bar never waits on (or fails with) /auth/me/.
  const user = userProp?.email ? { ...getSessionUser(), ...userProp } : getSessionUser();
  const name = user?.full_name?.trim() || user?.email || "";
  const initials = user?.full_name?.trim()
    ? user.full_name.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase()
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
            {name && (
              <>
                <span className="app-avatar" aria-hidden="true">{initials}</span>
                <div className="app-user-text">
                  <div className="app-user-name">{name}</div>
                  {user?.full_name?.trim() && <div className="app-user-email">{user.email}</div>}
                </div>
              </>
            )}
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
