// Score validity pill (status from the API: scoring/validity.py). Text plus a dot, never colour alone.
//   valid, more than 7 days left  -> green  "Valid · expires in N days"
//   valid, 7 days or fewer        -> amber  "Expires in N days"
//   expired                       -> red    "Expired on 17 Dec 2026"
//   superseded                    -> grey   "Superseded"
// The tooltip always carries the full valid-until date.
import { t, shortDate } from "../lib/i18n";
import { EXPIRING_DAYS, validityLabel } from "../lib/validity";

function tone(status, daysRemaining) {
  if (status === "expired") return { fg: "--risk-high", bg: "--risk-high-soft" };
  if (status === "superseded") return { fg: "--ink-2", bg: "--paper" };
  if (daysRemaining != null && daysRemaining <= EXPIRING_DAYS) return { fg: "--risk-moderate", bg: "--risk-moderate-soft" };
  return { fg: "--risk-low", bg: "--risk-low-soft" };
}

export default function ValidityBadge({ status, validUntil, daysRemaining }) {
  // Records from an API without validity fields: show nothing rather than a wrong state.
  if (!status) return null;
  const label = validityLabel(status, validUntil, daysRemaining);
  const { fg, bg } = tone(status, daysRemaining);
  const title = validUntil ? t("validity.validUntil", { date: shortDate(validUntil) }) : undefined;
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "2px var(--space-3)",
        border: `1px solid var(${fg})`,
        borderRadius: 999,
        background: `var(${bg})`,
        color: `var(${fg})`,
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, flex: "none", borderRadius: "50%", background: `var(${fg})` }} />
      {label}
    </span>
  );
}
