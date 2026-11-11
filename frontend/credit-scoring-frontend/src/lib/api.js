export const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

// ---------------------------------------------------------------------------
// Authenticated requests with transparent token refresh.
// On a 401: POST /auth/refresh/ ONCE (shared by all requests that fail at the same time),
// store the new tokens, retry the original request. Only if the refresh itself is refused is
// the session cleared and the user sent to /login with SESSION_EXPIRED_MESSAGE.
// ---------------------------------------------------------------------------
export const SESSION_EXPIRED_MESSAGE = "Your session expired. Sign in again.";
const SESSION_EXPIRED_KEY = "session_expired_message";
const NETWORK_MESSAGE = "We could not reach the server. Check your connection and try again.";

let refreshing = null; // the in-flight refresh, so parallel 401s trigger one refresh call

function refreshAccess() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return Promise.resolve("rejected");
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) return "rejected";
        const body = await res.json();
        if (!body.access) return "rejected";
        localStorage.setItem("access", body.access);
        // ROTATE_REFRESH_TOKENS is on: the server sends a new refresh token too.
        if (body.refresh) localStorage.setItem("refresh", body.refresh);
        return "ok";
      })
      .catch(() => "network")
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function expireSession() {
  clearSession();
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, SESSION_EXPIRED_MESSAGE);
  } catch {
    // Storage unavailable: the login page simply shows no message.
  }
  if (window.location.pathname !== "/login") window.location.assign("/login");
}

// Read once by the login page.
export function takeSessionExpiredMessage() {
  try {
    const msg = sessionStorage.getItem(SESSION_EXPIRED_KEY);
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    return msg || "";
  } catch {
    return "";
  }
}

async function authFetch(url, options = {}) {
  // The token is read on every attempt, so the retry carries the refreshed one.
  const send = () =>
    fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${getToken()}` } });
  let res;
  try {
    res = await send();
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new Error(NETWORK_MESSAGE);
  }
  if (res.status !== 401) return res;

  const outcome = await refreshAccess();
  if (outcome === "ok") {
    res = await send();
    if (res.status !== 401) return res;
  }
  if (outcome === "network") throw new Error(NETWORK_MESSAGE);
  expireSession();
  const err = new Error(SESSION_EXPIRED_MESSAGE);
  err.sessionExpired = true;
  throw err;
}

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
  const res = await authFetch(`${BASE}/scoring/assessments/`, {
    headers: { "Content-Type": "application/json" },
  });
  // A failed request must surface as an error, never as "no assessments".
  if (!res.ok) throw new Error(await readError(res, "Your assessments could not be loaded."));
  return res.json();
}

export async function submitAssessment(payload) {
  // Ensure this path matches your working Django endpoint!
  const res = await authFetch(`${BASE}/scoring/assess/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  if (!res.ok) throw fieldError(body, `Request failed (HTTP ${res.status}).`);
  return body;
}

// Serializer errors arrive as { field: ["message", ...] }. The Error carries them as .fields
// (field -> first message) so forms can show each one under its own input.
function fieldError(body, fallback) {
  const fields = {};
  for (const [k, v] of Object.entries(body || {})) {
    const msg = Array.isArray(v) ? v.find((m) => typeof m === "string") : typeof v === "string" ? v : null;
    if (msg && k !== "detail" && k !== "error") fields[k] = msg;
  }
  const err = new Error(body?.detail || body?.error || Object.values(fields).join(" ") || fallback);
  err.fields = fields;
  return err;
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
  const res = await authFetch(`${BASE}/auth/me/`, {
    headers: {},
  });
  if (!res.ok) throw new Error(await readError(res, "Your account details could not be loaded."));
  const me = await res.json();
  storeUser(me);
  return me;
}

export async function fetchAllAssessments() {
  const res = await authFetch(`${BASE}/scoring/assessments/all/`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load analyst assessments");
  return res.json();
}



export async function updateMe(data) {
  const res = await authFetch(`${BASE}/auth/me/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw fieldError(body, "Your personal details could not be saved.");
  storeUser(body);
  return body;
}

export async function saveBusinessProfile(data) {
  const res = await authFetch(`${BASE}/scoring/business-profile/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw fieldError(body, "Your business details could not be saved.");
  return body;
}

// The signed-in owner's saved business profile, or {} if there is none yet.
export async function fetchBusinessProfile() {
  const res = await authFetch(`${BASE}/scoring/business-profile/`, {
    headers: {},
  });
  if (!res.ok) throw new Error(await readError(res, "Your business profile could not be loaded."));
  return res.json();
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
  const res = await authFetch(`${BASE}/scoring/assessments/${pk}/`, {
    headers: {},
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load assessment"));
  return res.json();
}

// The stored answers behind one of the signed-in owner's own assessments.
export async function fetchAssessmentInputs(pk) {
  const res = await authFetch(`${BASE}/scoring/assessments/${pk}/inputs/`, {
    headers: {},
  });
  if (!res.ok) throw new Error(await readError(res, "Your original answers could not be loaded."));
  return res.json();
}

// What-if scoring. Saves nothing on the server. Pass an AbortSignal to cancel a stale request.
export async function simulateAssessment(payload, signal) {
  const res = await authFetch(`${BASE}/scoring/simulate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) throw new Error("Too many what-if requests in a short time. Wait a moment and try again.");
    const fieldMessages = Object.values(body || {}).flat().filter((m) => typeof m === "string");
    throw new Error(body.detail || body.error || fieldMessages.join(" ") || `Simulation failed (HTTP ${res.status}).`);
  }
  return body;
}

// decision: "approved" | "declined" | "referred"
export async function reviewAssessment(pk, decision, note) {
  const res = await authFetch(`${BASE}/scoring/assessments/${pk}/review/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, note }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not save the review"));
  return res.json();
}

async function adminGet(path, params = {}) {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v)
  ).toString();
  const res = await authFetch(`${BASE}${path}${q ? `?${q}` : ""}`, {
    headers: {},
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
  const res = await authFetch(`${BASE}/auth/admin/users/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Could not update the user");
  return body;
}

export async function downloadAssessmentsCsv(params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const res = await authFetch(`${BASE}/scoring/admin/export/${q ? `?${q}` : ""}`, {
    headers: {},
  });
  if (!res.ok) throw new Error("Export failed");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `assessments_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

