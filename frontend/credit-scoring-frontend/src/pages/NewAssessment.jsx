import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { COUNTIES } from "../lib/counties";
import { fetchBusinessProfile, getCurrentUser, submitAssessment } from "../lib/api";
import { KRA_PIN_MESSAGE, KRA_PIN_PLACEHOLDER, isValidKraPin, normaliseKraPin } from "../lib/kraPin";
import { useEffect } from "react";

const DRAFT_KEY = "biasharascore_assessment_draft";

// Business fields that live on the saved BusinessProfile and are prefilled from it.
const PROFILE_FIELDS = ["business_name", "sector", "county", "location_type", "legal_status", "business_age_years", "employees_count"];

const STEPS = [
  { id: 1, title: "Business" },
  { id: 2, title: "Finances" },
  { id: 3, title: "Borrowing history" },
  { id: 4, title: "Review" },
];

const INITIAL = {
  business_name: "",
  kra_pin: "",
  legal_status: "Sole",
  sector: "Retail",
  county: "Nairobi",
  location_type: "Urban",
  business_age_years: "3",
  employees_count: "3",
  owner_education: "Secondary",

  monthly_revenue_kes: "200000",
  monthly_profit_kes: "95000",
  loan_amount: "500000",
  loan_purpose: "Working capital",
  tenure_months: "12",
  days_payable_outstanding: "30",
  cashflow_stability: "4",

  existing_loans: "No",
  prior_loan_count: "1",
  late_payment_history: "Never",
  collateral_level: "Moderate",
  repayment_confidence: "4",
};

// Must match nominal_categories.loan_purpose in ml_artifacts/model_metadata.json.
const LOAN_PURPOSES = ["Equipment", "Expansion", "Inventory", "Renovation", "Working capital"];

const isWhole = (v, min, max) => /^\d+$/.test(String(v)) && Number(v) >= min && Number(v) <= max;
const isNumber = (v, min) => String(v).trim() !== "" && !Number.isNaN(Number(v)) && Number(v) >= min;

// Returns { field: message } for the given step. Empty object means the step is valid.
function validate(step, f) {
  const e = {};
  if (step === 1) {
    if (!f.business_name.trim()) e.business_name = "Enter the business name.";
    if (!isValidKraPin(f.kra_pin)) e.kra_pin = KRA_PIN_MESSAGE;
    if (!COUNTIES.includes(f.county)) e.county = "Choose a county from the list.";
    if (!isWhole(f.business_age_years, 0, 200)) e.business_age_years = "Enter whole years, 0 or more.";
    if (!isWhole(f.employees_count, 0, 10000)) e.employees_count = "Enter a whole number of employees.";
  }
  // Same rules as CreditRequestSerializer.validate on the server.
  if (step === 2) {
    const revenue = Number(f.monthly_revenue_kes);
    const profit = Number(f.monthly_profit_kes);
    if (!isNumber(f.monthly_revenue_kes, 0) || revenue <= 0) e.monthly_revenue_kes = "Enter your monthly revenue in KES. It must be more than 0.";
    if (!isNumber(f.monthly_profit_kes, 0)) e.monthly_profit_kes = "Enter your average monthly profit, 0 or more.";
    else if (revenue > 0 && profit > revenue) e.monthly_profit_kes = "Profit cannot be greater than monthly revenue.";
    if (!isNumber(f.loan_amount, 0) || Number(f.loan_amount) <= 0) e.loan_amount = "Enter the amount you are requesting. It must be more than 0.";
    if (!LOAN_PURPOSES.includes(f.loan_purpose)) e.loan_purpose = "Choose a loan purpose from the list.";
    if (!isWhole(f.tenure_months, 3, 60)) e.tenure_months = "Enter a repayment period between 3 and 60 months.";
    if (!isWhole(f.days_payable_outstanding, 0, 365)) e.days_payable_outstanding = "Enter a number of days between 0 and 365.";
    if (!isWhole(f.cashflow_stability, 1, 5)) e.cashflow_stability = "Choose a value from 1 to 5.";
  }
  if (step === 3) {
    if (!isWhole(f.prior_loan_count, 0, 1000)) e.prior_loan_count = "Enter a whole number, 0 or more.";
    if (!["Never", "Rarely", "Sometimes"].includes(f.late_payment_history)) e.late_payment_history = "Choose a repayment record from the list.";
    if (!isWhole(f.repayment_confidence, 1, 5)) e.repayment_confidence = "Choose a value from 1 to 5.";
  }
  return e;
}

// Converts the form's strings into the types the API expects.
function toPayload(f) {
  return {
    ...f,
    kra_pin: normaliseKraPin(f.kra_pin),
    business_age_years: Number(f.business_age_years),
    employees_count: Number(f.employees_count),
    monthly_revenue_kes: Number(f.monthly_revenue_kes),
    monthly_profit_kes: Number(f.monthly_profit_kes),
    loan_amount: Number(f.loan_amount),
    tenure_months: Number(f.tenure_months),
    days_payable_outstanding: Number(f.days_payable_outstanding),
    cashflow_stability: Number(f.cashflow_stability),
    prior_loan_count: Number(f.prior_loan_count),
    repayment_confidence: Number(f.repayment_confidence),
  };
}

export default function NewAssessment() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => loadDraft() || INITIAL);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // True when the business profile already holds a PIN: it is shown read-only and never overwritten.
  const [pinLocked, setPinLocked] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {});
    fetchBusinessProfile()
      .then((profile) => {
        if (!profile?.id) return; // No saved profile yet: the owner fills the business step.
        // Prefill from the saved profile. A field the owner already changed (e.g. in a saved draft)
        // is left alone; the server never overwrites saved profile fields from an assessment anyway.
        setForm((f) => {
          const next = { ...f };
          for (const field of PROFILE_FIELDS) {
            const saved = profile[field];
            if (saved == null || saved === "") continue;
            if (f[field] === "" || f[field] === INITIAL[field]) next[field] = String(saved);
          }
          if (profile.kra_pin) next.kra_pin = profile.kra_pin;
          return next;
        });
        if (profile.kra_pin) setPinLocked(true);
      })
      .catch(() => {}); // Not fatal: the form still works without a prefill.
  }, []);

  function update(e) {
    const { name } = e.target;
    const value = name === "kra_pin" ? e.target.value.toUpperCase() : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setNotice("");
  }

  function next() {
    const found = validate(step, form);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((s) => Math.min(4, s + 1));
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setNotice("Draft saved on this device.");
    } catch {
      setNotice("Could not save a draft in this browser.");
    }
  }

  async function submit() {
    // Re-check every step before sending, in case the user jumped around.
    for (const s of [1, 2, 3]) {
      const found = validate(s, form);
      if (Object.keys(found).length) {
        setErrors(found);
        setStep(s);
        return;
      }
    }
    setBusy(true);
    setSubmitError("");
    try {
      const result = await submitAssessment(toPayload(form));
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      navigate("/assessment/results", { state: { assessment: result } });
    } catch (err) {
      // Field errors from the server (e.g. a PIN already registered) go under their own input.
      if (err.fields && Object.keys(err.fields).length) {
        setErrors(err.fields);
        if (err.fields.kra_pin || err.fields.business_name) setStep(1);
      }
      setSubmitError(err.message || "The assessment could not be completed. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell user={user}>
      <header className="page-head">
        <h1>New assessment</h1>
        <p>Step {step} of 4: {STEPS[step - 1].title}</p>
      </header>

      <section className="panel">
      <ol aria-label="Progress" style={{ display: "flex", gap: "var(--space-6)", listStyle: "none", padding: 0, margin: "0 0 var(--space-6)", flexWrap: "wrap" }}>
        {STEPS.map((s) => (
          <li key={s.id} style={{ color: s.id === step ? "var(--ink)" : "var(--ink-2)", fontWeight: s.id === step ? 600 : 400, borderBottom: s.id === step ? "2px solid var(--accent)" : "2px solid transparent", paddingBottom: 2 }}>
            {s.id < step ? "✓ " : ""}{s.title}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Section title="Business">
          <Field label="Business name" name="business_name" value={form.business_name} onChange={update} error={errors.business_name} required />
          <Field label="KRA PIN" name="kra_pin" value={form.kra_pin} onChange={update} error={errors.kra_pin}
            placeholder={KRA_PIN_PLACEHOLDER} maxLength={11} autoCapitalize="characters" spellCheck={false}
            readOnly={pinLocked} hint={pinLocked ? "Change it in Business profile" : null} />
          <SelectField label="Legal structure" name="legal_status" value={form.legal_status} onChange={update}
            options={[["Sole", "Sole proprietorship"], ["Partnership", "Partnership"], ["Limited", "Limited company"]]} />
          <SelectField label="Sector" name="sector" value={form.sector} onChange={update}
            options={[["Retail", "Retail"], ["Manufacturing", "Manufacturing"], ["Services", "Services"], ["Agriculture", "Agriculture"]]} />
          <SelectField label="County" name="county" value={form.county} onChange={update} error={errors.county}
            options={COUNTIES.map((c) => [c, c])} />
          <SelectField label="Operating environment" name="location_type" value={form.location_type} onChange={update}
            options={[["Urban", "Urban"], ["Rural", "Rural"]]} />
          <Field label="Years trading" name="business_age_years" type="number" min="0" value={form.business_age_years} onChange={update} error={errors.business_age_years} />
          <Field label="Number of employees" name="employees_count" type="number" min="0" value={form.employees_count} onChange={update} error={errors.employees_count} />
          <SelectField label="Highest education of the owner" name="owner_education" value={form.owner_education} onChange={update}
            options={[["Primary", "Primary"], ["Secondary", "Secondary"], ["Higher Secondary", "Higher secondary or diploma"], ["Bachelor's", "Bachelor's degree"], ["Master's", "Master's degree"]]} />
        </Section>
      )}

      {step === 2 && (
        <Section title="Finances">
          <Field label="Monthly revenue (KES)" name="monthly_revenue_kes" type="number" min="0" value={form.monthly_revenue_kes} onChange={update} error={errors.monthly_revenue_kes} />
          <Field label="Average monthly profit (KES)" name="monthly_profit_kes" type="number" min="0" value={form.monthly_profit_kes} onChange={update} error={errors.monthly_profit_kes} />
          <Field label="Amount requested (KES)" name="loan_amount" type="number" min="1" value={form.loan_amount} onChange={update} error={errors.loan_amount} />
          <SelectField label="Loan purpose" name="loan_purpose" value={form.loan_purpose} onChange={update} error={errors.loan_purpose}
            options={LOAN_PURPOSES.map((p) => [p, p])} />
          <Field label="Repayment period (months)" name="tenure_months" type="number" min="3" max="60" value={form.tenure_months} onChange={update} error={errors.tenure_months} />
          <Field label="Days you take to pay suppliers" name="days_payable_outstanding" type="number" min="0" max="365" value={form.days_payable_outstanding} onChange={update} error={errors.days_payable_outstanding} />
          <SelectField label="How predictable are your weekly sales?" name="cashflow_stability" value={form.cashflow_stability} onChange={update}
            error={errors.cashflow_stability}
            options={[["1", "1 – Highly volatile or irregular"], ["2", "2 – Seasonal swings"], ["3", "3 – Moderately consistent"], ["4", "4 – Mostly predictable"], ["5", "5 – Very steady"]]} />
        </Section>
      )}

      {step === 3 && (
        <Section title="Borrowing history">
          <SelectField label="Do you have loans running now?" name="existing_loans" value={form.existing_loans} onChange={update}
            options={[["No", "No"], ["Yes", "Yes"]]} />
          <Field label="Loans repaid in the past" name="prior_loan_count" type="number" min="0" value={form.prior_loan_count} onChange={update} error={errors.prior_loan_count} />
          <SelectField label="Repayment record" name="late_payment_history" value={form.late_payment_history} onChange={update} error={errors.late_payment_history}
            options={[["Never", "Never late"], ["Rarely", "Rarely late (one delay)"], ["Sometimes", "Sometimes late (two or more delays)"]]} />
          <SelectField label="Security you can offer" name="collateral_level" value={form.collateral_level} onChange={update}
            options={[["Low", "Low – personal guarantee or household"], ["Moderate", "Moderate – stock or vehicle logbook"], ["High", "High – title deed or fixed deposit"]]} />
          <SelectField label="How confident are you in repaying?" name="repayment_confidence" value={form.repayment_confidence} onChange={update} error={errors.repayment_confidence}
            options={[["1", "1 – Low, with strain"], ["2", "2 – Somewhat uncertain"], ["3", "3 – Moderate"], ["4", "4 – High"], ["5", "5 – Certain"]]} />
        </Section>
      )}

      {step === 4 && (
        <fieldset className="form-group" aria-labelledby="review-heading">
          <legend id="review-heading">Check your details</legend>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", margin: 0 }}>
            <Review label="Business" value={form.business_name} />
            <Review label="KRA PIN" value={normaliseKraPin(form.kra_pin)} />
            <Review label="County" value={form.county} />
            <Review label="Sector" value={form.sector} />
            <Review label="Monthly revenue" value={`KES ${Number(form.monthly_revenue_kes).toLocaleString("en-KE")}`} />
            <Review label="Amount requested" value={`KES ${Number(form.loan_amount).toLocaleString("en-KE")}`} />
            <Review label="Loan purpose" value={form.loan_purpose} />
            <Review label="Security" value={form.collateral_level} />
          </dl>
          <p style={{ color: "var(--ink-2)", marginTop: "var(--space-6)", fontSize: "var(--text-xs)" }}>
            This assessment supports credit evaluation. It does not approve or issue a loan.
          </p>
        </fieldset>
      )}

      {submitError && <p role="alert" style={{ color: "var(--risk-high)", marginTop: "var(--space-6)" }}>{submitError}</p>}
      {notice && <p role="status" style={{ color: "var(--ink-2)", marginTop: "var(--space-6)" }}>{notice}</p>}

      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-6)", paddingTop: "var(--space-5)", borderTop: "1px solid var(--line)" }}>
        <button type="button" className="btn btn-secondary" onClick={saveDraft}>Save draft</button>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {step > 1 && <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}>Back</button>}
          {step < 4 && <button type="button" className="btn btn-primary" onClick={next}>Continue</button>}
          {step === 4 && <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "Scoring…" : "Submit for assessment"}</button>}
        </div>
      </footer>
      </section>
    </AppShell>
  );
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...INITIAL, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function Section({ title, children }) {
  return (
    <fieldset className="form-group">
      <legend>{title}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "var(--space-6)" }}>{children}</div>
    </fieldset>
  );
}

const controlStyle = {
  font: "inherit",
  width: "100%",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--ink)",
};

function Label({ text, htmlFor, required }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-1)" }}>
      {text}{required ? " *" : ""}
    </label>
  );
}

function Field({ label, name, error, required, hint, readOnly, ...rest }) {
  const id = `f-${name}`;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <Label text={label} htmlFor={id} required={required} />
      <input id={id} name={name} required={required} readOnly={readOnly} aria-invalid={!!error} aria-describedby={describedBy}
        style={readOnly ? { ...controlStyle, background: "var(--paper)", color: "var(--ink-2)" } : controlStyle} {...rest} />
      {error && <p id={`${id}-err`} style={{ color: "var(--risk-high)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{error}</p>}
      {hint && !error && <p id={`${id}-hint`} style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{hint}</p>}
    </div>
  );
}

function SelectField({ label, name, options, error, ...rest }) {
  const id = `f-${name}`;
  return (
    <div>
      <Label text={label} htmlFor={id} />
      <select id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} style={controlStyle} {...rest}>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
      {error && <p id={`${id}-err`} style={{ color: "var(--risk-high)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{error}</p>}
    </div>
  );
}

function Review({ label, value }) {
  return (
    <div>
      <dt style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{label}</dt>
      <dd style={{ margin: "var(--space-1) 0 0", fontWeight: 600 }}>{value || "Not entered"}</dd>
    </div>
  );
}
