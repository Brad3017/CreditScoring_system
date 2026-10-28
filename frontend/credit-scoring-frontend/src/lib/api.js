const BASE = "http://127.0.0.1:8000/api";

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
  const res = await fetch("http://127.0.0.1:8000/api/scoring/assessments/", {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch assessments");
  }
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
    throw new Error(body.detail || body.error || JSON.stringify(body));
  }
  return body;
}

export function saveSession(access, refresh, role) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
  if (role) localStorage.setItem("role", role);
}

export function clearSession() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("role");
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
  return res.json();
}

export async function fetchAllAssessments() {
  const res = await fetch(`${BASE}/assessments/`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load assessments");
  return res.json();
}

export async function fetchAssessmentDetail(id) {
  const res = await fetch(`${BASE}/assessments/${id}/`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load assessment");
  return res.json();
}