// KRA PIN rule, mirrored from the backend (scoring/models.py), which is the source of truth.
export const KRA_PIN_RE = /^P\d{9}[A-Z]$/;
export const KRA_PIN_MESSAGE = "Enter a KRA PIN in the format P051234567X: the letter P, 9 digits, then a letter.";
export const KRA_PIN_PLACEHOLDER = "P051234567X";

export const normaliseKraPin = (v) => String(v ?? "").trim().toUpperCase();
export const isValidKraPin = (v) => KRA_PIN_RE.test(normaliseKraPin(v));
