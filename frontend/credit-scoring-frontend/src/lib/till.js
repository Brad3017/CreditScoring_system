// Lipa na M-Pesa till statements: shared helpers for the form, the result page and the analyst view.
// Figures come from the API (scoring/statements/ on the server); nothing is recomputed here.
import { t, shortDate } from "./i18n";

export const kes = (v) => `KES ${Math.round(Number(v) || 0).toLocaleString("en-KE")}`;
export const pct = (share) => `${Math.round((Number(share) || 0) * 100)}%`;

// "17 Aug – 16 Nov 2026" (the year once when both ends share it).
export function periodLabel(start, end) {
  if (!start || !end) return "";
  const a = shortDate(start);
  const b = shortDate(end);
  const [aDay, aMonth, aYear] = a.split(" ");
  return aYear && aYear === b.split(" ")[2] ? `${aDay} ${aMonth} – ${b}` : `${a} – ${b}`;
}

// "Till 9900104, 17 Aug – 16 Nov 2026"
export function tillLine(s) {
  return s ? t("till.tillPeriod", { till: s.shortcode, period: periodLabel(s.period_start, s.period_end) }) : "";
}

// The message for an upload error code; a rejected statement adds each failed check's message.
export function uploadErrorLines(err) {
  const code = err?.code || "upload_failed";
  const key = `till.err.${code}`;
  const head = t(key);
  const lines = [head === key ? err?.message || t("till.err.upload_failed") : head];
  if (code === "statement_rejected") {
    for (const c of err.checks || []) if (c.status === "fail") lines.push(c.message);
  }
  return lines;
}

// "+12.4%" / "−4.6%" / "–" when there is no trend.
export function trendLabel(v) {
  if (v == null) return "–";
  const n = Number(v);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;
}

// Short month name for "2026-08" (English names, as on the PDFs).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(ym) {
  const [y, m] = String(ym).split("-");
  return MONTHS[Number(m) - 1] ? `${MONTHS[Number(m) - 1]} ${y}` : ym;
}
