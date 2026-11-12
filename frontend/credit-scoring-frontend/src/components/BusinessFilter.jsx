// "Business" filter for an owner's assessment lists. Rendered only when the owner has more than one
// business. value: "all" or a business id (string). Assessments are matched on their business_id.
export default function BusinessFilter({ businesses, value, onChange, style }) {
  if (!businesses || businesses.length < 2) return null;
  return (
    <label style={{ display: "grid", gap: "var(--space-1)", minWidth: 200, ...style }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>Business</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          font: "inherit",
          padding: "var(--space-2) var(--space-3)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--radius)",
          background: "var(--surface)",
          color: "var(--ink)",
        }}
      >
        <option value="all">All businesses</option>
        {businesses.map((b) => (
          <option key={b.id} value={String(b.id)}>
            {b.business_name}{b.kra_pin ? ` (${b.kra_pin})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
