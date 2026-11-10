import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { card, cardHead, cardTitle, muted, inputStyle, th, td } from "../../components/analystUi";
import { getCurrentUser, fetchAdminFairness } from "../../lib/api";

const pct = (v) => (v == null ? "–" : `${v}%`);

export default function AdminFairness() {
  const [user, setUser] = useState(null);
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => { getCurrentUser().then(setUser).catch(() => {}); }, []);
  useEffect(() => {
    setError("");
    fetchAdminFairness({ date_from: from, date_to: to }).then(setD).catch((e) => setError(e.message));
  }, [from, to]);

  return (
    <AdminLayout title="Fairness check" subtitle="Do outcomes differ across sectors, counties and business types?" user={user}>
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}

      <section style={{ ...card, background: "var(--accent-soft)" }}>
        <p style={{ margin: 0 }}>
          This page compares results across groups. A gap is a reason to look closer, not proof of bias: groups can
          differ for legitimate reasons, such as real differences in cash flow. Groups with fewer than{" "}
          <span className="num">{d?.min_group ?? 5}</span> assessments are shown but not compared. With synthetic
          or small data, treat every figure here as an illustration of the method.
        </p>
      </section>

      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}><span style={muted}>From</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={inputStyle} /></label>
        <label style={{ display: "grid", gap: 4 }}><span style={muted}>To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={inputStyle} /></label>
        {d && <span style={muted}>Overall high-risk share: <span className="num" style={{ fontWeight: 600 }}>{pct(d.overall_high_risk_rate)}</span> across <span className="num">{d.total}</span> assessments</span>}
      </div>

      {!d && !error && <p style={{ color: "var(--ink-2)" }}>Loading…</p>}
      {d && d.total === 0 && <section style={card}><p style={{ margin: 0, color: "var(--ink-2)" }}>No assessments in this period yet.</p></section>}

      {d && d.total > 0 && d.dimensions.map((dim) => (
        <section key={dim.field} style={card}>
          <div style={cardHead}>
            <h2 style={cardTitle}>{dim.label}</h2>
            <span style={muted}>
              {dim.gap == null
                ? "Not enough large groups to compare"
                : <>Gap in high-risk share: <span className="num" style={{ fontWeight: 600 }}>{dim.gap} points</span></>}
            </span>
          </div>
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Group</th><th style={th}>Assessments</th><th style={th}>Average score</th>
                  <th style={th}>High-risk share</th><th style={th}>Approved, of decided</th>
                </tr>
              </thead>
              <tbody>
                {dim.groups.map((g) => (
                  <tr key={g.name} style={{ color: g.comparable ? "inherit" : "var(--ink-2)" }}>
                    <td style={td}>{g.name}{!g.comparable && <span style={{ ...muted, marginLeft: 8 }}>too few to compare</span>}</td>
                    <td style={td} className="num">{g.count}</td>
                    <td style={td} className="num">{g.avg_score}</td>
                    <td style={td}>
                      <span className="num" style={{ display: "inline-block", minWidth: 48 }}>{pct(g.high_risk_rate)}</span>
                      <span aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", width: 90, height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${g.high_risk_rate || 0}%`, background: "var(--accent)" }} />
                      </span>
                    </td>
                    <td style={td} className="num">{g.decided ? `${pct(g.approval_rate)} (${g.decided})` : "No decisions yet"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </AdminLayout>
  );
}
