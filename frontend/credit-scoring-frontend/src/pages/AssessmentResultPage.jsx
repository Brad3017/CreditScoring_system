import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import RiskScale from "../components/RiskScale";
import { fetchMe } from "../lib/api";

const kes = (n) => (n == null || n === "" ? "Not recorded" : `KES ${Number(n).toLocaleString("en-KE")}`);

function parseFactor(text = "") {
  const m = text.match(/^(Positive|Caution):\s*(.*)$/i);
  if (!m) return { reduces: null, text };
  return { reduces: m[1].toLowerCase() === "positive", text: m[2] };
}

export default function AssessmentResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const assessment = location.state?.assessment;
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchMe().then(setUser).catch(() => {});
  }, []);

  if (!assessment) {
    return (
      <AppShell user={user}>
        <h1 style={{ fontSize: "var(--text-2xl)" }}>No report selected</h1>
        <p style={{ color: "var(--ink-2)", margin: "var(--space-3) 0 var(--space-6)" }}>
          Open a report from your assessment history.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate("/assessments")}>
          Go to history
        </button>
      </AppShell>
    );
  }

  const factors = assessment.explanation || [];

  return (
    <AppShell user={user}>
      <header style={{ marginBottom: "var(--space-8)" }}>
        <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
          <span className="num">{assessment.id}</span> · {assessment.created_at || "Recent"}
        </p>
        <h1 style={{ fontSize: "var(--text-2xl)", marginTop: "var(--space-2)" }}>
          {assessment.business_name || "Assessment report"}
        </h1>
      </header>

      <section aria-labelledby="score-heading">
        <h2 id="score-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          Credit score
        </h2>
        <RiskScale score={assessment.credit_score} riskCategory={assessment.risk_category} />
      </section>

      <hr className="rule" />

      <section aria-labelledby="facts-heading">
        <h2 id="facts-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          Business details
        </h2>
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
          <Fact label="Recommended limit" value={kes(assessment.recommended_limit)} />
        </dl>
      </section>

      <hr className="rule" />

      <section aria-labelledby="factors-heading">
        <h2 id="factors-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>
          What shaped this result
        </h2>
        <p style={{ color: "var(--ink-2)", marginBottom: "var(--space-4)" }}>
          Each factor shows whether it helped or hurt the score. Sizes are not shown because the explanations do not include them.
        </p>
        {factors.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {factors.map((item, i) => {
              const f = parseFactor(item);
              return (
                <li key={i} style={{ padding: "var(--space-3) 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  {f.reduces !== null && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        marginRight: "var(--space-3)",
                        color: f.reduces ? "var(--risk-low)" : "var(--risk-high)",
                      }}
                    >
                      {f.reduces ? "Helped" : "Hurt"}
                    </span>
                  )}
                  {f.text}
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ color: "var(--ink-2)" }}>No factor breakdown was recorded for this assessment.</p>
        )}
      </section>

      <hr className="rule" />

      <footer style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Print report
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => navigate("/assessments")}>
          Back to history
        </button>
        <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", flexBasis: "100%", marginTop: "var(--space-4)" }}>
          This assessment supports credit evaluation. It does not approve or issue a loan.
        </p>
      </footer>
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
