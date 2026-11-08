import { useState, useEffect } from "react";
import AdminLayout from "../../components/AdminLayout";
import { ChartCard, BarList, Empty } from "../../components/charts";
import { card, muted, th, td } from "../../components/analystUi";
import { fetchMe, fetchAdminModel } from "../../lib/api";

function Kpi({ label, value, hint }) {
  return (
    <div style={{ ...card, padding: "var(--space-5)" }}>
      <div style={muted}>{label}</div>
      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", lineHeight: 1.1, marginTop: "var(--space-2)" }}>
        {value ?? "–"}
      </div>
      {hint && <div style={{ ...muted, marginTop: "var(--space-1)" }}>{hint}</div>}
    </div>
  );
}

// Uses the exact matrix when the report has one; otherwise rebuilds it from per-class
// recall and class counts (recall is rounded to 2 dp, so cells can be off by a few rows).
function confusionMatrix(report) {
  if (!report) return null;
  if (report.confusion_matrix) return { ...report.confusion_matrix, exact: true };
  const neg = report.classes?.on_time;
  const pos = report.classes?.default;
  const rNeg = report.per_class?.[0]?.recall;
  const rPos = report.per_class?.[1]?.recall;
  if ([neg, pos, rNeg, rPos].some((v) => typeof v !== "number")) return null;
  const tn = Math.round(rNeg * neg);
  const tp = Math.round(rPos * pos);
  return { tn, fp: neg - tn, fn: pos - tp, tp, exact: false };
}

function Matrix({ m }) {
  const total = m.tn + m.fp + m.fn + m.tp;
  const cell = (n, good) => (
    <td style={{ ...td, textAlign: "center", background: good ? "var(--risk-low-soft)" : "var(--risk-high-soft)", border: "2px solid var(--surface)" }}>
      <div className="num" style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>{n}</div>
      <div style={muted}>{Math.round((100 * n) / total)}% of test rows</div>
    </td>
  );
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 520 }}>
      <thead>
        <tr>
          <th style={th}></th>
          <th style={{ ...th, textAlign: "center" }}>Predicted on-time</th>
          <th style={{ ...th, textAlign: "center" }}>Predicted default</th>
        </tr>
      </thead>
      <tbody>
        <tr><th scope="row" style={th}>Actually on-time</th>{cell(m.tn, true)}{cell(m.fp, false)}</tr>
        <tr><th scope="row" style={th}>Actually defaulted</th>{cell(m.fn, false)}{cell(m.tp, true)}</tr>
      </tbody>
    </table>
  );
}

export default function AdminModel() {
  const [user, setUser] = useState(null);
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMe().then(setUser).catch(() => {});
    fetchAdminModel().then(setD).catch((e) => setError(e.message));
  }, []);

  const r = d?.report;
  const m = confusionMatrix(r);
  const fmt = (v) => (typeof v === "number" ? v.toFixed(2) : "–");

  return (
    <AdminLayout
      title="Model"
      subtitle="Which model is scoring applicants, and how it performed on held-out data."
      user={user}
      actions={<button type="button" className="btn btn-secondary" onClick={() => window.print()} disabled={!d}>Print or save as PDF</button>}
    >
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}
      {!d && !error && <p style={{ color: "var(--ink-2)" }}>Loading…</p>}

      {d && (
        <>
          {!d.loaded && (
            <p role="alert" style={{ ...card, color: "var(--risk-high)", margin: 0 }}>
              The model file did not load on the server, so new applications cannot be scored.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--space-4)" }}>
            <Kpi label="ROC-AUC (test)" value={fmt(r?.roc_auc)} hint={r?.cv_roc_auc ? `Cross-validated ${fmt(r.cv_roc_auc)}` : null} />
            <Kpi label="PR-AUC (test)" value={fmt(r?.pr_auc)} />
            <Kpi label="Accuracy (test)" value={fmt(r?.accuracy)} />
            <Kpi label="Test rows" value={r?.test_rows?.toLocaleString("en-KE")} hint={r?.classes ? `${r.classes.on_time} on-time · ${r.classes.default} default` : null} />
          </div>

          {r?.data_note && <p style={{ ...card, margin: 0, borderLeft: "4px solid var(--risk-moderate)" }}>{r.data_note}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "var(--space-6)" }}>
            <ChartCard
              title="Confusion matrix"
              subtitle={m ? (m.exact ? "Held-out test split" : "Rebuilt from per-class recall and class counts in the report") : null}
            >
              {m ? <Matrix m={m} /> : <Empty>The model report has no class counts to build this from.</Empty>}
            </ChartCard>

            <ChartCard title="Per-class results" subtitle="Precision, recall and F1 on the test split">
              {r?.per_class?.length ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Class</th><th style={th}>Precision</th><th style={th}>Recall</th><th style={th}>F1</th></tr></thead>
                  <tbody>
                    {r.per_class.map((c) => (
                      <tr key={c.name}>
                        <td style={td}>{c.name}</td>
                        <td style={td} className="num">{fmt(c.precision)}</td>
                        <td style={td} className="num">{fmt(c.recall)}</td>
                        <td style={td} className="num">{fmt(c.f1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <Empty>No per-class figures in the report.</Empty>}
            </ChartCard>

            <ChartCard title="How a probability becomes a decision">
              <dl style={{ margin: 0, display: "grid", gap: "var(--space-3)" }}>
                <div><dt style={muted}>Model</dt><dd style={{ margin: 0, fontWeight: 600 }}>{d.model_name || "Not recorded"}</dd></div>
                <div><dt style={muted}>Predicts</dt><dd style={{ margin: 0 }}>{d.target || "Not recorded"}</dd></div>
                <div><dt style={muted}>Score</dt><dd style={{ margin: 0 }}>{d.score_formula}</dd></div>
                <div>
                  <dt style={muted}>Risk bands used by the service</dt>
                  <dd style={{ margin: 0 }}>
                    <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
                      {d.risk_bands.map((b) => <li key={b.label}><strong>{b.label}</strong>: {b.rule}</li>)}
                    </ul>
                  </dd>
                </div>
                <div><dt style={muted}>Threshold saved with the model</dt><dd style={{ margin: 0 }} className="num">{d.metadata_threshold ?? "Not recorded"}</dd></div>
              </dl>
            </ChartCard>

            <ChartCard
              title="Model versions in use"
              subtitle="Assessments stored under each version"
              table={{ head: ["Version", "Assessments"], rows: d.versions_in_use.map((v) => [v.version, v.count]) }}
            >
              <BarList rows={d.versions_in_use.map((v) => ({ label: v.version, value: v.count }))} />
            </ChartCard>

            <ChartCard title="Inputs" subtitle={`${d.features.length} features`}>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {d.features.map((f) => (
                  <li key={f} style={{ padding: "2px var(--space-3)", border: "1px solid var(--line-strong)", borderRadius: 999, fontSize: "var(--text-xs)" }}>{f}</li>
                ))}
              </ul>
            </ChartCard>

            {r?.hyperparameters && (
              <ChartCard title="Hyperparameters" subtitle="Chosen by tuning in the notebook">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {Object.entries(r.hyperparameters).map(([k, v]) => (
                      <tr key={k}><td style={td}>{k}</td><td style={{ ...td, textAlign: "right" }} className="num">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </ChartCard>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
