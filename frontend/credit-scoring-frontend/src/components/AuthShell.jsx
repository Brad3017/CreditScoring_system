import { useState } from "react";

// Shared layout for the public pages (login and signup).
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-12) var(--space-4)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--accent)",
              color: "#ffffff",
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 600,
            }}
          >
            B
          </span>
          <p
            style={{
              margin: "var(--space-3) 0 0",
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-xl)",
              fontWeight: 600,
            }}
          >
            BiasharaScore
          </p>
          <p style={{ margin: "var(--space-1) 0 0", color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
            Credit scoring for Kenyan small businesses
          </p>
        </div>

        <div className="card" style={{ padding: "var(--space-8)" }}>
          <h1 style={{ fontSize: "var(--text-xl)", marginBottom: subtitle ? "var(--space-1)" : "var(--space-6)" }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ color: "var(--ink-2)", margin: "0 0 var(--space-6)" }}>{subtitle}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export const labelStyle = {
  display: "block",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  marginBottom: "var(--space-2)",
};

export const inputStyle = {
  font: "inherit",
  width: "100%",
  boxSizing: "border-box",
  padding: "var(--space-3) var(--space-4)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--ink)",
};

export function Field({ label, name, hint, ...rest }) {
  const id = `f-${name}`;
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input id={id} name={name} style={inputStyle} {...rest} />
      {hint && <p style={{ margin: "var(--space-2) 0 0", color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{hint}</p>}
    </div>
  );
}

// Password input with a visible Show/Hide toggle.
export function PasswordField({ label, name, hint, ...rest }) {
  const [shown, setShown] = useState(false);
  const id = `f-${name}`;
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          style={{ ...inputStyle, paddingRight: "4.5rem" }}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: "var(--space-2)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: 0,
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: "var(--text-xs)",
            cursor: "pointer",
            padding: "var(--space-1) var(--space-2)",
          }}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {hint && <p style={{ margin: "var(--space-2) 0 0", color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{hint}</p>}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      style={{
        margin: "0 0 var(--space-4)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius)",
        background: "var(--risk-high-soft)",
        color: "var(--risk-high)",
        fontSize: "var(--text-sm)",
      }}
    >
      {children}
    </p>
  );
}
