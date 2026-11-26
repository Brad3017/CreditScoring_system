// The bell in the top bar of every signed-in layout (owner, analyst, admin): unread count, and a panel
// with the latest 10 notifications. Styles: tokens.css (.notif-*).
//
// Polling: GET /notifications/unread-count/ on mount and on every route change, then every 60 s while the
// tab is visible (paused while hidden, refreshed as soon as it is visible again). A failed request keeps
// the last known count and shows nothing: polling never shows an error.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { fetchNotifications, markAllNotificationsRead } from "../lib/api";
import { openNotification, refreshUnreadCount as refreshCount, relativeTime } from "../lib/notifications";
import { useUnreadCount } from "../lib/unreadStore";

const POLL_MS = 60_000;
const PANEL_WIDTH = 360;
const PANEL_MAX_HEIGHT = 420;
const GUTTER = 16;

export function NotificationItem({ n, onOpen, now }) {
  const unread = !n.read_at;
  return (
    <button type="button" className="notif-item" data-unread={unread} onClick={() => onOpen(n)}>
      <span className="notif-dot" aria-hidden="true" />
      <span style={{ minWidth: 0 }}>
        <span className="notif-title">
          {unread && <span className="sr-only">Unread: </span>}
          {n.title}
        </span>
        <span className="notif-msg">{n.message}</span>
        <time className="notif-time" dateTime={n.created_at}>{relativeTime(n.created_at, now)}</time>
      </span>
    </button>
  );
}

function usePolling() {
  const { pathname } = useLocation();

  // Mount and every route change (each page mounts its own layout, so this is also the mount call).
  useEffect(() => {
    refreshCount();
  }, [pathname]);

  useEffect(() => {
    let timer = null;
    const start = () => {
      if (!timer) timer = setInterval(refreshCount, POLL_MS);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshCount();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}

// A short scale pulse when the count goes up while the page is open (none on first load or remount).
function useBump(unread) {
  const previous = useRef(unread);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    const before = previous.current;
    previous.current = unread;
    if (before == null || unread == null || unread <= before) return undefined;
    setBump(true);
    const t = setTimeout(() => setBump(false), 650);
    return () => clearTimeout(t);
  }, [unread]);
  return bump;
}

// Fixed position under the bell, kept inside the viewport (16 px gutter) whatever the header layout.
function usePanelPosition(open, buttonRef) {
  const [style, setStyle] = useState(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = document.documentElement.clientWidth;
      const width = Math.min(PANEL_WIDTH, vw - 2 * GUTTER);
      const left = Math.min(Math.max(r.right - width, GUTTER), vw - GUTTER - width);
      const top = r.bottom + 8;
      const maxHeight = Math.max(200, Math.min(PANEL_MAX_HEIGHT, window.innerHeight - top - GUTTER));
      setStyle({ top, left, width, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, buttonRef]);
  return style;
}

export default function NotificationBell() {
  const unread = useUnreadCount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null while loading
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();
  const headingId = useId();

  usePolling();
  const bump = useBump(unread);
  const panelStyle = usePanelPosition(open, buttonRef);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  async function load() {
    setItems(null);
    setError("");
    try {
      const body = await fetchNotifications();
      setItems((body.results || []).slice(0, 10));
    } catch (e) {
      setItems([]);
      setError(e.message);
    }
  }

  function toggle() {
    if (open) {
      close(false);
      return;
    }
    setOpen(true);
    load();
    refreshCount();
  }

  // Outside click (or tap) and Escape close the panel.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onOpenItem(n) {
    close(false);
    openNotification(n, navigate);
  }

  async function markAll() {
    setMarkingAll(true);
    setError("");
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((list) => list?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? list);
    } catch (e) {
      setError(e.message);
    } finally {
      setMarkingAll(false);
    }
  }

  const count = unread || 0;
  const label = count ? `Notifications, ${count} unread` : "Notifications";
  const anyUnread = count > 0 || items?.some((n) => !n.read_at);
  const now = new Date();

  return (
    <div className="notif" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="notif-btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
      >
        <Bell size={20} aria-hidden="true" />
        {count > 0 && (
          <span className={`notif-badge${bump ? " is-bump" : ""}`} aria-hidden="true">{count > 9 ? "9+" : count}</span>
        )}
      </button>

      {open && panelStyle && (
        <div id={panelId} className="notif-panel" role="region" aria-labelledby={headingId} style={panelStyle}>
          <div className="notif-head">
            <h2 id={headingId}>Notifications</h2>
            <button type="button" className="notif-text-btn" onClick={markAll} disabled={!anyUnread || markingAll}>
              {markingAll ? "Marking…" : "Mark all as read"}
            </button>
          </div>

          {error && <p role="alert" className="notif-note" style={{ color: "var(--risk-high)", paddingBlock: "var(--space-3)" }}>{error}</p>}
          {items === null && <p role="status" className="notif-note">Loading…</p>}
          {items && !items.length && !error && <p className="notif-note">You're all caught up.</p>}
          {items && items.length > 0 && (
            <ul className="notif-list" aria-label="Latest notifications">
              {items.map((n) => (
                <li key={n.id}><NotificationItem n={n} onOpen={onOpenItem} now={now} /></li>
              ))}
            </ul>
          )}

          <div className="notif-foot">
            <Link to="/notifications" className="notif-text-btn" onClick={() => close(false)}>See all</Link>
          </div>
        </div>
      )}
    </div>
  );
}
