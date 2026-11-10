// Caution shown when answers fall outside the model's training ranges. Notes come from the API.
export default function OutOfRangeNotice({ notes }) {
  if (!notes?.length) return null;
  return (
    <div role="note" style={{ marginTop: "var(--space-5)", padding: "var(--space-4)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
      <p style={{ margin: 0, fontWeight: 600 }}>
        Some answers are outside the range the model was trained on, so treat this score with extra caution.
      </p>
      <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.2em", color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
        {notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
    </div>
  );
}
