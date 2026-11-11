import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import LoadError from "../components/LoadError";
import RiskScale, { riskKeyFromCategory } from "../components/RiskScale";
import LegacyTag from "../components/LegacyTag";
import { getCurrentUser, fetchMyAssessments } from "../lib/api";

// Formats money, or says plainly that it is missing. Never invents a value.
const kes = (n) => (n == null || n === "" ? "Not recorded" : `KES ${Number(n).toLocaleString("en-KE")}`);

// API explanations look like "Positive: Strong Cashflow Stability contributed favorably…"
function parseFactor(text = "") {
  // v2 sentences: "<Factor> raised|lowered the assessed risk."
  const v2 = text.match(/\b(raised|lowered) the assessed risk\.?$/i);
  if (v2) return { reduces: v2[1].toLowerCase() === "lowered", text };
  const m = text.match(/^(Positive|Caution):\s*(.*)$/i);
  if (!m) return { reduces: null, text };
  return { reduces: m[1].toLowerCase() === "positive", text: m[2] };
}

const STATEMENTS = {
  low: "Low risk. The factors below show what shaped this result.",
  moderate: "Moderate risk. The factors below show what shaped this result.",
  high: "High risk. Results in this band are flagged for analyst review.",
};

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // bumped by Retry to re-run the load

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, list] = await Promise.all([getCurrentUser(), fetchMyAssessments()]);
        if (cancelled) return;
        setUser(me);
        setAssessments(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setError("We could not load your assessments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setError("");
    setLoading(true);
    setAttempt((n) => n + 1);
  }

  const latest = assessments[0] || null;
  const riskKey = riskKeyFromCategory(latest?.risk_category);
  const firstName = user?.full_name?.split(" ")[0];
  const openReport = (assessment) => navigate("/assessment/results", { state: { assessment } });

  const loadingLine = <p style={{ color: "var(--ink-2)", margin: 0 }}>Loading…</p>;

  return (
    <AppShell user={user}>
      <header className="page-head">
        <h1>{firstName ? `Hello, ${firstName}` : "Hello"}</h1>
        <p>
          {loading
            ? "Loading your business overview…"
            : latest ? `${latest.business_name || "Your business"} · last assessed ${latest.created_at || "recently"}` : "Your business overview"}
        </p>
      </header>

      <LoadError message={error} onRetry={retry} busy={loading} />

      {!loading && !latest && !error ? (
        <section className="panel" aria-labelledby="start-heading">
          <div className="panel-head"><h2 id="start-heading">Start with your first assessment</h2></div>
          <p style={{ color: "var(--ink-2)", margin: "0 0 var(--space-6)", maxWidth: "60ch" }}>
            It takes about five minutes and asks about your business, finances and borrowing history. You will see your score and the factors behind it straight away.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/assessment/new")}>
            Start an assessment
          </button>
        </section>
      ) : (loading || latest) ? (
        <>
          <div className="split">
            <section className="panel" aria-labelledby="latest-heading">
              <div className="panel-head">
                <h2 id="latest-heading">Latest credit score</h2>
                {latest && (
                  <button type="button" className="btn btn-secondary" onClick={() => openReport(latest)}>
                    View full report
                  </button>
                )}
              </div>
              {loading ? loadingLine : (
                <>
                  <RiskScale score={latest.credit_score} riskCategory={latest.risk_category} isLegacy={latest.is_legacy} modelVersion={latest.model_version} />
                  {riskKey && (
                    <p style={{ margin: "var(--space-6) 0 0", maxWidth: "52ch" }}>{STATEMENTS[riskKey]}</p>
                  )}
                </>
              )}
            </section>

            <section className="panel" aria-labelledby="facts-heading">
              <div className="panel-head"><h2 id="facts-heading">Business at a glance</h2></div>
              {loading ? loadingLine : (
                <dl className="stat-grid" style={{ margin: 0, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <Fact label="Monthly revenue" value={kes(latest.monthly_revenue)} />
                  <Fact label="Recommended limit" value={kes(latest.recommended_limit)} />
                  <Fact label="Sector" value={latest.sector || "Not recorded"} />
                  <Fact label="County" value={latest.county || "Not recorded"} />
                </dl>
              )}
            </section>
          </div>

          <section className="panel" aria-labelledby="factors-heading">
            <div className="panel-head"><h2 id="factors-heading">What shaped this result</h2></div>
            {loading ? loadingLine : latest.explanation?.length ? (
              <ul className="factor-list">
                {latest.explanation.map((item, i) => {
                  const f = parseFactor(item);
                  const color = f.reduces === null ? "var(--ink-2)" : f.reduces ? "var(--risk-low)" : "var(--risk-high)";
                  return (
                    <li key={i} className="factor">
                      <span className="factor-dot" style={{ background: color }} aria-hidden="true" />
                      <span>
                        {f.reduces !== null && (
                          <span className="factor-tag" style={{ color }}>
                            {f.reduces ? "Helped" : "Hurt"}
                          </span>
                        )}
                        {f.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={{ color: "var(--ink-2)", margin: 0 }}>No factor breakdown was recorded for this assessment.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="recent-heading">
            <div className="panel-head">
              <h2 id="recent-heading">Recent assessments</h2>
              <button type="button" className="btn btn-secondary" onClick={() => navigate("/assessments")}>
                All assessments
              </button>
            </div>
            {loading ? loadingLine : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Reference</th><th style={{ textAlign: "right" }}>Score</th><th>Risk</th><th></th></tr>
                  </thead>
                  <tbody>
                    {assessments.slice(0, 3).map((item, i) => {
                      const key = riskKeyFromCategory(item.risk_category);
                      return (
                        <tr key={item.id || i}>
                          <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{item.created_at || "Recent"}</td>
                          <td><span className="num" style={{ color: "var(--ink-2)" }}>{item.id}</span><LegacyTag record={item} /></td>
                          <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{item.credit_score ?? "–"}</td>
                          <td style={{ fontWeight: 600, color: key ? `var(--risk-${key})` : "var(--ink-2)", whiteSpace: "nowrap" }}>{item.risk_category || "–"}</td>
                          <td style={{ textAlign: "right" }}>
                            <button type="button" className="btn btn-secondary" onClick={() => openReport(item)}>View</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function Fact({ label, value }) {
  return (
    <div className="stat">
      <dt style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{label}</dt>
      <dd className="num" style={{ margin: "var(--space-1) 0 0", fontWeight: 600, fontSize: "var(--text-lg)" }}>{value}</dd>
    </div>
  );
}
