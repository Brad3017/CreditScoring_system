// "Learn" lessons, keyed by model feature key (ml_artifacts/model_metadata.json "features").
// Content lives in src/content/lessons.<lang>.json. English is the reference; another language
// (e.g. lessons.sw.json) only needs the same keys, and any missing lesson falls back to English.
// There is no i18n library yet, so the language comes from <html lang> (default "en").
const FILES = import.meta.glob("../content/lessons.*.json", { eager: true, import: "default" });

function file(lang) {
  return FILES[`../content/lessons.${lang}.json`] || null;
}

const EN = file("en") || {};

export function currentLang() {
  if (typeof document === "undefined") return "en";
  return (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
}

export function getLessons(lang = currentLang()) {
  const local = lang === "en" ? null : file(lang);
  return local ? { ...EN, ...local } : EN;
}

export function getLesson(key, lang = currentLang()) {
  return getLessons(lang)[key] || null;
}

export const hasLesson = (key) => Object.prototype.hasOwnProperty.call(EN, key);

// Answers with a guide that are NOT in the current model's score (model v3). Collateral only sets the
// recommended loan limit, so its guide stays on the Learn page but is never linked from score factors,
// even when an older stored assessment (v2) still lists it among its SHAP values.
const NOT_IN_SCORE = new Set(["collateral_level"]);

// A guide exists AND the answer is part of the current score: safe to link from factor lists.
export const hasScoreLesson = (key) => hasLesson(key) && !NOT_IN_SCORE.has(key);

// The stored SHAP direction for one feature of an assessment, or null when not recorded
// (or when the answer is no longer part of the score, so the note cannot contradict the guide).
export function storedDirection(assessment, key) {
  if (NOT_IN_SCORE.has(key)) return null;
  const row = (assessment?.shap_values || []).find((v) => v.feature === key);
  if (!row || typeof row.value !== "number" || row.value === 0) return null;
  return row.direction === "raises_risk" ? "raised" : "lowered";
}

// Lesson keys for the largest risk-raising factors of an assessment, most harmful first.
export function topRaisingLessonKeys(assessment, limit = 2) {
  return (assessment?.shap_values || [])
    .filter((v) => v.direction === "raises_risk" && v.value > 0 && hasScoreLesson(v.feature))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((v) => v.feature);
}
