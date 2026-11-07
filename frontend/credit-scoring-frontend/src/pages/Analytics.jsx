import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import RiskScale, { riskKeyFromCategory } from "../components/RiskScale";
import { fetchMe, fetchMyAssessments } from "../lib/api";

const kes = (n) => (n == null || Number.isNaN(n) ? "Not recorded" : `KES ${Math.round(n).toLocaleString("en-KE")}`);

const BANDS = [
  { key: "low", label: "Low risk", token: "--risk-low" },
  { key: "moderate", label: "Moderate risk", token: "--risk-moderate" },
  { key: "high", label: "High risk", token: "--risk-high" },
];

function parseFactor(text = "") {
  const m = text.match(/^(Positive|Caution):\s*(.*)$/i);
  if (!m) return { reduces: null, text };
  return { reduces: m[1].toLowerCase() === "positive", text: m[2] };
}

export default function Analytics() {
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
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
        if (!cancelled) setError("We could not load your analytics. Refresh the page to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // The API returns newest first. Charts read left to right, oldest to newest.
  const chronological = useMemo(() => [...assessments].reverse(), [assessments]);
  const latest = assessments[0] || null;

  const revenues = assessments.map((a) => Number(a.monthly_revenue)).filter((n) => Number.isFinite(n) && n > 0);
  const avgRevenue = revenues.length ? revenues.reduce((s, n) => s + n, 0) / revenues.length : null;

  const counts = useMemo(() => {
    const c = { low: 0, moderate: 0, high: 0 };
    assessments.forEach((a) => {
      const k = riskKeyFromCategory(a.risk_category);
      if (k) c[k] += 1;
    });
    return c;
  }, [assessments]);

  const scored = assessments.filter((a) => typeof a.credit_score === "number");

  return (
    <AppShell user={user}>
      <h1 style={{ fontSize: "var(--text-2xl)" }}>Analytics</h1>
      <p style={{ color: "var(--ink-2)", margin: "var(--space-2) 0 var(--space-8)" }}>
        How your assessments have changed over time.
      </p>

      {loading && <p style={{ color: "var(--ink-2)" }}>Loading…</p>}
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}

      {!loading && !error && assessments.length === 0 && (
        <p>Analytics appear after your first assessment.</p>
      )}

      {!loading && assessments.length > 0 && (
        <>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-6)", margin: 0 }}>
            <Fact label="Assessments" value={assessments.length} />
            <Fact label="Average monthly revenue" value={kes(avgRevenue)} />
            <Fact label="Latest recommended limit" value={kes(Number(latest?.recommended_limit))} />
          </dl>

          <hr className="rule" />

          <section aria-labelledby="trend-heading">
            <h2 id="trend-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>Credit score over time</h2>
            <p style={{ color: "var(--ink-2)", marginBottom: "var(--space-4)" }}>
              Each point is one assessment, from oldest to newest. The scale runs from 300 to 850.
            </p>
            {scored.length > 1 ? (
              <ScoreLine points={chronological.filter((a) => typeof a.credit_score === "number").map((a) => a.credit_score)} />
            ) : (
              <p style={{ color: "var(--ink-2)" }}>Run a second assessment to see a trend.</p>
            )}
            {latest && (
              <div style={{ marginTop: "var(--space-6)" }}>
                <RiskScale score={latest.credit_score} riskCategory={latest.risk_category} />
              </div>
            )}
          </section>

          <hr className="rule" />

          <section aria-labelledby="mix-heading">
            <h2 id="mix-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Risk bands</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--space-3)" }}>
              {BANDS.map((b) => {
                const n = counts[b.key];
                const pct = assessments.length ? (n / assessments.length) * 100 : 0;
                return (
                  <li key={b.key} style={{ display: "grid", gridTemplateColumns: "140px 1fr 48px", gap: "var(--space-3)", alignItems: "center" }}>
                    <span>{b.label}</span>
                    <span style={{ height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden" }} aria-hidden="true">
                      <span style={{ display: "block", height: "100%", width: `${pct}%`, background: `var(${b.token})` }} />
                    </span>
                    <span className="num" style={{ textAlign: "right" }}>{n}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <hr className="rule" />

          <section aria-labelledby="revenue-heading">
            <h2 id="revenue-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Revenue reported</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {chronological.map((a, i) => (
                <li key={a.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <span>{a.created_at || "Recent"}</span>
                  <span className="num">{kes(Number(a.monthly_revenue))}</span>
                </li>
              ))}
            </ul>
          </section>

          {latest?.explanation?.length > 0 && (
            <>
              <hr className="rule" />
              <section aria-labelledby="factors-heading">
                <h2 id="factors-heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Factors in your latest result</h2>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {latest.explanation.map((item, i) => {
                    const f = parseFactor(item);
                    return (
                      <li key={i} style={{ padding: "var(--space-3) 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                        {f.reduces !== null && (
                          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginRight: "var(--space-3)", color: f.reduces ? "var(--risk-low)" : "var(--risk-high)" }}>
                            {f.reduces ? "Helped" : "Hurt"}
                          </span>
                        )}
                        {f.text}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

// Plain SVG line through the real scores. Scale is fixed at 300–850 so changes look as large as they are.
function ScoreLine({ points }) {
  const W = 600;
  const H = 160;
  const pad = 12;
  const xStep = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  const y = (s) => pad + (1 - (Math.max(300, Math.min(850, s)) - 300) / 550) * (H - pad * 2);
  const path = points.map((s, i) => `${i === 0 ? "M" : "L"}${pad + i * xStep},${y(s)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Credit scores: ${points.join(", ")}`} style={{ width: "100%", maxWidth: 640, height: "auto" }}>
      <line x1={pad} x2={W - pad} y1={y(700)} y2={y(700)} stroke="var(--line)" strokeDasharray="4 4" />
      <line x1={pad} x2={W - pad} y1={y(500)} y2={y(500)} stroke="var(--line)" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((s, i) => (
        <circle key={i} cx={pad + i * xStep} cy={y(s)} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      ))}
    </svg>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{label}</dt>
      <dd className="num" style={{ margin: "var(--space-1) 0 0", fontWeight: 600, fontSize: "var(--text-lg)" }}>{value}</dd>
    </div>
  );
}
