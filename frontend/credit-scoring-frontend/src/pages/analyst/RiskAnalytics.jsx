import { useState, useEffect, useMemo } from "react";
import AnalystLayout from "../../components/AnalystLayout";
import { ChartCard, BarList, Columns, Split, Empty } from "../../components/charts";
import { getCurrentUser, fetchAllAssessments } from "../../lib/api";

const RISKS = [
  { key: "Low Risk", label: "Low risk", color: "var(--risk-low)" },
  { key: "Moderate Risk", label: "Moderate risk", color: "var(--risk-moderate)" },
  { key: "High Risk", label: "High risk", color: "var(--risk-high)" },
];
const SCORE_BINS = [300, 400, 500, 600, 700, 800]; // last bin is 800–850
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);

function groupBy(rows, key) {
  const out = new Map();
  for (const r of rows) {
    const k = r[key] || "Not recorded";
    const g = out.get(k) || { label: k, total: 0, high: 0, scoreSum: 0 };
    g.total += 1;
    g.scoreSum += r.credit_score || 0;
    if (r.risk_category === "High Risk") g.high += 1;
    out.set(k, g);
  }
  return [...out.values()].sort((a, b) => b.total - a.total);
}

export default function RiskAnalytics() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [me, all] = await Promise.all([getCurrentUser(), fetchAllAssessments()]);
        setUser(me);
        setRows(Array.isArray(all) ? all : []);
      } catch (e) {
        setError(e.message || "Could not load assessments.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = rows.length;

  const risk = useMemo(
    () => RISKS.map((r) => ({ ...r, value: rows.filter((a) => a.risk_category === r.key).length })),
    [rows]
  );

  const scoreDist = useMemo(
    () =>
      SCORE_BINS.map((lo, i) => {
        const hi = SCORE_BINS[i + 1] ?? 851;
        return { label: `${lo}–${Math.min(hi - 1, 850)}`, value: rows.filter((a) => a.credit_score >= lo && a.credit_score < hi).length };
      }),
    [rows]
  );

  const monthly = useMemo(() => {
    const m = new Map();
    for (const a of rows) {
      if (!a.created_at_iso) continue;
      const d = new Date(a.created_at_iso);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const g = m.get(k) || { key: k, label: d.toLocaleString("en-KE", { month: "short", year: "2-digit" }), value: 0, sum: 0 };
      g.value += 1;
      g.sum += a.credit_score || 0;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  }, [rows]);

  const bySector = useMemo(() => groupBy(rows, "sector"), [rows]);
  const byCounty = useMemo(() => groupBy(rows, "county").slice(0, 10), [rows]);
  const avgScore = total ? Math.round(rows.reduce((s, a) => s + (a.credit_score || 0), 0) / total) : 0;
  const reviewed = rows.filter((a) => a.reviewed_at).length;

  return (
    <AnalystLayout title="Risk analytics" subtitle="Risk across every assessment the model has scored." user={user}>
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink-2)" }}>Loading…</p>
      ) : total === 0 ? (
        <ChartCard title="No assessments yet"><Empty>Charts appear once applicants have been scored.</Empty></ChartCard>
      ) : (
        <>
          <ChartCard
            title="Risk mix"
            subtitle={`${total} assessments · average score ${avgScore} · ${reviewed} reviewed (${pct(reviewed, total)}%)`}
            table={{ head: ["Risk band", "Assessments", "Share"], rows: risk.map((r) => [r.label, r.value, `${pct(r.value, total)}%`]) }}
          >
            <Split parts={risk} />
          </ChartCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "var(--space-6)" }}>
            <ChartCard
              title="Score distribution"
              subtitle="Number of assessments in each score band"
              table={{ head: ["Score band", "Assessments"], rows: scoreDist.map((d) => [d.label, d.value]) }}
            >
              <Columns data={scoreDist} />
            </ChartCard>

            <ChartCard
              title="Assessments per month"
              subtitle="Last 12 months with activity"
              table={{ head: ["Month", "Assessments", "Average score"], rows: monthly.map((m) => [m.label, m.value, Math.round(m.sum / m.value)]) }}
            >
              <Columns data={monthly} />
            </ChartCard>

            <ChartCard
              title="High-risk share by sector"
              subtitle="Percentage of each sector's assessments rated high risk"
              table={{ head: ["Sector", "Assessments", "High risk", "Average score"], rows: bySector.map((g) => [g.label, g.total, `${g.high} (${pct(g.high, g.total)}%)`, Math.round(g.scoreSum / g.total)]) }}
            >
              <BarList rows={bySector.map((g) => ({ label: g.label, value: pct(g.high, g.total) }))} format={(v) => `${v}%`} max={100} color="var(--risk-high)" />
            </ChartCard>

            <ChartCard
              title="Assessments by county"
              subtitle={byCounty.length === 10 ? "Ten busiest counties" : "All counties with applicants"}
              table={{ head: ["County", "Assessments", "High risk", "Average score"], rows: byCounty.map((g) => [g.label, g.total, `${g.high} (${pct(g.high, g.total)}%)`, Math.round(g.scoreSum / g.total)]) }}
            >
              <BarList rows={byCounty.map((g) => ({ label: g.label, value: g.total }))} />
            </ChartCard>
          </div>
        </>
      )}
    </AnalystLayout>
  );
}
