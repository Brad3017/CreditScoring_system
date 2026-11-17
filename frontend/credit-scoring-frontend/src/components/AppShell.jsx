import { useEffect, useId, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Building2 } from "lucide-react";
import { clearSession, getSessionUser } from "../lib/api";

// Business profile lives in the account menu, not here.
const links = [
  { to: "/home", label: "Overview" },
  { to: "/assessment/new", label: "New assessment" },
  { to: "/assessments", label: "History" },
  { to: "/analytics", label: "Analytics" },
  { to: "/learn", label: "Learn" },
];

// Top-bar layout for borrower pages. Styles live in tokens.css (.app-*): a three-column grid
// (brand | nav | account) whose nav column scrolls inside itself, so the columns never overlap.
export default function AppShell({ user: userProp, children }) {
  // The user stored at login is always available, so the bar never waits on (or fails with) /auth/me/.
  const user = userProp?.email ? { ...getSessionUser(), ...userProp } : getSessionUser();

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/home" className="app-brand">
            <span className="app-brand-mark" aria-hidden="true">B</span>
            <span className="app-brand-text">BiasharaScore</span>
          </Link>

          <nav aria-label="Main" className="app-nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <AccountMenu user={user} />
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}

// One account button (initials + first name + chevron) that opens a small menu with the full
// name and email, Business profile and Sign out. Menu-button pattern: Esc and outside click close
// it, arrow keys / Home / End move between items, Tab closes it and moves on.
function AccountMenu({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const fullName = user?.full_name?.trim() || "";
  const email = user?.email || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : email.split("@")[0];
  const initials = fullName
    ? fullName.split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const items = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);

  // Outside click (or tap) closes without stealing focus.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function onButtonKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onMenuKeyDown(e) {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  function signOut() {
    clearSession();
    navigate("/login");
  }

  if (!email && !fullName) return null;

  return (
    <div className="app-account" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="app-account-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account: ${fullName || email}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
      >
        <span className="app-avatar" aria-hidden="true">{initials}</span>
        <span className="app-account-name" aria-hidden="true">{firstName}</span>
        <ChevronDown size={16} className="app-account-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="app-menu" onKeyDown={onMenuKeyDown}>
          <div className="app-menu-who">
            {fullName && <div className="app-menu-name">{fullName}</div>}
            <div className="app-menu-email">{email}</div>
          </div>
          <div id={menuId} role="menu" aria-label="Account" ref={menuRef}>
            <Link
              to="/profile"
              role="menuitem"
              className="app-menu-item"
              aria-current={location.pathname === "/profile" ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Building2 size={18} aria-hidden="true" /> Business profile
            </Link>
            <button type="button" role="menuitem" className="app-menu-item app-menu-signout" onClick={signOut}>
              <LogOut size={18} aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
