import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import RiskScale from "../components/RiskScale";
import StatusPill from "../components/StatusPill";
import ShapChart from "../components/ShapChart";
import AffordabilityPanel from "../components/AffordabilityPanel";
import OutOfRangeNotice from "../components/OutOfRangeNotice";
import ImprovementTips from "../components/ImprovementTips";
import WhatIfPanel from "../components/WhatIfPanel";
import LegacyTag from "../components/LegacyTag";
import DecisionLetterButton from "../components/DecisionLetterButton";
import ValidityBadge from "../components/ValidityBadge";
import SalesSourceBadge from "../components/SalesSourceBadge";
import { validityProps } from "../lib/validity";
import { fetchMyAssessments, getCurrentUser, requestReview } from "../lib/api";
import { t, shortDate } from "../lib/i18n";

const kes = (n) => (n == null || n === "" ? "Not recorded" : `KES ${Number(n).toLocaleString("en-KE")}`);

export default function AssessmentResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const snapshot = location.state?.assessment;
  const [user, setUser] = useState(null);
  // The owner's assessments, fetched fresh: the report arrives as a navigation snapshot (kept across
  // reloads), so its validity may be out of date, and the newest assessment of the business is needed
  // for "View latest assessment".
  const [mine, setMine] = useState(null);
  // This assessment as returned by request-review, once the owner has asked for a review here.
  const [requested, setRequested] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {});
    fetchMyAssessments().then((list) => setMine(Array.isArray(list) ? list : [])).catch(() => setMine([]));
  }, []);

  const fresh = requested || (snapshot && mine ? mine.find((a) => a.pk === snapshot.pk) : null);
  const assessment = snapshot && fresh
    ? {
        ...snapshot,
        ...Object.fromEntries(FRESH_FIELDS.filter((k) => k in fresh).map((k) => [k, fresh[k]])),
      }
    : snapshot;

  if (!assessment) {
    return (
      <AppShell user={user}>
        <header className="page-head">
          <h1>No report selected</h1>
          <p>Open a report from your assessment history.</p>
        </header>
        <section className="panel">
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/assessments")}>
            Go to history
          </button>
        </section>
      </AppShell>
    );
  }

  const outOfRange = assessment.out_of_range || [];
  const validity = assessment.validity_status;
  const invalid = validity === "expired" || validity === "superseded";
  // Newest assessment of the same business (the list is newest first).
  const latest = validity === "superseded" && assessment.business_id != null && mine
    ? mine.find((a) => a.business_id === assessment.business_id && a.pk !== assessment.pk) || null
    : null;
  const watermark = validity === "expired" ? t("validity.watermarkExpired")
    : validity === "superseded" ? t("validity.watermarkSuperseded") : null;

  return (
    <AppShell user={user}>
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div>
          <h1>{assessment.business_name || "Assessment report"}</h1>
          <p><span className="num">{assessment.id}</span> · {assessment.created_at || "Recent"}</p>
        </div>
        <div className="no-print" style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print report</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/assessments")}>Back to history</button>
        </div>
      </header>

      {/* Printed report: the same diagonal watermark as the PDF letter, on every page (print only). */}
      {watermark && <div className="print-watermark" aria-hidden="true">{watermark}</div>}

      {invalid && (
        <section className="panel validity-banner" role="status" aria-labelledby="validity-heading">
          <div>
            <h2 id="validity-heading" style={{ margin: 0, fontSize: "var(--text-lg)" }}>{t("validity.banner")}</h2>
            <p style={{ margin: "var(--space-1) 0 0", color: "var(--ink-2)" }}>
              {t(validity === "expired" ? "validity.noteExpired" : "validity.noteSuperseded")}
            </p>
          </div>
          <div className="no-print">
            {latest ? (
              <button type="button" className="btn btn-primary" onClick={() => navigate("/assessment/results", { state: { assessment: latest } })}>
                {t("validity.viewLatest")}
              </button>
            ) : (
              <button type="button" className="btn btn-primary"
                onClick={() => navigate(assessment.business_id != null ? `/assessment/new?business=${assessment.business_id}` : "/assessment/new")}>
                {t("validity.reassess")}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="split">
        <section className="panel" aria-labelledby="score-heading">
          <div className="panel-head">
            <h2 id="score-heading">Credit score</h2>
            <ValidityBadge {...validityProps(assessment)} />
          </div>
          <RiskScale score={assessment.credit_score} riskCategory={assessment.risk_category} isLegacy={assessment.is_legacy} modelVersion={assessment.model_version} />
          {assessment.valid_until && (
            <p style={{ margin: "var(--space-4) 0 0", fontWeight: 600 }}>
              {t("validity.validUntil", { date: shortDate(assessment.valid_until) })}
            </p>
          )}
          <p style={{ margin: "var(--space-3) 0 0" }}>
            <SalesSourceBadge source={assessment.revenue_source} statement={assessment.till_statement} />
          </p>
          <p style={{ margin: "var(--space-3) 0 0", color: "var(--ink-2)" }}>
            A credit analyst reviews every application before a final decision.
          </p>
          <OutOfRangeNotice notes={outOfRange} />
        </section>

        <section className="panel" aria-labelledby="afford-heading">
          <div className="panel-head"><h2 id="afford-heading">Loan affordability</h2></div>
          <AffordabilityPanel assessment={assessment} />
        </section>
      </div>

      <div className="split">
        <section className="panel" aria-labelledby="review-heading">
          <div className="panel-head"><h2 id="review-heading">Analyst review</h2></div>
          <p style={{ margin: "0 0 var(--space-3)" }}>
            <StatusPill status={assessment.review_status || "pending"} />
          </p>
          {assessment.review_note ? (
            <p style={{ margin: 0 }}>
              <strong>Note from {assessment.reviewed_by || "the analyst"}:</strong> {assessment.review_note}
            </p>
          ) : (
            <p style={{ margin: 0, color: "var(--ink-2)" }}>
              {(assessment.review_status || "pending") === "pending"
                ? "A credit analyst has not reviewed this result yet. The score is a model estimate, not a loan decision."
                : "No note was left with this decision."}
            </p>
          )}
          {assessment.review_status && assessment.review_status !== "pending" && (
            <div className="no-print" style={{ marginTop: "var(--space-4)" }}>
              <DecisionLetterButton pk={assessment.pk} status={assessment.review_status} />
            </div>
          )}
          <HumanReview assessment={assessment} onRequested={setRequested} />
        </section>

        <section className="panel" aria-labelledby="facts-heading">
          <div className="panel-head"><h2 id="facts-heading">Business details</h2></div>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--space-6)",
              margin: 0,
            }}
          >
            <Fact label="Sector" value={assessment.sector || "Not recorded"} />
            <Fact label="County" value={assessment.county || "Not recorded"} />
            <Fact label="Monthly revenue" value={kes(assessment.monthly_revenue)} />
            {assessment.monthly_expenses != null && <Fact label="Monthly business costs" value={kes(assessment.monthly_expenses)} />}
            <Fact label="Model version" value={<>{assessment.model_version || "Not recorded"}<LegacyTag record={assessment} /></>} />
          </dl>
        </section>
      </div>

      <section className="panel" aria-labelledby="factors-heading">
        <div className="panel-head"><h2 id="factors-heading">What shaped this result</h2></div>
        <ShapChart values={assessment.shap_values} legacyExplanation={assessment.explanation || []} learnLinks />
      </section>

      {/* Tips and the what-if use the current model; an earlier model's stored score is not comparable. */}
      {assessment.is_current_model === false || assessment.is_legacy || !assessment.shap_values?.length ? (
        <p className="no-print" style={{ color: "var(--ink-2)", margin: 0 }}>
          The what-if tool is available for assessments made with the current model.
        </p>
      ) : (
        <>
          <section className="panel" aria-labelledby="improve-heading">
            <div className="panel-head"><h2 id="improve-heading">What would improve this score</h2></div>
            <ImprovementTips values={assessment.shap_values} />
          </section>

          <div className="no-print" style={{ display: "grid", gap: "var(--space-3)" }}>
            <section className="panel" aria-labelledby="whatif-heading">
              <div className="panel-head"><h2 id="whatif-heading">Try a what-if</h2></div>
              <WhatIfPanel assessment={assessment} />
            </section>
            <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", margin: 0 }}>
              This is a simulation. Nothing is saved, and it does not change your assessment or its review.
            </p>
          </div>
        </>
      )}

      <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", margin: 0 }}>
        This assessment supports credit evaluation. It does not approve or issue a loan.
      </p>
    </AppShell>
  );
}

// Fields taken from the freshly loaded copy: validity and the review state can change after the snapshot.
const FRESH_FIELDS = [
  "validity_status", "valid_until", "days_remaining", "review_status", "review_note", "reviewed_by", "reviewed_at",
  "review_requested_at", "review_request_reason", "review_resolved",
];
const REASON_MAX = 500;

// Data Protection Act s.35: the owner can ask for a credit analyst to look at the result again.
function HumanReview({ assessment, onRequested }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = assessment.review_requested_at && !assessment.review_resolved;

  async function send(e) {
    e.preventDefault();
    const text = reason.trim();
    if (!text) {
      setError("Tell us briefly why you would like a review.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onRequested(await requestReview(assessment.pk, text));
      setOpen(false);
      setReason("");
    } catch (err) {
      setError(err.fields?.reason || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print" style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line)" }}>
      {pending ? (
        <p role="status" style={{ margin: 0, fontWeight: 600 }}>Review requested on {shortDate(assessment.review_requested_at)}</p>
      ) : (
        <>
          {assessment.review_resolved && (
            <p style={{ margin: "0 0 var(--space-3)", fontWeight: 600 }}>
              Reviewed by an analyst on {shortDate(assessment.reviewed_at)}
            </p>
          )}
          {!open ? (
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Request a review</button>
          ) : (
            <form onSubmit={send} style={{ display: "grid", gap: "var(--space-2)" }}>
              <label htmlFor="review-reason" style={{ fontWeight: 600 }}>Why would you like a review?</label>
              <textarea
                id="review-reason"
                value={reason}
                maxLength={REASON_MAX}
                rows={4}
                required
                aria-invalid={!!error}
                aria-describedby="review-reason-hint"
                onChange={(e) => { setReason(e.target.value); setError(""); }}
                style={{ font: "inherit", padding: "var(--space-3)", width: "100%", background: "var(--surface)", color: "var(--ink)" }}
              />
              <p id="review-reason-hint" style={{ margin: 0, color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
                For example, a figure that is wrong or something the score did not take into account. {reason.length}/{REASON_MAX}
              </p>
              {error && <p role="alert" style={{ margin: 0, color: "var(--risk-high)" }}>{error}</p>}
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{label}</dt>
      <dd className="num" style={{ margin: "var(--space-1) 0 0", fontWeight: 600 }}>
        {value}
      </dd>
    </div>
  );
}
