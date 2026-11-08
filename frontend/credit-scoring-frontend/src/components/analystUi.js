// Shared inline styles for the analyst pages (all token-driven).
export const card = {
  background: "var(--surface)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-6)",
  boxShadow: "var(--shadow)",
  minWidth: 0,
};
export const cardHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-4)",
  paddingBottom: "var(--space-4)",
  marginBottom: "var(--space-5)",
  borderBottom: "1px solid var(--line-strong)",
};
export const cardTitle = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-lg)",
  fontWeight: 600,
};
export const muted = { color: "var(--ink-2)", fontSize: "var(--text-xs)" };
export const inputStyle = {
  font: "inherit",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--ink)",
};
export const th = {
  textAlign: "left",
  padding: "var(--space-3)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--ink-2)",
  borderBottom: "1px solid var(--line-strong)",
  whiteSpace: "nowrap",
};
export const td = {
  padding: "var(--space-3)",
  borderBottom: "1px solid var(--line)",
  verticalAlign: "middle",
};
export const kes = (n) =>
  typeof n === "number" ? `KES ${Math.round(n).toLocaleString("en-KE")}` : "Not recorded";
export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })
    : "";
