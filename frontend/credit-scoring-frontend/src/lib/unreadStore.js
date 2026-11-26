// The unread count shared by every NotificationBell. Each page renders its own layout, so the bell is
// mounted again on every navigation: keeping the count here means the badge never blinks back to empty,
// and a failed poll simply keeps the last known value.
import { useSyncExternalStore } from "react";

let unread = null; // null until the first successful poll
const listeners = new Set();

export function setUnreadCount(n) {
  const next = Number.isFinite(n) ? Math.max(0, n) : null;
  if (next === unread) return;
  unread = next;
  listeners.forEach((fn) => fn());
}

export function getUnreadCount() {
  return unread;
}

export function useUnreadCount() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => unread,
  );
}
