import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import LoadError from "../components/LoadError";
import { riskKeyFromCategory } from "../components/RiskScale";
import LegacyTag from "../components/LegacyTag";
import StatusPill from "../components/StatusPill";
import { getCurrentUser, fetchMyAssessments } from "../lib/api";

const kes = (n) => (n == null || n === "" ? "Not recorded" : `KES ${Number(n).toLocaleString("en-KE")}`);

const RISK_LABEL = { low: "Low risk", moderate: "Moderate risk", high: "High risk" };
const RISK_TOKEN = { low: "--risk-low", moderate: "--risk-moderate", high: "--risk-high" };

export default function MyAssessments() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // bumped by Retry to re-run the load
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assessments.filter((a) => {
      const matchesText =
        !q ||
        (a.id || "").toLowerCase().includes(q) ||
        (a.business_name || "").toLowerCase().includes(q);
      const matchesRisk = risk === "all" || riskKeyFromCategory(a.risk_category) === risk;
      return matchesText && matchesRisk;
    });
  }, [assessments, query, risk]);

  function exportCSV() {
    if (!assessments.length) return;
    const headers = ["Assessment ID", "Date", "Business", "Sector", "County", "Monthly revenue (KES)", "Credit score", "Risk category", "Recommended limit (KES)"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = assessments.map((a) =>
      [a.id, a.created_at, a.business_name, a.sector, a.county, a.monthly_revenue ?? "", a.credit_score ?? "", a.risk_category, a.recommended_limit ?? ""].map(esc).join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `assessments_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const openReport = (assessment) => navigate("/assessment/results", { state: { assessment } });

  return (
    <AppShell user={user}>
      <header className="page-head">
        <h1>My assessments</h1>
        <p>{loading ? "Loading…" : error ? "Your history could not be loaded." : `${assessments.length} ${assessments.length === 1 ? "assessment" : "assessments"} on record`}</p>
      </header>

      <LoadError message={error} onRetry={retry} busy={loading} />

      <section className="panel" aria-labelledby="history-heading">
        <div className="panel-head">
          <h2 id="history-heading">Assessment history</h2>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" onClick={exportCSV} disabled={!assessments.length}>
              Export CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/assessment/new")}>
              New assessment
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--ink-2)", margin: 0 }}>Loading…</p>
        ) : !error && assessments.length === 0 ? (
          <p style={{ margin: 0 }}>You have not run an assessment yet. Use New assessment to start one.</p>
        ) : assessments.length > 0 && (
          <>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-4)", alignItems: "end" }}>
              <label style={{ display: "grid", gap: "var(--space-1)", flex: "1 1 240px" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>Search by business or ID</span>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Kamau Traders" style={inputStyle} />
              </label>
              <label style={{ display: "grid", gap: "var(--space-1)", minWidth: 180 }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>Risk band</span>
                <select value={risk} onChange={(e) => setRisk(e.target.value)} style={inputStyle}>
                  <option value="all">All bands</option>
                  <option value="low">Low risk</option>
                  <option value="moderate">Moderate risk</option>
                  <option value="high">High risk</option>
                </select>
              </label>
              <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-2) auto" }} aria-live="polite">
                Showing {visible.length} of {assessments.length}
              </p>
            </div>

            {visible.length === 0 ? (
              <p style={{ color: "var(--ink-2)", margin: 0 }}>No assessments match these filters.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Business</th><th>Date</th><th>Review</th>
                      <th style={{ textAlign: "right" }}>Score</th><th>Risk</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item, i) => {
                      const key = riskKeyFromCategory(item.risk_category);
                      return (
                        <tr key={item.id || i}>
                          <td style={{ minWidth: 180 }}>
                            <div style={{ fontWeight: 600 }}>{item.business_name || "Business not named"}</div>
                            <div style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
                              <span className="num">{item.id}</span><LegacyTag record={item} />
                            </div>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{item.created_at || "Recent"}</td>
                          <td><StatusPill status={item.review_status || "pending"} /></td>
                          <td className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>
                            {item.credit_score ?? "–"}
                          </td>
                          <td style={{ fontSize: "var(--text-xs)", color: key ? `var(${RISK_TOKEN[key]})` : "var(--ink-2)", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {key ? RISK_LABEL[key] : "–"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button type="button" className="btn btn-secondary" onClick={() => openReport(item)}>View report</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}

const inputStyle = {
  font: "inherit",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--ink)",
};
