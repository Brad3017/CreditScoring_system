// Consent state shared by the whole app (Data Protection Act 2019 s.32).
// missing: the REQUIRED consents the signed-in user still has to give, from /auth/me/ (or the login and
// sign-up responses): ["privacy_notice"] for owners, ["staff_confidentiality"] for staff, [] when done.
// While it is not empty, App shows the ConsentGate instead of any signed-in page.
import { useSyncExternalStore } from "react";

let missing = [];
const listeners = new Set();

export function setMissingConsents(list) {
  const next = Array.isArray(list) ? list : [];
  if (next.length === missing.length && next.every((p, i) => p === missing[i])) return;
  missing = next;
  listeners.forEach((fn) => fn());
}

export function useMissingConsents() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => missing,
  );
}

// A 403 {code: "consent_required", purposes: ["credit_scoring"]} from assessment creation: the
// new-assessment page listens for this and shows its consent card again.
export const CREDIT_SCORING_EVENT = "bs:credit-scoring-consent-required";

export const PRIVACY_EMAIL = "privacy@biasharascore.example";
export const NOTICE_VERSION = "1.0";
export const NOTICE_DATE = "18 Nov 2026";

export const PURPOSE_LABELS = {
  privacy_notice: "Privacy notice",
  credit_scoring: "Credit scoring",
  statement_processing: "Till statement reading",
  communications: "Email updates",
  staff_confidentiality: "Staff confidentiality",
};
