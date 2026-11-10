import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AnalystLayout from "../../components/AnalystLayout";
import StatusPill from "../../components/StatusPill";
import { riskKeyFromCategory } from "../../components/RiskScale";
import LegacyTag from "../../components/LegacyTag";
import { card, muted, inputStyle, th, td } from "../../components/analystUi";
import { getCurrentUser, fetchAllAssessments } from "../../lib/api";

const RISK_LABEL = { low: "Low risk", moderate: "Moderate", high: "High risk" };
const RISK_TOKEN = { low: "--risk-low", moderate: "--risk-moderate", high: "--risk-high" };

export default function AssessmentRequests() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("pending");
  const [risk, setRisk] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [me, all] = await Promise.all([getCurrentUser(), fetchAllAssessments()]);
        setUser(me);
        setRows(Array.isArray(all) ? all : []);
      } catch (e) {
        setError(e.message || "Could not load requests.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, approved: 0, declined: 0, referred: 0 };
    rows.forEach((r) => { c[r.review_status] = (c[r.review_status] || 0) + 1; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.review_status !== status) return false;
      if (risk !== "all" && riskKeyFromCategory(r.risk_category) !== risk) return false;
      if (q && !`${r.business_name} ${r.id} ${r.county} ${r.sector}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, risk, query]);

  const tabs = [
    ["pending", "Pending"], ["approved", "Approved"], ["declined", "Declined"],
    ["referred", "Needs info"], ["all", "All"],
  ];

  return (
    <AnalystLayout title="Assessment requests" subtitle="Open a request to read the evidence and record a decision." user={user}>
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}

      <section style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              aria-pressed={status === key}
              className={status === key ? "btn btn-primary" : "btn btn-secondary"}
            >
              {label} <span className="num" style={{ opacity: 0.8 }}>({counts[key] ?? 0})</span>
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search business, county, sector"
              aria-label="Search requests"
              style={{ ...inputStyle, minWidth: 220 }}
            />
            <select value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Filter by risk" style={inputStyle}>
              <option value="all">All risk levels</option>
              <option value="high">High risk</option>
              <option value="moderate">Moderate</option>
              <option value="low">Low risk</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--ink-2)" }}>Loading requests…</p>
        ) : visible.length === 0 ? (
          <p style={{ color: "var(--ink-2)" }}>
            {status === "pending" ? "Nothing is waiting for review." : "No requests match these filters."}
          </p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Business</th><th style={th}>Submitted</th>
                  <th style={th}>Score</th><th style={th}>Risk</th>
                  <th style={th}>Status</th><th style={th}><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const k = riskKeyFromCategory(r.risk_category);
                  return (
                    <tr key={r.pk}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.business_name || "Business not named"}</div>
                        <div style={muted}><span className="num">{r.id}</span> · {r.sector}, {r.county}<LegacyTag record={r} /></div>
                      </td>
                      <td style={td}>{r.created_at}</td>
                      <td style={td}><span className="num" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>{r.credit_score}</span></td>
                      <td style={{ ...td, color: k ? `var(${RISK_TOKEN[k]})` : "inherit", fontWeight: 600 }}>{k ? RISK_LABEL[k] : "–"}</td>
                      <td style={td}><StatusPill status={r.review_status} /></td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/analyst/requests/${r.pk}`)}>
                          {r.review_status === "pending" ? "Review" : "Open"}
                        </button>
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
