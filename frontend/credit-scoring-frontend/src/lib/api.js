export const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export async function signup(data) {
  const res = await fetch(`${BASE}/auth/signup/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || body.email?.[0] || "Signup failed");
  return body;
}

export async function login(data) {
  const res = await fetch(`${BASE}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || "Login failed");
  return body;
}

export async function fetchMyAssessments() {
  const token = getToken();
  const res = await fetch(`${BASE}/scoring/assessments/`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function submitAssessment(payload) {
  const token = getToken();
  // Ensure this path matches your working Django endpoint!
  const res = await fetch(`${BASE}/scoring/assess/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  // Safe JSON parsing so it shows the real status code instead of crashing on HTML
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    console.error("Raw HTML error response from Django:", text);
    throw new Error(`Server returned HTTP ${res.status} (${res.statusText}). Check Django terminal.`);
  }

  if (!res.ok) {
    // Serializer errors arrive as { field: ["message", ...] }; show the messages, not raw JSON.
    const fieldMessages = Object.values(body || {}).flat().filter((m) => typeof m === "string");
    throw new Error(body.detail || body.error || fieldMessages.join(" ") || `Request failed (HTTP ${res.status}).`);
  }
  return body;
}

export function saveSession(access, refresh, role, user) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
  if (role) localStorage.setItem("role", role);
  if (user) storeUser(user);
}

export function clearSession() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("role");
  localStorage.removeItem("user");
}

// The signed-in user's display details (id, email, full_name, role), kept with the session
// so the first page does not need a /auth/me/ round trip.
function storeUser(user) {
  try {
    const prev = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem("user", JSON.stringify({ ...prev, ...user }));
  } catch {
    // Storage unavailable: pages fall back to fetchMe().
  }
}

export function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

// Stored user if there is one, otherwise ask the server. Use fetchMe() to force a refresh.
export function getCurrentUser() {
  const cached = getSessionUser();
  return cached?.email ? Promise.resolve(cached) : fetchMe();
}

export function getRole() {
  return localStorage.getItem("role");
}

export function getToken() {
  return localStorage.getItem("access");
}

export async function fetchMe() {
  const res = await fetch(`${BASE}/auth/me/`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Unauthorized");
  const me = await res.json();
  storeUser(me);
  return me;
}

export async function fetchAllAssessments() {
  const res = await fetch(`${BASE}/scoring/assessments/all/`, {
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}` 
    },
  });
  if (!res.ok) throw new Error("Failed to load analyst assessments");
  return res.json();
}



export async function updateMe(data) {
  const res = await fetch(`${BASE}/auth/me/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Your personal details could not be saved.");
  storeUser(body);
  return body;
}

export async function saveBusinessProfile(data) {
  const res = await fetch(`${BASE}/scoring/business-profile/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || JSON.stringify(body) || "Your business details could not be saved.");
  return body;
}

async function readError(res, fallback) {
  try {
    const body = await res.json();
    return body.detail || body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchAssessmentDetail(pk) {
  const res = await fetch(`${BASE}/scoring/assessments/${pk}/`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load assessment"));
  return res.json();
}

// decision: "approved" | "declined" | "referred"
export async function reviewAssessment(pk, decision, note) {
  const res = await fetch(`${BASE}/scoring/assessments/${pk}/review/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ decision, note }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not save the review"));
  return res.json();
}

async function adminGet(path, params = {}) {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v)
  ).toString();
  const res = await fetch(`${BASE}${path}${q ? `?${q}` : ""}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    let msg = "Request failed";
    try { msg = (await res.json()).detail || msg; } catch { /* keep default */ }
    throw new Error(res.status === 403 ? "Administrator access required." : msg);
  }
  return res.json();
}

export const fetchAdminOverview = (params) => adminGet("/scoring/admin/overview/", params);
export const fetchAdminFairness = (params) => adminGet("/scoring/admin/fairness/", params);
export const fetchAdminModel = () => adminGet("/scoring/admin/model/");
export const fetchAdminUsers = () => adminGet("/auth/admin/users/");

export async function updateAdminUser(id, changes) {
  const res = await fetch(`${BASE}/auth/admin/users/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(changes),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Could not update the user");
  return body;
}

export async function downloadAssessmentsCsv(params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const res = await fetch(`${BASE}/scoring/admin/export/${q ? `?${q}` : ""}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `assessments_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

