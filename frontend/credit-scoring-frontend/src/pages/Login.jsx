import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, saveSession } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await login(form);
      saveSession(data.access, data.refresh, data.role || "owner");
      navigate("/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <form className="card" onSubmit={submit}>
        <h1>Log in</h1>

        <label>Email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={change}
          placeholder="you@example.com"
          required
        />

        <label>Password</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={change}
          required
        />

        {error && <p className="error">{error}</p>}

        <button disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </button>

        <p className="muted">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </div>
  );
}