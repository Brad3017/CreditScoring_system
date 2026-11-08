import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AnalystLayout from "../components/AnalystLayout";
import StatusPill from "../components/StatusPill";
import { riskKeyFromCategory } from "../components/RiskScale";
import { fetchMe, fetchAllAssessments } from "../lib/api";

// Shared styles, all driven by the design tokens in tokens.css
const card = {
  background: "var(--surface)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-6)",
  boxShadow: "var(--shadow)",
  minWidth: 0,
};

const cardHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-4)",
  paddingBottom: "var(--space-4)",
  marginBottom: "var(--space-5)",
  borderBottom: "1px solid var(--line-strong)",
};

const cardTitle = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-lg)",
  fontWeight: 600,
};

const muted = { color: "var(--ink-2)", fontSize: "var(--text-xs)" };

const grid = (min) => ({
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`,
  gap: "var(--space-6)",
});

const BAND_LABEL = { low: "Low risk", moderate: "Moderate", high: "High risk" };

export default function AnalystDashboard() {
  const navigate = useNavigate();

  const [analyst, setAnalyst] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalystData() {
      setLoading(true);
      try {
        const [me, allData] = await Promise.all([fetchMe(), fetchAllAssessments()]);
        setAnalyst(me);
        setAssessments(Array.isArray(allData) ? allData : []);
      } catch (err) {
        console.error("Analyst dashboard error:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAnalystData();
  }, []);

  // Counts come from real stored assessments only
  const total = assessments.length;

  const counts = useMemo(() => {
    const c = { low: 0, moderate: 0, high: 0 };
    assessments.forEach((a) => {
      const k = riskKeyFromCategory(a.risk_category);
      if (k) c[k] += 1;
    });
    return c;
  }, [assessments]);

  const lowCount = counts.low;
  const medCount = counts.moderate;
  const highCount = counts.high;
  const pendingCount = highCount + medCount;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Donut: arcs laid end to end, starting at 12 o'clock
  const R = 50;
  const C = 2 * Math.PI * R;
  const arcs = useMemo(() => {
    let start = 0;
    return ["high", "moderate", "low"]
      .filter((k) => counts[k] > 0)
      .map((k) => {
        const len = (counts[k] / total) * C;
        const arc = { k, len, start };
        start += len;
        return arc;
      });
  }, [counts, total, C]);

  const chronological = useMemo(() => [...assessments].reverse(), [assessments]);
  const recent = chronological.slice(-6);

  return (
    <AnalystLayout
      title="Credit Analyst Dashboard"
      subtitle="Monitor assessments, analyse risk trends and review MSME credit scores."
      user={analyst}
      actions={
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line-strong)",
            background: "var(--surface)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
          }}
        >
          Active submissions: <span className="num">{total}</span>
        </div>
      }
    >
      {loading ? (
        <p style={{ color: "var(--ink-2)" }}>Loading dashboard…</p>
      ) : total === 0 ? (
        <section style={{ ...card, maxWidth: 560, margin: "var(--space-12) auto", textAlign: "center", padding: "var(--space-12)" }}>
          <h2 style={{ ...cardTitle, fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>
            No assessments yet
          </h2>
          <p style={{ color: "var(--ink-2)", margin: "0 auto var(--space-6)", maxWidth: "44ch" }}>
            When MSME borrowers submit a credit assessment, their scores, risk bands and factors will appear here.
          </p>
          <p style={muted}>Listening for submissions on <code>/api/scoring/assessments/all/</code></p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-8)" }}>
          {/* Row 1: headline numbers */}
          <div style={grid("220px")}>
            <Kpi label="Total assessments" value={total} sub="All registered MSME applicants" />
            <Kpi label="Pending review" value={pendingCount} sub="High and moderate risk cases" color="var(--risk-moderate)" />
            <Kpi label="High-risk" value={highCount} sub={`${pct(highCount)}% of the applicant pool`} color="var(--risk-high)" />
            <Kpi label="Low-risk" value={lowCount} sub="Prime and low-risk applicants" color="var(--risk-low)" />
          </div>

          {/* Row 2: distribution, trend, alerts */}
          <div style={grid("260px")}>
            <section style={card} aria-labelledby="dist-heading">
              <div style={cardHead}>
                <h2 id="dist-heading" style={cardTitle}>Risk distribution</h2>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ position: "relative", width: 150, height: 150, flex: "none" }} role="img"
                  aria-label={`${highCount} high, ${medCount} moderate and ${lowCount} low risk of ${total} assessments`}>
                  <svg viewBox="0 0 120 120" width="150" height="150" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
                    <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="12" />
                    {arcs.map((a) => (
                      <circle
                        key={a.k}
                        cx="60"
                        cy="60"
                        r={R}
                        fill="none"
                        stroke={`var(--risk-${a.k})`}
                        strokeWidth="12"
                        strokeDasharray={`${a.len} ${C - a.len}`}
                        strokeDashoffset={-a.start}
                      />
                    ))}
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                    <div>
                      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", lineHeight: 1 }}>{total}</div>
                      <div style={{ ...muted, fontWeight: 600, letterSpacing: "0.04em" }}>TOTAL</div>
                    </div>
                  </div>
                </div>

                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-3)", minWidth: 150 }}>
                  {["low", "moderate", "high"].map((k) => (
                    <li key={k} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: `var(--risk-${k})` }} />
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{BAND_LABEL[k]}</span>
                      <span className="num" style={{ ...muted, marginLeft: "auto" }}>{counts[k]} ({pct(counts[k])}%)</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section style={card} aria-labelledby="trend-heading">
              <div style={{ ...cardHead, justifyContent: "space-between" }}>
                <h2 id="trend-heading" style={cardTitle}>Score trend</h2>
                <span style={muted}>Latest {recent.length} submissions</span>
              </div>

              {chronological.length > 1 ? (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-3)", height: 180, paddingTop: "var(--space-4)", borderBottom: "1px solid var(--line-strong)" }}>
                    {recent.map((item, idx) => {
                      const score = typeof item.credit_score === "number" ? item.credit_score : 300;
                      const h = Math.max(12, Math.round(((score - 300) / 550) * 100));
                      const key = riskKeyFromCategory(item.risk_category);
                      return (
                        <div key={item.id || idx} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-1)" }}>
                          <span className="num" style={{ fontSize: "var(--text-xs)", fontWeight: 700 }}>{score}</span>
                          <div
                            title={`${score} · ${BAND_LABEL[key] || "Unrated"}`}
                            style={{ width: "100%", maxWidth: 44, height: `${h}%`, borderRadius: "6px 6px 0 0", background: key ? `var(--risk-${key})` : "var(--ink-2)" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                    {recent.map((item, idx) => (
                      <span key={item.id || idx} style={{ ...muted, flex: 1, minWidth: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.created_at || `#${idx + 1}`}
                      </span>
                    ))}
                  </div>
                  <p style={{ ...muted, margin: "var(--space-4) 0 0", textAlign: "center" }}>
                    Bar height shows the score on a 300–850 scale. Colour shows the risk band.
                  </p>
                </>
              ) : (
                <p style={{ ...muted, padding: "var(--space-8) 0", textAlign: "center" }}>
                  Two or more submissions are needed to show a trend.
                </p>
              )}
            </section>

            <section style={card} aria-labelledby="alerts-heading">
              <div style={cardHead}>
                <h2 id="alerts-heading" style={cardTitle}>Risk alerts</h2>
              </div>

              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-4)", fontSize: "var(--text-sm)" }}>
                {highCount > 0 ? (
                  <Alert color="var(--risk-high)">
                    <strong>{highCount} MSME{highCount === 1 ? "" : "s"}</strong> classified as high risk. Manual triage required.
                  </Alert>
                ) : (
                  <Alert color="var(--risk-low)">No high-risk applicants right now.</Alert>
                )}
                {medCount > 0 && (
                  <Alert color="var(--risk-moderate)">
                    <strong>{medCount} applicant{medCount === 1 ? "" : "s"}</strong> in the moderate risk tier.
                  </Alert>
                )}
              </ul>

              <p style={{ ...muted, margin: "var(--space-6) 0 0", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line-strong)" }}>
                High-severity triggers require underwriter approval.
              </p>
            </section>
          </div>

          {/* Row 3: recent requests */}
          <section style={{ ...card, padding: 0, overflow: "hidden" }} aria-labelledby="recent-heading">
            <div style={{ ...cardHead, padding: "var(--space-6) var(--space-6) var(--space-4)", margin: 0 }}>
              <h2 id="recent-heading" style={cardTitle}>Recent assessment requests</h2>
              <span style={muted}>Showing latest {Math.min(5, total)} of {total}</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ background: "var(--paper)", textAlign: "left" }}>
                    {["Business", "Assessment ID", "Submitted", "Score", "Risk", "Status", ""].map((h, i) => (
                      <th key={i} style={{ padding: "var(--space-3) var(--space-6)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-2)", borderBottom: "1px solid var(--line-strong)", textAlign: i === 6 ? "right" : "left", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assessments.slice(0, 5).map((row, idx) => {
                    const key = riskKeyFromCategory(row.risk_category);
                    const isDone = row.review_status && row.review_status !== "pending";
                    const cell = { padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--line)", verticalAlign: "middle" };
                    return (
                      <tr key={row.id || idx}>
                        <td style={{ ...cell, fontWeight: 600 }}>{row.business_name || "MSME enterprise"}</td>
                        <td style={{ ...cell, color: "var(--ink-2)", fontFamily: "monospace", fontSize: "var(--text-xs)" }}>{row.id}</td>
                        <td style={{ ...cell, color: "var(--ink-2)", whiteSpace: "nowrap" }}>{row.created_at || "Recent"}</td>
                        <td style={cell}>
                          <span className="num" style={{ fontWeight: 700 }}>{row.credit_score ?? "–"}</span>
                          <span style={{ ...muted, marginLeft: 4 }}>/ 850</span>
                        </td>
                        <td style={cell}>
                          {key ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", padding: "2px 10px", borderRadius: 999, background: `var(--risk-${key}-soft)`, color: `var(--risk-${key})`, fontSize: "var(--text-xs)", fontWeight: 700 }}>
                              {BAND_LABEL[key]}
                            </span>
                          ) : (
                            <span style={muted}>{row.risk_category || "Unrated"}</span>
                          )}
                        </td>
                        <td style={cell}>
                          <StatusPill status={row.review_status} />
                        </td>
                        <td style={{ ...cell, textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "var(--space-1) var(--space-4)", fontSize: "var(--text-xs)" }}
                            onClick={() => navigate(`/analyst/requests/${row.pk}`)}
                          >
                            {isDone ? "View" : "Review"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AnalystLayout>
  );
}

function Kpi({ label, value, sub, color = "var(--ink)" }) {
  return (
    <section style={card}>
      <p style={{ ...muted, fontWeight: 600, margin: 0 }}>{label}</p>
      <p className="num" style={{ margin: "var(--space-2) 0 var(--space-1)", fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", lineHeight: 1, color }}>
        {value}
      </p>
      <p style={{ ...muted, margin: 0 }}>{sub}</p>
    </section>
  );
}

function Alert({ color, children }) {
  return (
    <li style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: "0.45em", flex: "none" }} />
      <span style={{ lineHeight: 1.45 }}>{children}</span>
    </li>
  );
}
