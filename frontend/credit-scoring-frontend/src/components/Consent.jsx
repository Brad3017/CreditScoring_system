// Consent building blocks. The wording always comes from the server (GET /api/consents/texts/,
// accounts/consent_texts.py), so the text a user ticks is exactly the text whose version is recorded.
//   useConsentTexts()   {texts, version, error}; texts is null while loading
//   ConsentCheck        a checkbox with the consent text as its label
//   ConsentGate         the full-page "accept to continue" screen shown after sign-in (App.jsx)
//   CreditScoringCard   "Before your first assessment" panel on the new-assessment page
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell, { ErrorNote } from "./AuthShell";
import { clearSession, fetchConsents, fetchConsentTexts, getRole, grantConsent } from "../lib/api";

export function useConsentTexts() {
  const [state, setState] = useState({ texts: null, version: null, error: "" });
  useEffect(() => {
    let live = true;
    fetchConsentTexts()
      .then((b) => live && setState({ texts: b.texts, version: b.version, error: "" }))
      .catch((e) => live && setState({ texts: null, version: null, error: e.message }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function ConsentCheck({ id, checked, onChange, children, required = false, disabled = false }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", margin: "0 0 var(--space-4)" }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-required={required || undefined}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 20, height: 20, marginTop: 3, flex: "none", accentColor: "var(--accent)" }}
      />
      <label htmlFor={id} style={{ fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
        {children}
        {!required && <span style={{ color: "var(--ink-2)" }}> (optional)</span>}
      </label>
    </div>
  );
}

export const PRIVACY_SUMMARY =
  "We use your information to assess your business's credit risk. A credit analyst reviews every application.";

export function PrivacyLink({ children = "Read the privacy notice" }) {
  return (
    <Link to="/privacy" target="_blank" rel="noopener" style={{ color: "var(--accent)", fontWeight: 600 }}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

const linkButton = {
  background: "none", border: 0, padding: 0, font: "inherit", color: "var(--accent)", fontWeight: 600,
  cursor: "pointer", textDecoration: "underline",
};

// Shown instead of every signed-in page while a required consent is missing.
export function ConsentGate({ missing }) {
  const navigate = useNavigate();
  const { texts, error: textError } = useConsentTexts();
  const staff = missing.includes("staff_confidentiality") || ["analyst", "admin"].includes(getRole());
  const purpose = staff ? "staff_confidentiality" : "privacy_notice";
  const [ticked, setTicked] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // "We've updated our privacy notice." when this user accepted an earlier version.
  useEffect(() => {
    let live = true;
    fetchConsents()
      .then((b) => {
        const row = b.consents.find((c) => c.purpose === purpose);
        if (live) setUpdated(Boolean(row?.version && row.version !== b.version));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [purpose]);

  async function accept(e) {
    e.preventDefault();
    if (!staff && !ticked) return;
    setBusy(true);
    setError("");
    try {
      await grantConsent(purpose); // clears `missing`, so App shows the page that was asked for
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function logOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  const text = texts?.[purpose];
  return (
    <AuthShell
      width={560}
      title={staff ? "Confidentiality agreement" : updated ? "We've updated our privacy notice." : "Before you continue"}
      subtitle={staff
        ? "You can see MSME owners' personal and financial details. Please confirm how you will handle them."
        : updated ? "Please read it and confirm to keep using BiasharaScore." : PRIVACY_SUMMARY}
    >
      <form onSubmit={accept}>
        <ErrorNote>{error || textError}</ErrorNote>
        {!staff && (
          <p style={{ margin: "0 0 var(--space-4)" }}>
            {updated && <>{PRIVACY_SUMMARY} </>}
            <PrivacyLink />
          </p>
        )}
        {staff ? (
          <p style={{ margin: "0 0 var(--space-6)", padding: "var(--space-4)", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
            {text || "Loading…"}
          </p>
        ) : (
          <ConsentCheck id="gate-privacy" checked={ticked} onChange={setTicked} required disabled={!text}>
            {text || "Loading…"}
          </ConsentCheck>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !text || (!staff && !ticked)}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {busy ? "Saving…" : staff ? "I agree" : "Continue"}
        </button>
      </form>
      <p style={{ margin: "var(--space-6) 0 0", textAlign: "center", color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>
        Don't want to continue? <button type="button" onClick={logOut} style={linkButton}>Log out</button>
      </p>
    </AuthShell>
  );
}

// New-assessment page: shown until the owner agrees to credit scoring. onAgreed runs after the grant.
export function CreditScoringCard({ onAgreed }) {
  const { texts, error: textError } = useConsentTexts();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function agree() {
    setBusy(true);
    setError("");
    try {
      await grantConsent("credit_scoring");
      onAgreed?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="cs-consent-title" style={{ borderColor: "var(--accent)", marginBottom: "var(--space-6)" }}>
      <h2 id="cs-consent-title" className="panel-title">Before your first assessment</h2>
      <ErrorNote>{error || textError}</ErrorNote>
      <p style={{ margin: "0 0 var(--space-4)", maxWidth: "70ch" }}>{texts?.credit_scoring || "Loading…"}</p>
      <p style={{ margin: "0 0 var(--space-5)", color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>
        <PrivacyLink>Read the privacy notice</PrivacyLink>
      </p>
      <button type="button" className="btn btn-primary" onClick={agree} disabled={busy || !texts}>
        {busy ? "Saving…" : "I agree"}
      </button>
    </section>
  );
}
