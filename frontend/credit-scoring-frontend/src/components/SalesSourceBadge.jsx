// Where the monthly sales figure came from:
//   "Sales: Verified from till statement (Till 9900104, 17 Aug – 16 Nov 2026)"  or  "Sales: Self-reported".
// Text plus a dot, never colour alone. compact: the short label only (tables), full detail in the tooltip.
// wrap: let a compact label wrap (narrow form columns); tables keep it on one line.
import { t } from "../lib/i18n";
import { tillLine } from "../lib/till";

export default function SalesSourceBadge({ source, statement, compact = false, wrap = false }) {
  const verified = source === "till_statement";
  const detail = verified && statement ? tillLine(statement) : "";
  const label = verified ? t("till.verified") : t("till.selfReported");
  const text = compact ? label : `${t("till.salesLabel")}: ${label}${detail ? ` (${detail})` : ""}`;
  const fg = verified ? "var(--accent)" : "var(--ink-2)";
  return (
    <span
      title={detail ? `${t("till.salesLabel")}: ${label} (${detail})` : `${t("till.salesLabel")}: ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "2px var(--space-3)",
        border: `1px solid ${fg}`,
        borderRadius: 999,
        background: verified ? "var(--accent-soft)" : "var(--paper)",
        color: fg,
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        whiteSpace: compact && !wrap ? "nowrap" : "normal",
        verticalAlign: "middle",
        maxWidth: "100%",
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, flex: "none", borderRadius: "50%", background: fg }} />
      {text}
    </span>
  );
}
