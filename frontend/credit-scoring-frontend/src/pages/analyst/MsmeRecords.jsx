import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AnalystLayout from "../../components/AnalystLayout";
import StatusPill from "../../components/StatusPill";
import { card, muted, inputStyle, th, td, kes } from "../../components/analystUi";
import { fetchMe, fetchAllAssessments } from "../../lib/api";

const RISK_COLOR = { low: "var(--risk-low)", moderate: "var(--risk-moderate)", medium: "var(--risk-moderate)", high: "var(--risk-high)" };
const riskKey = (c = "") => Object.keys(RISK_COLOR).find((k) => c.toLowerCase().includes(k));

function Stat({ label, value }) {
  return (
    <div style={{ ...card, padding: "var(--space-5)" }}>
      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", lineHeight: 1.1, fontWeight: 600 }}>{value}</div>
      <div style={muted}>{label}</div>
    </div>
  );
}

export default function MsmeRecords() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("all");
  const [county, setCounty] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [me, all] = await Promise.all([fetchMe(), fetchAllAssessments()]);
        setUser(me);
        setAssessments(Array.isArray(all) ? all : []);
      } catch (e) {
        setError(e.message || "Could not load MSME records.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // One row per business. The API returns newest first, so the first row seen is the latest.
  const msmes = useMemo(() => {
    const map = new Map();
    for (const a of assessments) {
      const name = a.business_name || "Business not named";
      const m = map.get(name);
      if (m) m.count += 1;
      else map.set(name, { name, sector: a.sector || "Not recorded", county: a.county || "Not recorded", count: 1, latest: a });
    }
    return [...map.values()];
  }, [assessments]);

  const sectors = useMemo(() => [...new Set(msmes.map((m) => m.sector))].sort(), [msmes]);
  const counties = useMemo(() => [...new Set(msmes.map((m) => m.county))].sort(), [msmes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return msmes.filter(
      (m) =>
        (!q || m.name.toLowerCase().includes(q)) &&
        (sector === "all" || m.sector === sector) &&
        (county === "all" || m.county === county)
    );
  }, [msmes, query, sector, county]);

  const pending = msmes.filter((m) => (m.latest.review_status || "pending") === "pending").length;
  const highRisk = msmes.filter((m) => riskKey(m.latest.risk_category) === "high").length;

  return (
    <AnalystLayout title="MSME records" subtitle="Every business that has applied, with its latest assessment." user={user}>
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--space-4)" }}>
        <Stat label="Businesses" value={loading ? "…" : msmes.length} />
        <Stat label="Assessments in total" value={loading ? "…" : assessments.length} />
        <Stat label="Latest assessment awaiting review" value={loading ? "…" : pending} />
        <Stat label="Latest assessment rated high risk" value={loading ? "…" : highRisk} />
      </div>

      <section style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
          <input
            type="search"
            placeholder="Search by business name"
            aria-label="Search by business name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...inputStyle, flex: "1 1 240px" }}
          />
          <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filter by sector" style={inputStyle}>
            <option value="all">All sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={county} onChange={(e) => setCounty(e.target.value)} aria-label="Filter by county" style={inputStyle}>
            <option value="all">All counties</option>
            {counties.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <p style={{ color: "var(--ink-2)" }}>Loading…</p>
        ) : msmes.length === 0 ? (
          <p style={{ color: "var(--ink-2)" }}>No businesses yet. They appear here after their first assessment.</p>
        ) : visible.length === 0 ? (
          <p style={{ color: "var(--ink-2)" }}>No businesses match these filters.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Business</th><th style={th}>Sector</th><th style={th}>County</th>
                  <th style={{ ...th, textAlign: "right" }}>Assessments</th><th style={{ ...th, textAlign: "right" }}>Latest score</th>
                  <th style={th}>Risk</th><th style={th}>Review</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => {
                  const a = m.latest;
                  return (
                    <tr key={m.name}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={muted}>Last assessed {a.created_at} · limit {kes(a.recommended_limit)}</div>
                      </td>
                      <td style={td}>{m.sector}</td>
                      <td style={td}>{m.county}</td>
                      <td style={{ ...td, textAlign: "right" }} className="num">{m.count}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }} className="num">{a.credit_score}</td>
                      <td style={{ ...td, color: RISK_COLOR[riskKey(a.risk_category)] || "var(--ink)", fontWeight: 600 }}>{a.risk_category}</td>
                      <td style={td}><StatusPill status={a.review_status} /></td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/analyst/requests/${a.pk}`)}>Open</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AnalystLayout>
  );
}
