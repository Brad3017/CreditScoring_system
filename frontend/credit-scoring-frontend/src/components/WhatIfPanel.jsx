// "Try a what-if": change a few stored answers and see the model's new score. Nothing is saved;
// every number shown comes from POST /api/scoring/simulate/ or from the stored assessment.
// Collateral stays a control but is not a model input (v3): it changes only the recommended limit.
// Repayment confidence is no longer a control. Shown only for assessments made with the current model.
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAssessmentInputs, simulateAssessment } from "../lib/api";
import { riskKeyFromCategory } from "./RiskScale";
import OutOfRangeNotice from "./OutOfRangeNotice";
import { muted } from "./analystUi";

const DEBOUNCE_MS = 400;
const LOAN_MIN = 25_000;
const LOAN_MAX = 9_000_000;
const LOAN_STEP = 25_000;
const DPO_MIN = 7;
const DPO_MAX = 90;
const TENURES = [6, 12, 18, 24, 30, 36];

const kes = (n) => (n == null ? "Not available" : `KES ${Math.round(Number(n)).toLocaleString("en-KE")}`);

const controlStyle = {
  font: "inherit",
  width: "100%",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--ink)",
};
const labelStyle = { display: "block", fontWeight: 600, marginBottom: "var(--space-1)" };

// Only these answers are editable; the rest of the stored inputs are sent unchanged.
const pickEditable = (inputs) => ({
  loan_amount: String(Math.round(Number(inputs.loan_amount))),
  tenure_months: Number(inputs.tenure_months),
  days_payable_outstanding: Number(inputs.days_payable_outstanding),
  cashflow_stability: Number(inputs.cashflow_stability),
  collateral_level: inputs.collateral_level,
  late_payment_history: inputs.late_payment_history,
});

export default function WhatIfPanel({ assessment }) {
  const [stored, setStored] = useState(null);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchAssessmentInputs(assessment.pk)
      .then((inputs) => {
        if (!alive) return;
        setStored(inputs);
        setForm(pickEditable(inputs));
        setCalculating(true);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => { alive = false; };
  }, [assessment.pk]);

  const loanNumber = form ? Number(form.loan_amount) : NaN;
  const loanValid = form && form.loan_amount !== "" && Number.isFinite(loanNumber) && loanNumber > 0;

  // Debounced simulate call: waits 400 ms after the last change and cancels any older request.
  useEffect(() => {
    if (!stored || !form || !loanValid) return undefined;
    const timer = setTimeout(() => {
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      simulateAssessment({ ...stored, ...form, loan_amount: loanNumber }, ctrl.signal)
        .then((body) => { if (!ctrl.signal.aborted) { setResult(body); setCalculating(false); } })
        .catch((e) => {
          if (ctrl.signal.aborted) return;
          setError(e.message);
          setCalculating(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [stored, form, loanValid, loanNumber]);

  useEffect(() => () => controller.current?.abort(), []);

  // Keep stored values selectable even when they fall outside the standard choices.
  const tenureOptions = useMemo(() => {
    const t = stored ? Number(stored.tenure_months) : null;
    return t != null && !TENURES.includes(t) ? [...TENURES, t].sort((a, b) => a - b) : TENURES;
  }, [stored]);
  const dpoMin = stored ? Math.min(DPO_MIN, Number(stored.days_payable_outstanding)) : DPO_MIN;
  const dpoMax = stored ? Math.max(DPO_MAX, Number(stored.days_payable_outstanding)) : DPO_MAX;

  if (loadError) return <p role="alert" style={{ margin: 0, color: "var(--risk-high)" }}>{loadError}</p>;
  if (!form) return <p aria-busy="true" style={{ margin: 0, color: "var(--ink-2)" }}>Loading your original answers…</p>;

  // Every change marks the result as pending; the effect above sends it after the pause.
  // Any request still in flight is for older answers: cancel it now, so its reply can never be
  // shown as the result for the new answers.
  const update = (next) => {
    controller.current?.abort();
    setForm(next);
    setError("");
    setCalculating(next.loan_amount !== "" && Number(next.loan_amount) > 0);
  };
  const set = (name, value) => update({ ...form, [name]: value });
  const inputError = loanValid ? "" : "Enter a loan amount greater than 0.";
  const original = pickEditable(stored);
  const changed = JSON.stringify(form) !== JSON.stringify(original);
  const changedKeys = Object.keys(form).filter((k) => String(form[k]) !== String(original[k]));
  // Collateral is not in the score (model v3): it moves only the recommended limit.
  const onlyCollateral = changedKeys.length === 1 && changedKeys[0] === "collateral_level";
  const fresh = result && !calculating && !error && !inputError;
  const sliderLoan = loanValid ? Math.min(LOAN_MAX, Math.max(LOAN_MIN, loanNumber)) : LOAN_MIN;

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "var(--space-6)" }}>
        <div>
          <label htmlFor="wi-loan" style={labelStyle}>Loan amount (KES)</label>
          <input id="wi-loan" type="number" inputMode="numeric" min={1} step={1000} value={form.loan_amount}
            onChange={(e) => set("loan_amount", e.target.value)} style={controlStyle} />
          <input type="range" aria-label="Loan amount slider" min={LOAN_MIN} max={LOAN_MAX} step={LOAN_STEP} value={sliderLoan}
            onChange={(e) => set("loan_amount", e.target.value)}
            style={{ width: "100%", marginTop: "var(--space-2)", accentColor: "var(--accent)" }} />
          <div className="num" style={{ ...muted, display: "flex", justifyContent: "space-between" }}>
            <span>{kes(LOAN_MIN)}</span><span>{kes(LOAN_MAX)}</span>
          </div>
        </div>

        <div>
          <label htmlFor="wi-tenure" style={labelStyle}>Repayment period</label>
          <select id="wi-tenure" value={form.tenure_months} onChange={(e) => set("tenure_months", Number(e.target.value))} style={controlStyle}>
            {tenureOptions.map((t) => <option key={t} value={t}>{t} months</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="wi-dpo" style={labelStyle}>
            Days taken to pay suppliers: <span className="num">{form.days_payable_outstanding}</span>
          </label>
          <input id="wi-dpo" type="range" min={dpoMin} max={dpoMax} step={1} value={form.days_payable_outstanding}
            onChange={(e) => set("days_payable_outstanding", Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }} />
          <div className="num" style={{ ...muted, display: "flex", justifyContent: "space-between" }}>
            <span>{dpoMin} days</span><span>{dpoMax} days</span>
          </div>
        </div>

        <div>
          <label htmlFor="wi-cash" style={labelStyle}>Cash-flow stability</label>
          <select id="wi-cash" value={form.cashflow_stability} onChange={(e) => set("cashflow_stability", Number(e.target.value))} style={controlStyle}>
            {[[1, "1 – Highly volatile or irregular"], [2, "2 – Seasonal swings"], [3, "3 – Moderately consistent"], [4, "4 – Mostly predictable"], [5, "5 – Very steady"]]
              .map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="wi-coll" style={labelStyle}>Collateral</label>
          <select id="wi-coll" value={form.collateral_level} onChange={(e) => set("collateral_level", e.target.value)} style={controlStyle}
            aria-describedby="wi-coll-hint">
            {["Low", "Moderate", "High"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <p id="wi-coll-hint" style={{ ...muted, margin: "var(--space-1) 0 0" }}>Changes the recommended limit only, not the score.</p>
        </div>

        <div>
          <label htmlFor="wi-late" style={labelStyle}>Late payment history</label>
          <select id="wi-late" value={form.late_payment_history} onChange={(e) => set("late_payment_history", e.target.value)} style={controlStyle}>
            {["Never", "Rarely", "Sometimes"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary" onClick={() => update(pickEditable(stored))} disabled={!changed}>
          Reset to my answers
        </button>
        <span aria-live="polite" style={{ color: "var(--ink-2)" }}>{calculating ? "Calculating…" : ""}</span>
      </div>

      {(inputError || error) && <p role="alert" style={{ margin: 0, color: "var(--risk-high)" }}>{inputError || error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "var(--space-4)" }}>
        <Tile title="Original" score={assessment.credit_score} category={assessment.risk_category} />
        <Tile
          title="What-if"
          score={result?.credit_score}
          category={result?.risk_category}
          pending={!result}
          change={result ? result.credit_score - assessment.credit_score : null}
          stale={calculating || !!error || !!inputError}
        />
      </div>

      {fresh && onlyCollateral && (
        <p role="status" style={{ margin: 0, fontWeight: 600 }}>
          {result.credit_score === assessment.credit_score
            ? <>Changing collateral kept the score at <span className="num">{result.credit_score}</span>. </>
            : <>The score is <span className="num">{result.credit_score}</span>. </>}
          {result.recommended_limit === assessment.recommended_limit
            ? <>The recommended limit stays at <span className="num">{kes(result.recommended_limit)}</span>.</>
            : <>The recommended limit moves from <span className="num">{kes(assessment.recommended_limit)}</span> to <span className="num">{kes(result.recommended_limit)}</span>.</>}
        </p>
      )}

      {result && (
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "var(--space-5)", margin: 0, opacity: calculating ? 0.6 : 1 }}>
          <div>
            <dt style={muted}>Original recommended limit</dt>
            <dd className="num" style={{ margin: "var(--space-1) 0 0", fontWeight: 600, fontSize: "var(--text-lg)" }}>{kes(assessment.recommended_limit)}</dd>
          </div>
          <div>
            <dt style={muted}>What-if recommended limit</dt>
            <dd className="num" style={{ margin: "var(--space-1) 0 0", fontWeight: 600, fontSize: "var(--text-lg)" }}>{kes(result.recommended_limit)}</dd>
            {result.limit_explanation && <dd style={{ ...muted, margin: "2px 0 0" }}>{result.limit_explanation}</dd>}
          </div>
          <div>
            <dt style={muted}>What-if monthly repayment</dt>
            <dd className="num" style={{ margin: "var(--space-1) 0 0", fontWeight: 600, fontSize: "var(--text-lg)" }}>{kes(result.monthly_repayment_estimate)}</dd>
            <dd style={{ ...muted, margin: "2px 0 0" }}>Flat estimate, excluding interest</dd>
          </div>
        </dl>
      )}

      {result && <OutOfRangeNotice notes={result.out_of_range} />}
    </div>
  );
}

function Tile({ title, score, category, pending = false, change = null, stale = false }) {
  const key = riskKeyFromCategory(category || "");
  return (
    <div style={{ border: "1px solid var(--line-strong)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", background: "var(--surface)", minWidth: 0, opacity: stale ? 0.6 : 1 }}>
      <p style={{ ...muted, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</p>
      {pending ? (
        <p style={{ margin: "var(--space-3) 0 0", color: "var(--ink-2)" }}>Calculating…</p>
      ) : (
        <>
          <p style={{ margin: "var(--space-2) 0 0", display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 600 }}>{score}</span>
            <span style={{ color: "var(--ink-2)" }}>out of 850</span>
          </p>
          {category && (
            <span style={{
              display: "inline-block", marginTop: "var(--space-2)", padding: "var(--space-1) var(--space-3)", borderRadius: 999, fontWeight: 600, fontSize: "var(--text-sm)",
              background: key ? `var(--risk-${key}-soft)` : "var(--paper)", color: key ? `var(--risk-${key})` : "var(--ink)",
            }}>
              {category}
            </span>
          )}
          {change != null && <Change value={change} />}
        </>
      )}
    </div>
  );
}

// Direction is always stated in words; colour only reinforces it.
function Change({ value }) {
  if (value === 0) {
    return <p style={{ margin: "var(--space-3) 0 0", fontWeight: 600, color: "var(--ink-2)" }}>No change from the original</p>;
  }
  const better = value > 0;
  return (
    <p style={{ margin: "var(--space-3) 0 0", fontWeight: 600, color: better ? "var(--risk-low)" : "var(--risk-high)" }}>
      <span className="num">{better ? "+" : "−"}{Math.abs(value)} points</span>, {better ? "higher (better) than" : "lower (worse) than"} the original
    </p>
  );
}
