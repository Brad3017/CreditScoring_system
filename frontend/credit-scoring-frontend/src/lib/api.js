export const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

// ---------------------------------------------------------------------------
// Authenticated requests with transparent token refresh.
// On a 401: POST /auth/refresh/ ONCE (shared by all requests that fail at the same time),
// store the new tokens, retry the original request. Only if the refresh itself is refused is
// the session cleared and the user sent to /login with SESSION_EXPIRED_MESSAGE.
// ---------------------------------------------------------------------------
export const SESSION_EXPIRED_MESSAGE = "Your session expired. Sign in again.";
export const SESSION_CHANGED_MESSAGE = "You were signed in as a different account. Sign in again.";
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
        // Someone signed in or out (here or in another tab) while this refresh was in flight:
        // never write the old session's tokens over the new one.
        if (localStorage.getItem("refresh") !== refresh) return "ok";
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

function expireSession(message = SESSION_EXPIRED_MESSAGE) {
  clearSession();
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, message);
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

// A session is always all four of access, refresh, role and user, written or cleared together,
// so one account's tokens can never sit next to another account's user/role.
const SESSION_KEYS = ["access", "refresh", "role", "user"];

export function saveSession(access, refresh, role, user) {
  if (!access || !refresh || !role || !user?.id || !user?.email) {
    // Refuse a partial session rather than keep pieces of a previous one.
    clearSession();
    throw new Error("Sign-in did not complete. Please try again.");
  }
  clearSession();
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
  localStorage.setItem("role", role);
  localStorage.setItem("user", JSON.stringify({ id: user.id, email: user.email, full_name: user.full_name || "", role: user.role || role }));
}

export function clearSession() {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
}

// The signed-in user's display details (id, email, full_name, role), kept with the session so the
// first page does not need a /auth/me/ round trip. Only ever updated for the SAME account:
// details of a different user are never merged into the stored one.
function storeUser(user) {
  try {
    const prev = JSON.parse(localStorage.getItem("user") || "null");
    if (!prev || !user || prev.id !== user.id) return;
    localStorage.setItem("user", JSON.stringify({ ...prev, ...user }));
  } catch {
    // Storage unavailable: pages fall back to fetchMe().
  }
}

// Run once when the app loads. The token decides who the server thinks you are; if that is not
// the user (id, email, role) stored with the session, the session is cleared and you sign in again.
// Returns "none" | "ok" | "mismatch" | "expired" | "unverified" (server unreachable: session kept).
export async function verifySession() {
  if (!getToken()) return "none";
  let res;
  try {
    res = await authFetch(`${BASE}/auth/me/`);
  } catch (e) {
    return e?.sessionExpired ? "expired" : "unverified";
  }
  if (!res.ok) return "unverified";
  const me = await res.json();
  const stored = getSessionUser();
  if (!stored || stored.id !== me.id || stored.email !== me.email || getRole() !== me.role) {
    expireSession(SESSION_CHANGED_MESSAGE);
    return "mismatch";
  }
  storeUser(me);
  return "ok";
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

// The signed-in owner's businesses (oldest first). One business = one profile = one KRA PIN.
// Each has assessment_count and pin_locked (true once it has an assessment).
export async function fetchBusinesses() {
  const res = await authFetch(`${BASE}/scoring/businesses/`, {
    headers: {},
  });
  if (!res.ok) throw new Error(await readError(res, "Your businesses could not be loaded."));
  return res.json();
}

export async function createBusiness(data) {
  const res = await authFetch(`${BASE}/scoring/businesses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw fieldError(body, "The business could not be added.");
  return body;
}

export async function updateBusiness(id, data) {
  const res = await authFetch(`${BASE}/scoring/businesses/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw fieldError(body, "Your business details could not be saved.");
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

// Records that the owner opened a lesson. Best effort: a failure is ignored, the lesson still shows.
export async function recordLessonView(featureKey) {
  try {
    await authFetch(`${BASE}/learn/viewed/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature_key: featureKey }),
    });
  } catch {
    // Not important enough to interrupt reading.
  }
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


// The PDF decision letter of a decided assessment, as a Blob plus the server's filename.
// Owners: their own assessments only. inline=true (analysts and admins) asks for an inline preview,
// which the server does not count as a download.
async function fetchDecisionLetter(pk, { inline = false } = {}) {
  const res = await authFetch(`${BASE}/scoring/assessments/${pk}/letter/${inline ? "?inline=1" : ""}`, {
    headers: {},
  });
  if (!res.ok) throw new Error(await readError(res, "The decision letter could not be prepared. Try again."));
  const disposition = res.headers.get("Content-Disposition") || "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || `BiasharaScore_decision_${pk}.pdf`;
  return { blob: await res.blob(), filename };
}

export async function downloadDecisionLetter(pk) {
  const { blob, filename } = await fetchDecisionLetter(pk);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Opens the letter in a new tab. The tab is opened straight away (inside the click), so pop-up
// blockers allow it, and pointed at the PDF once it has loaded.
export async function previewDecisionLetter(pk) {
  const tab = window.open("", "_blank");
  try {
    const { blob } = await fetchDecisionLetter(pk, { inline: true });
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
