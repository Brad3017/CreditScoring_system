// "Review requested": the owner asked for a human review (Data Protection Act s.35) and no decision has been
// recorded since. Text plus a dot, never colour alone.
export function ReviewRequestedBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-2)", padding: "2px var(--space-3)",
      border: "1px solid var(--risk-moderate)", borderRadius: 999, background: "var(--risk-moderate-soft)",
      color: "var(--risk-moderate)", fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      Review requested
    </span>
  );
}
