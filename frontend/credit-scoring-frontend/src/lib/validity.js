// Score validity helpers for the API fields validity_status, valid_until and days_remaining
// (computed on the server in scoring/validity.py). The pill itself is components/ValidityBadge.jsx.
import { t, shortDate } from "./i18n";

// At or below this many days left, a valid score shows as "expiring" (amber).
export const EXPIRING_DAYS = 7;

export function validityLabel(status, validUntil, daysRemaining) {
  if (status === "expired") return t("validity.expired", { date: shortDate(validUntil) });
  if (status === "superseded") return t("validity.superseded");
  if (status !== "valid") return "";
  if (daysRemaining == null) return t("validity.validUntil", { date: shortDate(validUntil) });
  return t(daysRemaining > EXPIRING_DAYS ? "validity.valid" : "validity.expiring", { n: daysRemaining });
}

// Props for the badge from an API assessment payload.
export const validityProps = (a) => ({
  status: a?.validity_status,
  validUntil: a?.valid_until,
  daysRemaining: a?.days_remaining,
});

export const isScoreValid = (a) => !a?.validity_status || a.validity_status === "valid";
