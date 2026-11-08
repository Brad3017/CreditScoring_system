import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { ChartCard, BarList, Columns, Split, Empty } from "../../components/charts";
import { card, muted, inputStyle } from "../../components/analystUi";
import { fetchMe, fetchAdminOverview, downloadAssessmentsCsv } from "../../lib/api";

function Kpi({ label, value, hint }) {
  return (
    <div style={{ ...card, padding: "var(--space-5)" }}>
      <div style={muted}>{label}</div>
      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", lineHeight: 1.1, marginTop: "var(--space-2)" }}>
        {value}
      </div>
      {hint && <div style={{ ...muted, marginTop: "var(--space-1)" }}>{hint}</div>}
    </div>
  );
}

export default function AdminOverview() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchMe().then(setUser).catch(() => {}); }, []);

  useEffect(() => {
    setError("");
    fetchAdminOverview({ date_from: from, date_to: to })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [from, to]);

  async function exportCsv() {
    setBusy(true);
    try { await downloadAssessmentsCsv({ date_from: from, date_to: to }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const d = data;
  const hasData = d && d.total > 0;
  const pct = (v) => (v == null ? "–" : `${v}%`);

  return (
    <AdminLayout
      title="Overview"
      subtitle="What the system has scored, and how reviews are going."
      user={user}
      actions={
        <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={busy || !hasData}>
          {busy ? "Preparing…" : "Export CSV"}
        </button>
      }
    >
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}

      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={muted}>From</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={muted}>To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </label>
        {(from || to) && (
          <button type="button" className="btn btn-secondary" onClick={() => { setFrom(""); setTo(""); }}>Clear dates</button>
        )}
      </div>

      {!d && !error && <p style={{ color: "var(--ink-2)" }}>Loading…</p>}

      {d && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "var(--space-6)" }}>
            <Kpi label="Assessments" value={d.total} hint={from || to ? "In the selected period" : "All time"} />
            <Kpi label="Average score" value={d.avg_score ?? "–"} hint="Scale 300 to 850" />
            <Kpi label="High-risk share" value={pct(d.high_risk_rate)} hint="Of assessments scored" />
            <Kpi label="Awaiting review" value={d.awaiting_review} hint="Not yet decided by an analyst" />
          </div>

          {!hasData ? (
            <section style={card}><Empty>No assessments in this period yet.</Empty></section>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--space-6)" }}>
                <ChartCard
                  title="Risk categories"
                  subtitle="How the model sorted applicants"
                  table={{ head: ["Category", "Count"], rows: Object.entries(d.risk).map(([k, v]) => [k, v]) }}
                >
                  <Split parts={[
                    { label: "Low risk", value: d.risk["Low Risk"], color: "var(--risk-low)" },
                    { label: "Moderate", value: d.risk["Moderate Risk"], color: "var(--risk-moderate)" },
                    { label: "High risk", value: d.risk["High Risk"], color: "var(--risk-high)" },
                  ]} />
                </ChartCard>

                <ChartCard
                  title="Analyst decisions"
                  subtitle="Where each assessment stands"
                  table={{ head: ["Status", "Count"], rows: Object.entries(d.review).map(([k, v]) => [k, v]) }}
                >
                  <Split parts={[
                    { label: "Pending", value: d.review.pending, color: "var(--ink-2)" },
                    { label: "Approved", value: d.review.approved, color: "var(--risk-low)" },
                    { label: "Needs info", value: d.review.referred, color: "var(--risk-moderate)" },
                    { label: "Declined", value: d.review.declined, color: "var(--risk-high)" },
                  ]} />
                </ChartCard>
              </div>

              <ChartCard
                title="Score distribution"
                subtitle="Number of assessments in each 50-point band"
                table={{ head: ["Score band", "Count"], rows: d.score_bins.map((b) => [`${b.from}–${b.to}`, b.count]) }}
              >
                <Columns data={d.score_bins.map((b) => ({ label: String(b.from), value: b.count }))} />
              </ChartCard>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--space-6)" }}>
                <ChartCard
                  title="Assessments by sector"
                  table={{ head: ["Sector", "Count", "Average score"], rows: d.sectors.map((s) => [s.name, s.count, s.avg_score]) }}
                >
                  <BarList rows={d.sectors.map((s) => ({ label: s.name, value: s.count }))} />
                </ChartCard>
                <ChartCard
                  title="Assessments by county"
                  subtitle="Ten busiest counties"
                  table={{ head: ["County", "Count", "Average score"], rows: d.counties.map((s) => [s.name, s.count, s.avg_score]) }}
                >
                  <BarList rows={d.counties.map((s) => ({ label: s.name, value: s.count }))} />
                </ChartCard>
              </div>

              <ChartCard
                title="Assessments per month"
                table={{ head: ["Month", "Count"], rows: d.monthly.map((m) => [m.month, m.count]) }}
              >
                <Columns data={d.monthly.map((m) => ({ label: m.month.slice(2), value: m.count }))} />
              </ChartCard>
            </>
          )}

          <section style={card}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>Accounts</h2>
            <p style={{ margin: "var(--space-2) 0 0", color: "var(--ink-2)" }}>
              <span className="num">{d.users.owner}</span> MSME owners · <span className="num">{d.users.analyst}</span> credit analysts · <span className="num">{d.users.admin}</span> administrators
            </p>
          </section>
        </>
      )}
    </AdminLayout>
  );
}
