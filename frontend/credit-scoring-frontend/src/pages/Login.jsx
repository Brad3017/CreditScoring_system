import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, saveSession, takeSessionExpiredMessage } from "../lib/api";
import AuthShell, { Field, PasswordField, ErrorNote } from "../components/AuthShell";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Set by api.js when a token refresh is refused; shown once.
  const [expired] = useState(() => takeSessionExpiredMessage());

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const data = await login(form);

      // Save tokens + role
      saveSession(data.access, data.refresh, data.role || "owner", data.user);

      // Route by role
      if (data.role === "analyst") {
        navigate("/analyst");
      } else if (data.role === "admin") {
        navigate("/console");
      } else {
        navigate("/home");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your assessments and credit score.">
      <form onSubmit={submit} noValidate={false}>
        {expired && !error && (
          <p role="status" style={{ margin: "0 0 var(--space-4)", padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius)", background: "var(--accent-soft)", color: "var(--ink)", fontSize: "var(--text-sm)" }}>
            {expired}
          </p>
        )}
        <ErrorNote>{error}</ErrorNote>

        <Field
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={change}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <PasswordField
          label="Password"
          name="password"
          value={form.password}
          onChange={change}
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-2)" }}
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p style={{ margin: "var(--space-6) 0 0", textAlign: "center", color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>
        New to BiasharaScore?{" "}
        <Link to="/signup" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
