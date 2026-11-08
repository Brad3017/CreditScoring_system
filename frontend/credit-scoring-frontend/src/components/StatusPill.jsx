// Review status badge. Uses text plus a dot, never colour alone.
const STATUS = {
  pending:  { label: "Pending review",  token: "--ink-2" },
  approved: { label: "Approved",        token: "--risk-low" },
  declined: { label: "Declined",        token: "--risk-high" },
  referred: { label: "Needs more info", token: "--risk-moderate" },
};

export const STATUS_LABEL = Object.fromEntries(
  Object.entries(STATUS).map(([k, v]) => [k, v.label])
);

export default function StatusPill({ status = "pending" }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "2px var(--space-3)",
        border: `1px solid var(${s.token})`,
        borderRadius: 999,
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        color: `var(${s.token})`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 6, height: 6, borderRadius: "50%", background: `var(${s.token})` }}
      />
      {s.label}
    </span>
  );
}
