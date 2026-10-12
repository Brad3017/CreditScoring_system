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

export function saveSession(access, refresh, role) {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
  localStorage.setItem("role", role);
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