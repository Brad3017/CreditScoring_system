import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, saveSession, clearSession } from "../lib/api";
import AuthShell, { Field, PasswordField, ErrorNote } from "../components/AuthShell";

const HOME_FOR_ROLE = { owner: "/home", analyst: "/analyst", admin: "/console" };

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  const mismatch = form.confirm !== "" && form.password !== form.confirm;

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    // Whoever was signed in before (e.g. an admin testing in this browser) is signed out first,
    // so none of their tokens or details can carry over to the new account.
    clearSession();
    try {
      const data = await signup({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
      });
      // The new account's own tokens, role and user, all together.
      saveSession(data.access, data.refresh, data.user?.role, data.user);
      navigate(HOME_FOR_ROLE[data.user.role] || "/home", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Set up your profile, then run your first assessment.">
      <form onSubmit={submit}>
        <ErrorNote>{error}</ErrorNote>

        <Field
          label="Full name"
          name="full_name"
          value={form.full_name}
          onChange={change}
          autoComplete="name"
          required
        />

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
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters."
          required
        />

        <PasswordField
          label="Confirm password"
          name="confirm"
          value={form.confirm}
          onChange={change}
          autoComplete="new-password"
          required
        />

        {mismatch && (
          <p style={{ margin: "calc(var(--space-2) * -1) 0 var(--space-4)", color: "var(--risk-high)", fontSize: "var(--text-xs)" }}>
            Passwords don't match yet.
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-2)" }}
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p style={{ margin: "var(--space-6) 0 0", textAlign: "center", color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
