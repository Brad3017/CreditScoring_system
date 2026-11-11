import { getRole, getSessionUser } from "./api";

// Display labels for the role stored on the account (accounts.User.role).
export const ROLE_LABELS = { owner: "MSME owner", analyst: "Credit analyst", admin: "Administrator" };

// The signed-in user for a layout: what the page loaded, filled in from the session stored at login.
export function layoutUser(user) {
  return { ...(getSessionUser() || {}), ...(user || {}) };
}

export function roleOf(user) {
  return user?.role || getRole() || "";
}

export const roleLabel = (role) => ROLE_LABELS[role] || "Signed-in user";
