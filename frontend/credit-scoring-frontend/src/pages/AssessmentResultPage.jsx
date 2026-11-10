import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import RiskScale from "../components/RiskScale";
import StatusPill from "../components/StatusPill";
import ShapChart from "../components/ShapChart";
import AffordabilityPanel from "../components/AffordabilityPanel";
import { getCurrentUser } from "../lib/api";

const kes = (n) => (n == null || n === "" ? "Not recorded" : `KES ${Number(n).toLocaleString("en-KE")}`);

export default function AssessmentResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const assessment = location.state?.assessment;
  const [user, setUser] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {});
  }, []);

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

      <div className="split">
        <section className="panel" aria-labelledby="score-heading">
          <div className="panel-head"><h2 id="score-heading">Credit score</h2></div>
          <RiskScale score={assessment.credit_score} riskCategory={assessment.risk_category} isLegacy={assessment.is_legacy} modelVersion={assessment.model_version} />
          {outOfRange.length > 0 && (
            <div role="note" style={{ marginTop: "var(--space-5)", padding: "var(--space-4)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                Some answers are outside the range the model was trained on, so treat this score with extra caution.
              </p>
              <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.2em", color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
                {outOfRange.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          )}
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
            <Fact label="Model version" value={assessment.model_version || "Not recorded"} />
          </dl>
        </section>
      </div>

      <section className="panel" aria-labelledby="factors-heading">
        <div className="panel-head"><h2 id="factors-heading">What shaped this result</h2></div>
        <ShapChart values={assessment.shap_values} legacyExplanation={assessment.explanation || []} />
      </section>

      <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", margin: 0 }}>
        This assessment supports credit evaluation. It does not approve or issue a loan.
      </p>
    </AppShell>
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
