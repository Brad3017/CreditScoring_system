import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { riskKeyFromCategory } from "../components/RiskScale";
import { fetchMe, fetchMyAssessments } from "../lib/api";

const kes = (n) => (n == null || n === "" ? "Not recorded" : `KES ${Number(n).toLocaleString("en-KE")}`);

const RISK_LABEL = { low: "Low risk", moderate: "Moderate risk", high: "High risk" };
const RISK_TOKEN = { low: "--risk-low", moderate: "--risk-moderate", high: "--risk-high" };

export default function MyAssessments() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");

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
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          marginBottom: "var(--space-8)",
        }}
      >
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)" }}>My assessments</h1>
          <p style={{ color: "var(--ink-2)", marginTop: "var(--space-2)" }}>
            {loading ? "Loading…" : `${assessments.length} ${assessments.length === 1 ? "assessment" : "assessments"} on record`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button type="button" className="btn btn-secondary" onClick={exportCSV} disabled={!assessments.length}>
            Export CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/assessment/new")}>
            New assessment
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" style={{ color: "var(--risk-high)", marginBottom: "var(--space-6)" }}>
          {error}
        </p>
      )}

      {!loading && !error && assessments.length === 0 && (
        <section>
          <p>You have not run an assessment yet.</p>
          <div style={{ marginTop: "var(--space-6)" }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/assessment/new")}>
              Start an assessment
            </button>
          </div>
        </section>
      )}

      {assessments.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
            <label style={{ display: "grid", gap: "var(--space-1)", flex: "1 1 240px" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>Search by business or ID</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Kamau Traders"
                style={inputStyle}
              />
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
          </div>

          <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }} aria-live="polite">
            Showing {visible.length} of {assessments.length}
          </p>

          {visible.length === 0 ? (
            <p style={{ color: "var(--ink-2)" }}>No assessments match these filters.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {visible.map((item, i) => {
                const key = riskKeyFromCategory(item.risk_category);
                return (
                  <li
                    key={item.id || i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto auto",
                      alignItems: "center",
                      gap: "var(--space-6)",
                      padding: "var(--space-4) 0",
                      borderTop: i ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.business_name || "Business not named"}
                      </div>
                      <div style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
                        <span className="num">{item.id}</span> · {item.created_at || "Recent"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>
                        {item.credit_score ?? "–"}
                      </div>
                      {key && (
                        <div style={{ fontSize: "var(--text-xs)", color: `var(${RISK_TOKEN[key]})`, fontWeight: 600 }}>
                          {RISK_LABEL[key]}
                        </div>
                      )}
                    </div>

                    <button type="button" className="btn btn-secondary" onClick={() => openReport(item)}>
                      View report
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}

const inputStyle = {
  font: "inherit",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--ink)",
};
