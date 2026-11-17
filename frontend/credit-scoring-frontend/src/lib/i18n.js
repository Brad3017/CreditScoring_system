// UI strings, keyed like "validity.expired". Same approach as lib/lessons.js: there is no i18n library
// yet, so the language comes from <html lang> (default "en"), and the strings live in
// src/content/strings.<lang>.json. English is the reference; a missing key falls back to English,
// and an unknown key is returned as-is so a gap is visible rather than blank.
import { currentLang } from "./lessons";

const FILES = import.meta.glob("../content/strings.*.json", { eager: true, import: "default" });
const EN = FILES["../content/strings.en.json"] || {};

// t("validity.expired", { date: "17 Dec 2026" }) -> "Expired on 17 Dec 2026"
export function t(key, vars = {}, lang = currentLang()) {
  const local = lang === "en" ? null : FILES[`../content/strings.${lang}.json`];
  const template = local?.[key] ?? EN[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 17 Dec 2026 in Nairobi time: the same text as the PDFs (scoring/validity.py short_date). English
// months are spelled out here because some browsers write "Sept"; Swahili uses the browser's sw-KE names.
export function shortDate(iso, lang = currentLang()) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = { timeZone: "Africa/Nairobi" };
  if (lang === "sw") return d.toLocaleDateString("sw-KE", { ...tz, day: "2-digit", month: "short", year: "numeric" });
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { ...tz, day: "2-digit", month: "numeric", year: "numeric" })
      .formatToParts(d).map((p) => [p.type, p.value])
  );
  return `${parts.day} ${MONTHS_EN[Number(parts.month) - 1]} ${parts.year}`;
}
