// Shown when a page's data request FAILED, so a failure is never mistaken for "nothing here yet".
export default function LoadError({ message, onRetry, busy = false }) {
  if (!message) return null;
  return (
    <section className="panel" role="alert" style={{ borderColor: "var(--risk-high)" }}>
      <p style={{ margin: 0, fontWeight: 600, color: "var(--risk-high)" }}>{message}</p>
      <p style={{ margin: "var(--space-2) 0 var(--space-4)", color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>
        Nothing has been lost. Your saved details and assessments are still on record.
      </p>
      <button type="button" className="btn btn-secondary" onClick={onRetry} disabled={busy}>
        {busy ? "Retrying…" : "Retry"}
      </button>
    </section>
  );
}
