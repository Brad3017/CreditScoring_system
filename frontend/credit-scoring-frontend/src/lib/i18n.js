// UI strings, keyed like "validity.expired". The app is English only: the strings live in
// src/content/strings.en.json, and an unknown key is returned as-is so a gap is visible rather than blank.
import STRINGS from "../content/strings.en.json";

// t("validity.expired", { date: "17 Dec 2026" }) -> "Expired on 17 Dec 2026"
export function t(key, vars = {}) {
  const template = STRINGS[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 17 Dec 2026 in Nairobi time: the same text as the PDFs (scoring/validity.py short_date). The months
// are spelled out here because some browsers write "Sept".
export function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "numeric", year: "numeric" })
      .formatToParts(d).map((p) => [p.type, p.value])
  );
  return `${parts.day} ${MONTHS_EN[Number(parts.month) - 1]} ${parts.year}`;
}
