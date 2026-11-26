// Notification helpers shared by the bell and the /notifications page.
import { fetchUnreadCount, markNotificationRead } from "./api";
import { shortDate } from "./i18n";
import { getUnreadCount, setUnreadCount } from "./unreadStore";

// Polls never show an error: a failed request keeps the last known count.
export const refreshUnreadCount = () => fetchUnreadCount().catch(() => {});

// Opening a notification: mark it read (the count drops straight away), go to its page, then re-check
// the count with the server.
export function openNotification(n, navigate) {
  if (!n.read_at) {
    const known = getUnreadCount();
    if (known) setUnreadCount(known - 1);
    markNotificationRead(n.id).catch(() => {}).finally(refreshUnreadCount);
  }
  if (n.link) navigate(n.link);
}

// "just now", "5 min ago", "3 hours ago", "yesterday", "4 days ago", or a date ("17 Dec 2026") after 7 days.
export function relativeTime(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.floor((now - d) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.round((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (dayDiff <= 0) {
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (dayDiff === 1) return "yesterday";
  if (dayDiff <= 7) return `${dayDiff} days ago`;
  return shortDate(iso);
}
