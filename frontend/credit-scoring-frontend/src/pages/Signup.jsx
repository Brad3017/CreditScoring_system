import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, saveSession } from "../lib/api";

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

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords don't match");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setBusy(true);
    try {
      const data = await signup({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
      });
      saveSession(data.access, data.refresh, data.user.role);
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
        <h1>Create an account</h1>

        <label>Full name</label>
        <input
          name="full_name"
          value={form.full_name}
          onChange={change}
          placeholder="Jane Doe"
          required
        />

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

        <label>Confirm password</label>
        <input
          type="password"
          name="confirm"
          value={form.confirm}
          onChange={change}
          required
        />

        {error && <p className="error">{error}</p>}

        <button disabled={busy}>
          {busy ? "Creating account..." : "Sign up"}
        </button>

        <p className="muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}