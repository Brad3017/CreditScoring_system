import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import StatusPill from "../components/StatusPill";
import { Columns } from "../components/charts";
import { riskKeyFromCategory } from "../components/RiskScale";
import { fetchMe, fetchMyAssessments } from "../lib/api";

const kes = (n) => (n == null || Number.isNaN(n) ? "Not recorded" : `KES ${Math.round(n).toLocaleString("en-KE")}`);
const RISK_LABEL = { low: "Low risk", moderate: "Moderate risk", high: "High risk" };
const RISK_TOKEN = { low: "--risk-low", moderate: "--risk-moderate", high: "--risk-high" };
const shortDate = (s = "") => s.split(",")[0] || s;

// "Caution: Days Payable Outstanding elevated ..." -> { name, helped }
function parseFactor(text = "") {
  const s = String(text);
  const caution = s.match(/^Caution:\s*(.+?)\s+elevated/i);
  if (caution) return { name: caution[1], helped: false };
  const positive = s.match(/^Positive:\s*Strong\s+(.+?)\s+(?:supported|contributed)/i);
  if (positive) return { name: positive[1], helped: true };
  return null;
}

function Stat({ label, children, hint }) {
  return (
    <div className="panel" style={{ padding: "var(--space-5)" }}>
      <div style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{label}</div>
      <div style={{ marginTop: "var(--space-2)" }}>{children}</div>
      {hint && <div style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{hint}</div>}
    </div>
  );
}

const big = { fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", lineHeight: 1.1 };

// Line chart of score per assessment, drawn over the three risk bands.
function ScoreTrend({ points }) {
  const W = 640, H = 250, L = 44, R = 20, T = 16, B = 34;
  const y = (v) => T + ((850 - v) / 550) * (H - T - B);
  const x = (i) => (points.length === 1 ? (L + W - R) / 2 : L + (i / (points.length - 1)) * (W - L - R));
  const bands = [
    { from: 700, to: 850, fill: "var(--risk-low-soft)" },
    { from: 500, to: 700, fill: "var(--risk-moderate-soft)" },
    { from: 300, to: 500, fill: "var(--risk-high-soft)" },
  ];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score)}`).join(" ");
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`Credit score for each assessment: ${points.map((p) => `${p.label} ${p.score}`).join(", ")}`}
      style={{ display: "block", maxHeight: 300 }}>
      {bands.map((b) => (
        <rect key={b.from} x={L} y={y(b.to)} width={W - L - R} height={y(b.from) - y(b.to)} fill={b.fill} opacity="0.7" />
      ))}
      {[300, 500, 700, 850].map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line-strong)" strokeWidth="1" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-2)">{t}</text>
        </g>
      ))}
      {points.length > 1 && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.score)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2">
            <title>{`${p.label}: ${p.score}`}</title>
          </circle>
          {i === points.length - 1 && (
            <text x={x(i)} y={y(p.score) - 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink)">{p.score}</text>
          )}
          {(i % labelEvery === 0 || i === points.length - 1) && (
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--ink-2)">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, list] = await Promise.all([fetchMe(), fetchMyAssessments()]);
        if (cancelled) return;
        setUser(me);
        setAssessments(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setError("We could not load your analytics. Refresh the page to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const chrono = useMemo(() => [...assessments].reverse(), [assessments]);
  const latest = assessments[0] || null;
  const previous = assessments[1] || null;
  const delta = latest && previous ? latest.credit_score - previous.credit_score : null;
  const risk = latest ? riskKeyFromCategory(latest.risk_category) : null;

  const points = chrono.map((a) => ({ id: a.id, score: a.credit_score, label: shortDate(a.created_at) }));

  // How often each factor held the score back or helped, across all assessments.
  const factors = useMemo(() => {
    const map = new Map();
    assessments.forEach((a) => {
      (a.explanation || []).forEach((t) => {
        const f = parseFactor(t);
        if (!f) return;
        const row = map.get(f.name) || { name: f.name, hurt: 0, helped: 0 };
        f.helped ? row.helped++ : row.hurt++;
        map.set(f.name, row);
      });
    });
    return [...map.values()].sort((a, b) => b.hurt - a.hurt || b.helped - a.helped);
  }, [assessments]);

  const revenueCols = chrono.map((a) => ({ label: shortDate(a.created_at), value: Math.round(Number(a.monthly_revenue) || 0) }));

  return (
    <AppShell user={user}>
      <div className="stack">
        <header>
          <h1 style={{ fontSize: "var(--text-2xl)" }}>Your credit picture</h1>
          <p style={{ color: "var(--ink-2)", margin: "var(--space-2) 0 0" }}>
            How your score has moved, and what keeps shaping it.
          </p>
        </header>

        {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}
        {loading && <p style={{ color: "var(--ink-2)" }}>Loading your analytics…</p>}

        {!loading && !error && !latest && (
          <section className="panel">
            <h2 className="panel-title">No assessments yet</h2>
            <p style={{ color: "var(--ink-2)", marginTop: 0 }}>
              Once you run an assessment, your score history and the factors behind it appear here.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/assessment/new")}>Start an assessment</button>
          </section>
        )}

        {latest && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "var(--space-6)" }}>
              <Stat
                label="Latest score"
                hint={delta == null ? "First assessment" : delta === 0 ? "No change since the last one" : `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} since the last one`}
              >
                <span className="num" style={big}>{latest.credit_score}</span>
                <span style={{ color: "var(--ink-2)" }}> / 850</span>
              </Stat>
              <Stat label="Risk category" hint={`${assessments.length} assessment${assessments.length === 1 ? "" : "s"} in total`}>
                <span style={{ ...big, color: risk ? `var(${RISK_TOKEN[risk]})` : "inherit" }}>{risk ? RISK_LABEL[risk] : "–"}</span>
              </Stat>
              <Stat label="Recommended limit" hint={Number(latest.recommended_limit) ? "From your latest assessment" : "None recommended for the latest result"}>
                <span className="num" style={big}>{Number(latest.recommended_limit) ? kes(latest.recommended_limit) : "None"}</span>
              </Stat>
              <Stat label="Analyst review" hint="Latest assessment">
                <StatusPill status={latest.review_status || "pending"} />
              </Stat>
            </div>

            <div className="split">
              <section className="panel" aria-labelledby="trend-heading">
                <h2 id="trend-heading" className="panel-title">Score over time</h2>
                <ScoreTrend points={points} />
                <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", margin: "var(--space-3) 0 0" }}>
                  {points.length < 2
                    ? "Run a second assessment to see a trend. Each point is one assessment."
                    : "Each point is one assessment. Shading shows the high, moderate and low risk bands."}
                </p>
              </section>

              <section className="panel" aria-labelledby="factors-heading">
                <h2 id="factors-heading" className="panel-title">What shapes your score</h2>
                {factors.length === 0 ? (
                  <p style={{ color: "var(--ink-2)", margin: 0 }}>No factor details were recorded yet.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-3)" }}>
                    {factors.slice(0, 6).map((f) => (
                      <li key={f.name} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--line)" }}>
                        <span style={{ fontWeight: 600 }}>{f.name}</span>
                        <span style={{ fontSize: "var(--text-xs)", textAlign: "right" }}>
                          {f.hurt > 0 && <span style={{ color: "var(--risk-high)", fontWeight: 600 }}>Held back {f.hurt} of {assessments.length}</span>}
                          {f.hurt > 0 && f.helped > 0 && <span style={{ color: "var(--ink-2)" }}> · </span>}
                          {f.helped > 0 && <span style={{ color: "var(--risk-low)", fontWeight: 600 }}>Helped {f.helped} of {assessments.length}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", margin: "var(--space-4) 0 0" }}>
                  Counts how often each factor was among the top three influences on a result.
                </p>
              </section>
            </div>

            <section className="panel" aria-labelledby="revenue-heading">
              <h2 id="revenue-heading" className="panel-title">Monthly revenue you reported</h2>
              <Columns data={revenueCols} />
              <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", margin: "var(--space-3) 0 0" }}>
                Revenue as entered on each assessment, in KES.
              </p>
            </section>

            <section className="panel" aria-labelledby="all-heading">
              <h2 id="all-heading" className="panel-title">All assessments</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Date", "Score", "Risk", "Recommended limit", "Review"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "var(--space-3)", fontSize: "var(--text-xs)", color: "var(--ink-2)", borderBottom: "1px solid var(--line-strong)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((a) => {
                      const k = riskKeyFromCategory(a.risk_category);
                      const cell = { padding: "var(--space-3)", borderBottom: "1px solid var(--line)" };
                      return (
                        <tr key={a.id}>
                          <td style={cell}>{a.created_at}</td>
                          <td style={cell} className="num"><strong>{a.credit_score}</strong></td>
                          <td style={{ ...cell, color: k ? `var(${RISK_TOKEN[k]})` : "inherit", fontWeight: 600 }}>{k ? RISK_LABEL[k] : "–"}</td>
                          <td style={cell} className="num">{Number(a.recommended_limit) ? kes(a.recommended_limit) : "None"}</td>
                          <td style={cell}><StatusPill status={a.review_status || "pending"} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
