import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import RiskScale, { riskKeyFromCategory } from "../components/RiskScale";
import { fetchMe, fetchMyAssessments } from "../lib/api";

// Formats money, or says plainly that it is missing. Never invents a value.
const kes = (n) => (n == null || n === "" ? "Not recorded" : `KES ${Number(n).toLocaleString("en-KE")}`);

// API explanations look like "Positive: Strong Cashflow Stability contributed favorably…"
function parseFactor(text = "") {
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, list] = await Promise.all([fetchMe(), fetchMyAssessments()]);
        if (cancelled) return;
        setUser(me);
        setAssessments(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setError("We could not load your assessments. Refresh the page to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = assessments[0] || null;
  const riskKey = riskKeyFromCategory(latest?.risk_category);
  const firstName = user?.full_name?.split(" ")[0];
  const openReport = (assessment) => navigate("/assessment/results", { state: { assessment } });

  if (loading) {
    return (
      <AppShell user={user}>
        <p style={{ color: "var(--ink-2)" }}>Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <header style={{ marginBottom: "var(--space-8)" }}>
        <p style={{ color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>
          {latest ? `${latest.business_name || "Your business"} · last assessed ${latest.created_at || "recently"}` : "Your business overview"}
        </p>
        <h1 style={{ fontSize: "var(--text-2xl)", marginTop: "var(--space-1)" }}>
          {firstName ? `Hello, ${firstName}` : "Hello"}
        </h1>
      </header>

      {error && (
        <p role="alert" style={{ color: "var(--risk-high)", marginBottom: "var(--space-6)" }}>
          {error}
        </p>
      )}

      {!latest && !error ? (
        <section className="card" style={{ maxWidth: 560 }}>
          <h2 className="section-title">Start with your first assessment</h2>
          <p style={{ color: "var(--ink-2)", marginBottom: "var(--space-6)" }}>
            It takes about five minutes and asks about your business, finances and borrowing history. You will see your score and the factors behind it straight away.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/assessment/new")}>
            Start an assessment
          </button>
        </section>
      ) : latest ? (
        <div className="stack">
          <div className="two-col">
            {/* Score card */}
            <section className="card" aria-labelledby="latest-heading">
              <h2 id="latest-heading" style={{ fontSize: "var(--text-base)", fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--ink-2)", marginBottom: "var(--space-5)" }}>
                Latest credit score
              </h2>
              <RiskScale score={latest.credit_score} riskCategory={latest.risk_category} />
              {riskKey && (
                <p style={{ marginTop: "var(--space-8)", fontSize: "var(--text-base)", maxWidth: "52ch" }}>
                  {STATEMENTS[riskKey]}
                </p>
              )}
              <div style={{ marginTop: "var(--space-6)" }}>
                <button type="button" className="btn btn-secondary" onClick={() => openReport(latest)}>
                  View full report
                </button>
              </div>
            </section>

            {/* Business card */}
            <section className="card" aria-labelledby="facts-heading">
              <h2 id="facts-heading" style={{ fontSize: "var(--text-base)", fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--ink-2)", marginBottom: "var(--space-5)" }}>
                Business at a glance
              </h2>
              <dl className="facts">
                <Fact label="Monthly revenue" value={kes(latest.monthly_revenue)} />
                <Fact label="Recommended limit" value={kes(latest.recommended_limit)} />
                <Fact label="Sector" value={latest.sector || "Not recorded"} />
                <Fact label="County" value={latest.county || "Not recorded"} />
              </dl>
            </section>
          </div>

          {/* Factors */}
          <section aria-labelledby="factors-heading">
            <h2 id="factors-heading" className="section-title">What shaped this result</h2>
            {latest.explanation?.length ? (
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
              <p style={{ color: "var(--ink-2)" }}>No factor breakdown was recorded for this assessment.</p>
            )}
          </section>

          {/* Recent */}
          <section aria-labelledby="recent-heading">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-5)", gap: "var(--space-4)", flexWrap: "wrap" }}>
              <h2 id="recent-heading" className="section-title" style={{ margin: 0 }}>Recent assessments</h2>
              <button type="button" className="btn btn-secondary" onClick={() => navigate("/assessments")}>
                All assessments
              </button>
            </div>
            <ul className="factor-list">
              {assessments.slice(0, 3).map((item, i) => {
                const key = riskKeyFromCategory(item.risk_category);
                return (
                  <li key={item.id || i} className="card" style={{ padding: "var(--space-4) var(--space-5)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)", boxShadow: "none" }}>
                    <span>
                      <span style={{ display: "block", fontWeight: 600 }}>{item.created_at || "Recent"}</span>
                      <span className="num" style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{item.id}</span>
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span className="num" style={{ fontWeight: 700, fontSize: "var(--text-lg)" }}>{item.credit_score ?? "–"}</span>
                      {key && (
                        <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: `var(--risk-${key})` }}>
                          {item.risk_category}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
