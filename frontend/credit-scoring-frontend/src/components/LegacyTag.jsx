// Small neutral tag for records scored by an earlier model (payload.is_current_model === false),
// e.g. "Earlier model (v2)". The warning notice itself lives in RiskScale and appears only when
// the stored label disagrees with the score's band (payload.is_legacy, the v1 records).
const shortVersion = (v) => (String(v || "").match(/v\d+$/) || [null])[0];

export default function LegacyTag({ record }) {
  if (!record || record.is_current_model !== false) return null;
  const short = shortVersion(record.model_version);
  const title = record.is_legacy
    ? `Scored with ${record.model_version || "an earlier model"}, which used different risk bands`
    : `Scored with ${record.model_version || "an earlier model"}`;
  return (
    <span
      title={title}
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
      {short ? `Earlier model (${short})` : "Earlier model"}
    </span>
  );
}
