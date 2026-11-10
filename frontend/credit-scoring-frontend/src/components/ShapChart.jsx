// Horizontal diverging bar chart of the model's SHAP values for one assessment.
// Right of the centre line = pushed risk up (--risk-high); left = pushed risk down (--risk-low).
// Every figure comes from assessment.shap_values; nothing is computed here except bar lengths.
import { useState } from "react";
import { th, td, muted } from "./analystUi";

const TOP = 8;
const fmt = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;

export default function ShapChart({ values, legacyExplanation = [] }) {
  const [showAll, setShowAll] = useState(false);
  const [asTable, setAsTable] = useState(false);

  if (!values?.length) {
    return (
      <div>
        <p style={{ color: "var(--ink-2)", margin: 0 }}>
          Detailed factor breakdown not available for assessments made before model v2.
        </p>
        {legacyExplanation.length > 0 && (
          <>
            <p style={{ ...muted, margin: "var(--space-4) 0 var(--space-2)" }}>Summary recorded at the time:</p>
            <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
              {legacyExplanation.map((t, i) => <li key={i}>{String(t).replace(/^(Caution|Positive):\s*/i, "")}</li>)}
            </ul>
          </>
        )}
      </div>
    );
  }

  const rows = showAll ? values : values.slice(0, TOP);
  const max = Math.max(...values.map((v) => Math.abs(v.value)), 1e-9);
  // Bars use at most 70% of each half so the value label always fits at the tip.
  const len = (v) => `${(Math.abs(v) / max) * 70}%`;

  return (
    <div>
      <p style={{ ...muted, margin: "0 0 var(--space-4)" }}>
        Bars show how much each answer pushed the assessed risk of a missed payment up (right) or down (left).
        Values are the model's SHAP contributions in log-odds.
      </p>

      {asTable ? (
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={th}>Factor</th><th style={th}>Effect</th><th style={{ ...th, textAlign: "right" }}>Contribution</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature}>
                  <td style={td}>{r.label}</td>
                  <td style={{ ...td, color: r.direction === "raises_risk" ? "var(--risk-high)" : "var(--risk-low)", fontWeight: 600 }}>
                    {r.direction === "raises_risk" ? "Raised risk" : "Lowered risk"}
                  </td>
                  <td style={{ ...td, textAlign: "right" }} className="num">{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "minmax(110px, 200px) 1fr", gap: "var(--space-3)", ...muted, marginBottom: "var(--space-2)" }}>
            <span />
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>← Lowered risk</span><span>Raised risk →</span>
            </span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
            {rows.map((r) => {
              const up = r.direction === "raises_risk";
              const color = up ? "var(--risk-high)" : "var(--risk-low)";
              const text = `${r.label}: ${up ? "raised" : "lowered"} risk by ${Math.abs(r.value).toFixed(2)}`;
              return (
                <li key={r.feature} aria-label={text} title={text}
                  style={{ display: "grid", gridTemplateColumns: "minmax(110px, 200px) 1fr", gap: "var(--space-3)", alignItems: "center" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                  <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", minHeight: 22 }}>
                    <span style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, borderRight: "1px solid var(--line-strong)", height: "100%" }}>
                      {!up && <>
                        <span className="num" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color }}>{fmt(r.value)}</span>
                        <span style={{ width: len(r.value), height: 12, background: color, borderRadius: "4px 0 0 4px" }} />
                      </>}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, height: "100%" }}>
                      {up && <>
                        <span style={{ width: len(r.value), height: 12, background: color, borderRadius: "0 4px 4px 0" }} />
                        <span className="num" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color }}>{fmt(r.value)}</span>
                      </>}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-4)" }}>
        {values.length > TOP && (
          <button type="button" className="btn btn-secondary" onClick={() => setShowAll((s) => !s)}>
            {showAll ? `Show top ${TOP}` : `Show all ${values.length}`}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => setAsTable((s) => !s)} aria-pressed={asTable}>
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>
    </div>
  );
}
