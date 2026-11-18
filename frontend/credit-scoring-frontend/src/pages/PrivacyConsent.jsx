// Account → Privacy and consent (/account/privacy). Owners: one row per purpose, withdraw credit scoring,
// switch email updates on or off. Staff: when they accepted the confidentiality agreement.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import AnalystLayout from "../components/AnalystLayout";
import AdminLayout from "../components/AdminLayout";
import { ErrorNote } from "../components/AuthShell";
import { useConsentTexts } from "../components/Consent";
import { fetchConsents, getRole, grantConsent, withdrawConsent } from "../lib/api";
import { PRIVACY_EMAIL, PURPOSE_LABELS } from "../lib/consent";
import { shortDate } from "../lib/i18n";

const WITHDRAW_WARNING =
  "If you withdraw, you won't be able to request new assessments, and analysts won't be able to approve your " +
  "pending applications. You can still view your past results. You can give consent again later.";

function statusText(c) {
  if (c.purpose === "statement_processing") {
    return c.granted_at ? `Asked with each upload · last given on ${shortDate(c.granted_at)}` : "Asked with each upload";
  }
  if (c.active) return `Active since ${shortDate(c.granted_at)}`;
  if (c.withdrawn_at) return `Withdrawn on ${shortDate(c.withdrawn_at)}`;
  if (c.version) return "Given for an earlier version";
  return "Not given";
}

const rowStyle = {
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "var(--space-4)", alignItems: "start",
  padding: "var(--space-5) 0", borderTop: "1px solid var(--line)",
};

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 52, height: 30, borderRadius: 999, border: `1px solid ${checked ? "var(--accent)" : "var(--line-strong)"}`,
        background: checked ? "var(--accent)" : "var(--paper)", position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        padding: 0, flex: "none",
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 3, left: checked ? 25 : 3, width: 22, height: 22, borderRadius: "50%",
        background: checked ? "var(--surface)" : "var(--ink-2)", transition: "left 120ms",
      }} />
    </button>
  );
}

function ConfirmWithdraw({ open, onCancel, onConfirm, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      aria-labelledby="withdraw-title"
      style={{ maxWidth: "32rem", width: "calc(100% - 2rem)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-lg)", padding: "var(--space-6)", background: "var(--surface)", color: "var(--ink)" }}
    >
      <h2 id="withdraw-title" style={{ fontSize: "var(--text-lg)", margin: "0 0 var(--space-3)" }}>Withdraw consent for credit scoring?</h2>
      <p style={{ margin: "0 0 var(--space-6)" }}>{WITHDRAW_WARNING}</p>
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy} autoFocus>Keep consent</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}
          style={{ background: "var(--risk-high)", borderColor: "var(--risk-high)", color: "#fff" }}>
          {busy ? "Withdrawing…" : "Withdraw"}
        </button>
      </div>
    </dialog>
  );
}

function OwnerRows({ data, texts, onChange }) {
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(key, action, message) {
    setBusy(key); setError(""); setNotice("");
    try {
      onChange(await action());
      setNotice(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  const order = ["privacy_notice", "credit_scoring", "communications", "statement_processing"];
  const rows = order.map((p) => data.consents.find((c) => c.purpose === p)).filter(Boolean);

  return (
    <>
      <ErrorNote>{error}</ErrorNote>
      {notice && <p role="status" style={{ margin: "0 0 var(--space-4)", color: "var(--risk-low)" }}>{notice}</p>}
      <div>
        {rows.map((c, i) => (
          <div key={c.purpose} style={i === 0 ? { ...rowStyle, borderTop: 0, paddingTop: 0 } : rowStyle}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)" }}>{PURPOSE_LABELS[c.purpose] || c.label}</h3>
              <p style={{ margin: "var(--space-1) 0 0", color: c.active ? "var(--risk-low)" : "var(--ink-2)", fontWeight: 600, fontSize: "var(--text-sm)" }}>
                {statusText(c)}{c.version ? ` · version ${c.version}` : ""}
              </p>
              {texts?.[c.purpose] && (
                <p style={{ margin: "var(--space-2) 0 0", color: "var(--ink-2)", fontSize: "var(--text-sm)", maxWidth: "70ch" }}>{texts[c.purpose]}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              {c.purpose === "privacy_notice" && (
                <Link to="/privacy" target="_blank" rel="noopener" style={{ color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  View notice<span className="sr-only"> (opens in a new tab)</span>
                </Link>
              )}
              {c.purpose === "credit_scoring" && (c.active ? (
                <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => setConfirming(true)}>Withdraw</button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={!!busy}
                  onClick={() => run("cs", () => grantConsent("credit_scoring"), "Consent for credit scoring given.")}>
                  {busy === "cs" ? "Saving…" : "I agree"}
                </button>
              ))}
              {c.purpose === "communications" && (
                <Switch
                  checked={c.active}
                  disabled={!!busy}
                  label="Email updates about my assessments"
                  onChange={(on) => run("comms", () => (on ? grantConsent("communications") : withdrawConsent("communications")),
                    on ? "Email updates switched on." : "Email updates switched off.")}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: "var(--space-4) 0 0", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line)", color: "var(--ink-2)" }}>
        To have your account and data deleted, email{" "}
        <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: "var(--accent)", fontWeight: 600 }}>{PRIVACY_EMAIL}</a>.
      </p>
      <ConfirmWithdraw
        open={confirming}
        busy={busy === "withdraw"}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          if (await run("withdraw", () => withdrawConsent("credit_scoring"), "Consent for credit scoring withdrawn.")) setConfirming(false);
        }}
      />
    </>
  );
}

function StaffRows({ data, texts }) {
  const c = data.consents.find((x) => x.purpose === "staff_confidentiality");
  return (
    <div style={{ ...rowStyle, borderTop: 0, padding: 0 }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: "var(--text-base)" }}>Staff confidentiality agreement</h3>
        <p style={{ margin: "var(--space-1) 0 0", color: c?.active ? "var(--risk-low)" : "var(--ink-2)", fontWeight: 600, fontSize: "var(--text-sm)" }}>
          {c?.granted_at ? `Accepted on ${shortDate(c.granted_at)}` : "Not accepted"}{c?.version ? ` · version ${c.version}` : ""}
        </p>
        {texts?.staff_confidentiality && (
          <p style={{ margin: "var(--space-2) 0 0", color: "var(--ink-2)", fontSize: "var(--text-sm)", maxWidth: "70ch" }}>{texts.staff_confidentiality}</p>
        )}
      </div>
    </div>
  );
}

export default function PrivacyConsent() {
  const role = getRole();
  const staff = role === "analyst" || role === "admin";
  const { texts } = useConsentTexts();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchConsents().then(setData).catch((e) => setError(e.message));
  }, []);

  const intro = staff
    ? "What you agreed to when you started using the staff pages."
    : "What you have agreed to, and when. Choices that can be withdrawn can be changed at any time.";
  const body = (
    <section className="panel" aria-label="Your consents" style={{ maxWidth: "52rem" }}>
      <ErrorNote>{error}</ErrorNote>
      {!data && !error && <p role="status" style={{ color: "var(--ink-2)" }}>Loading…</p>}
      {data && (staff ? <StaffRows data={data} texts={texts} /> : <OwnerRows data={data} texts={texts} onChange={setData} />)}
    </section>
  );

  if (role === "admin") return <AdminLayout title="Privacy and consent" subtitle={intro}>{body}</AdminLayout>;
  if (role === "analyst") return <AnalystLayout title="Privacy and consent" subtitle={intro}>{body}</AnalystLayout>;
  return (
    <AppShell>
      <header className="page-head">
        <h1>Privacy and consent</h1>
        <p>{intro}</p>
      </header>
      {body}
    </AppShell>
  );
}
