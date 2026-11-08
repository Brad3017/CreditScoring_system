import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AnalystLayout from "../../components/AnalystLayout";
import StatusPill from "../../components/StatusPill";
import { card, muted, inputStyle, th, td, fmtDateTime } from "../../components/analystUi";
import { fetchMe, fetchAllAssessments } from "../../lib/api";

export default function ReviewHistory() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [me, all] = await Promise.all([fetchMe(), fetchAllAssessments()]);
        setUser(me);
        setRows((Array.isArray(all) ? all : []).filter((r) => r.reviewed_at));
      } catch (e) {
        setError(e.message || "Could not load review history.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(
    () =>
      rows
        .filter((r) => decision === "all" || r.review_status === decision)
        .sort((x, y) => new Date(y.reviewed_at) - new Date(x.reviewed_at)),
    [rows, decision]
  );

  return (
    <AnalystLayout title="Review history" subtitle="Every decision recorded, newest first." user={user}>
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
          <span style={muted}>{visible.length} decision{visible.length === 1 ? "" : "s"}</span>
          <select value={decision} onChange={(e) => setDecision(e.target.value)} aria-label="Filter by decision" style={inputStyle}>
            <option value="all">All decisions</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="referred">Needs more info</option>
          </select>
        </div>

        {loading ? (
          <p style={{ color: "var(--ink-2)" }}>Loading…</p>
        ) : visible.length === 0 ? (
          <p style={{ color: "var(--ink-2)" }}>No decisions recorded yet. Reviews you complete will appear here.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Business</th><th style={th}>Decision</th><th style={th}>Note</th>
                  <th style={th}>Reviewed by</th><th style={th}>When</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.pk}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.business_name || "Business not named"}</div>
                      <div style={muted}><span className="num">{r.id}</span> · score <span className="num">{r.credit_score}</span></div>
                    </td>
                    <td style={td}><StatusPill status={r.review_status} /></td>
                    <td style={{ ...td, maxWidth: 320, color: "var(--ink-2)" }}>{r.review_note || "No note"}</td>
                    <td style={td}>{r.reviewed_by || "–"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTime(r.reviewed_at)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button type="button" className="btn btn-secondary" onClick={() => navigate(`/analyst/requests/${r.pk}`)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AnalystLayout>
  );
}
