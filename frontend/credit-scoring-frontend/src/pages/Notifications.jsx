// /notifications (every role): the full list, All / Unread, "Load more" (20 per page), Mark all as read.
// Opening an item marks it read and goes to its page, as in the bell's panel.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import AnalystLayout from "../components/AnalystLayout";
import AdminLayout from "../components/AdminLayout";
import { NotificationItem } from "../components/NotificationBell";
import { fetchNotifications, getRole, markAllNotificationsRead } from "../lib/api";
import { openNotification } from "../lib/notifications";
import { useUnreadCount } from "../lib/unreadStore";

const FILTERS = [["all", "All"], ["unread", "Unread"]];

function NotificationList() {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError("");
    fetchNotifications({ unread: filter === "unread", page: 1 })
      .then((body) => {
        if (cancelled) return;
        setItems(body.results || []);
        setPage(1);
        setHasMore(Boolean(body.next));
      })
      .catch((e) => {
        if (cancelled) return;
        setItems([]);
        setError(e.message);
      });
    return () => { cancelled = true; };
  }, [filter]);

  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const body = await fetchNotifications({ unread: filter === "unread", page: page + 1 });
      setItems((list) => {
        const seen = new Set(list.map((n) => n.id));
        return [...list, ...(body.results || []).filter((n) => !seen.has(n.id))];
      });
      setPage(page + 1);
      setHasMore(Boolean(body.next));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function markAll() {
    setMarkingAll(true);
    setError("");
    setNotice("");
    try {
      const { marked } = await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((list) => list?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? list);
      setNotice(marked === 1 ? "1 notification marked as read." : `${marked} notifications marked as read.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setMarkingAll(false);
    }
  }

  const anyUnread = (unreadCount || 0) > 0 || items?.some((n) => !n.read_at);
  const now = new Date();

  return (
    <section className="panel" aria-label="Notifications" style={{ maxWidth: "52rem" }}>
      <div className="panel-head">
        <div role="group" aria-label="Show" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn ${filter === key ? "btn-primary" : "btn-secondary"}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
              {key === "unread" && unreadCount ? ` (${unreadCount})` : ""}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-secondary" onClick={markAll} disabled={!anyUnread || markingAll}>
          {markingAll ? "Marking…" : "Mark all as read"}
        </button>
      </div>

      {notice && <p role="status" style={{ margin: "0 0 var(--space-4)", color: "var(--risk-low)" }}>{notice}</p>}
      {error && <p role="alert" style={{ margin: "0 0 var(--space-4)", color: "var(--risk-high)" }}>{error}</p>}
      {items === null && <p role="status" style={{ margin: 0, color: "var(--ink-2)" }}>Loading…</p>}
      {items && !items.length && !error && (
        <p style={{ margin: 0, color: "var(--ink-2)" }}>
          {filter === "unread" ? "No unread notifications." : "You're all caught up."}
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="notif-list notif-list--page">
          {items.map((n) => (
            <li key={n.id}><NotificationItem n={n} onOpen={(x) => openNotification(x, navigate)} now={now} /></li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
          <button type="button" className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}

export default function Notifications() {
  const role = getRole();
  const subtitle = "Updates about applications and scores. Open one to go to the page it is about.";
  if (role === "admin") return <AdminLayout title="Notifications" subtitle={subtitle}><NotificationList /></AdminLayout>;
  if (role === "analyst") return <AnalystLayout title="Notifications" subtitle={subtitle}><NotificationList /></AnalystLayout>;
  return (
    <AppShell>
      <header className="page-head">
        <h1>Notifications</h1>
        <p>{subtitle}</p>
      </header>
      <NotificationList />
    </AppShell>
  );
}
