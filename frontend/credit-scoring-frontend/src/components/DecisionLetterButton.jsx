// Downloads (owners) or previews (analysts, admins) the PDF decision letter of a decided assessment.
// Renders nothing until an analyst has decided: the server answers 409 for pending assessments.
import { useState } from "react";
import { downloadDecisionLetter, previewDecisionLetter } from "../lib/api";

const DECIDED = ["approved", "declined", "referred"];

const linkStyle = {
  background: "none",
  border: 0,
  padding: 0,
  font: "inherit",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--accent)",
  textDecoration: "underline",
  cursor: "pointer",
};

/**
 * variant "primary" | "secondary": a full button. variant "link": small text link (table rows).
 * preview: open inline in a new tab (staff only) instead of saving the file.
 */
export default function DecisionLetterButton({ pk, status, variant = "primary", preview = false, label, ariaLabel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const text = label || (preview ? "Preview letter" : "Download decision letter");

  async function run() {
    setError("");
    setBusy(true);
    try {
      await (preview ? previewDecisionLetter(pk) : downloadDecisionLetter(pk));
    } catch (e) {
      setError(e.message || "The decision letter could not be prepared. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (pk == null || !DECIDED.includes(status)) return null;
  const isLink = variant === "link";
  return (
    <span style={{ display: isLink ? "inline-grid" : "grid", gap: "var(--space-1)", justifyItems: isLink ? "end" : "start" }}>
      <button
        type="button"
        className={isLink ? undefined : `btn btn-${variant}`}
        style={isLink ? linkStyle : undefined}
        onClick={run}
        disabled={busy}
        aria-busy={busy}
        aria-label={busy ? undefined : ariaLabel}
      >
        {busy ? "Preparing…" : text}
      </button>
      {error && (
        <span role="alert" style={{ color: "var(--risk-high)", fontSize: "var(--text-xs)", maxWidth: isLink ? 220 : undefined, textAlign: isLink ? "right" : "left" }}>
          {error}
        </span>
      )}
    </span>
  );
}
