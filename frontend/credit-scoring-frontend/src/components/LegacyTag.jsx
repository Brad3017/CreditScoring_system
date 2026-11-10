// Small neutral tag for records scored by an earlier model (payload.is_legacy).
export default function LegacyTag({ record }) {
  if (!record?.is_legacy) return null;
  return (
    <span
      title={`Scored with ${record.model_version || "an earlier model"}, which used different risk bands`}
      style={{
        display: "inline-block",
        marginLeft: "var(--space-2)",
        padding: "0 var(--space-2)",
        border: "1px solid var(--line-strong)",
        borderRadius: 999,
        color: "var(--ink-2)",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      Earlier model
    </span>
  );
}
