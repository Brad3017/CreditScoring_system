// Small, dependency-free charts. Thin marks, 2px surface gaps, text in text colours,
// and a table view behind every chart so nothing depends on colour alone.
import { card, cardHead, cardTitle, muted, th, td } from "./analystUi";

export function ChartCard({ title, subtitle, table, children }) {
  return (
    <section style={card}>
      <div style={cardHead}>
        <div>
          <h2 style={cardTitle}>{title}</h2>
          {subtitle && <p style={{ ...muted, margin: "2px 0 0" }}>{subtitle}</p>}
        </div>
      </div>
      {children}
      {table && (
        <details style={{ marginTop: "var(--space-4)" }}>
          <summary style={{ ...muted, cursor: "pointer" }}>View as table</summary>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "var(--space-2)" }}>
            <thead>
              <tr>{table.head.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} style={td} className={j ? "num" : undefined}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

export function Empty({ children = "No data in this period." }) {
  return <p style={{ color: "var(--ink-2)", margin: 0 }}>{children}</p>;
}

// Horizontal bars: label left, thin bar, value at the tip.
export function BarList({ rows, format = (v) => v, max, color = "var(--accent)" }) {
  if (!rows.length) return <Empty />;
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-3)" }}>
      {rows.map((r) => (
        <li
          key={r.label}
          title={`${r.label}: ${format(r.value)}`}
          style={{ display: "grid", gridTemplateColumns: "minmax(90px, 160px) 1fr auto", gap: "var(--space-3)", alignItems: "center" }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          <span style={{ background: "var(--line)", borderRadius: 4, height: 10, overflow: "hidden" }}>
            <span style={{ display: "block", width: `${Math.max(2, (r.value / top) * 100)}%`, height: "100%", background: r.color || color, borderRadius: 4 }} />
          </span>
          <span className="num" style={{ fontWeight: 600, minWidth: 44, textAlign: "right" }}>{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// Vertical columns for ordered buckets (score bins, months).
export function Columns({ data, color = "var(--accent)", height = 160 }) {
  if (!data.length || data.every((d) => !d.value)) return <Empty />;
  const top = Math.max(...data.map((d) => d.value), 1);
  return (
    <div role="img" aria-label="Column chart; see table view for exact values"
      style={{ display: "flex", alignItems: "flex-end", gap: 2, height: height + 28, borderBottom: "1px solid var(--line-strong)" }}>
      {data.map((d) => (
        <div key={d.label} title={`${d.label}: ${d.value}`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
          <span className="num" style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginBottom: 2 }}>{d.value || ""}</span>
          <span style={{ width: "100%", maxWidth: 24, height: `${(d.value / top) * height}px`, minHeight: d.value ? 3 : 0, background: color, borderRadius: "4px 4px 0 0" }} />
          <span style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4, whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// One stacked bar with 2px gaps, plus a legend carrying names and counts in text.
export function Split({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <Empty />;
  return (
    <div>
      <div style={{ display: "flex", gap: 2, height: 14 }} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts.filter((p) => p.value).map((p) => (
          <span key={p.label} title={`${p.label}: ${p.value}`} style={{ flex: p.value, background: p.color, borderRadius: 4 }} />
        ))}
      </div>
      <ul style={{ listStyle: "none", margin: "var(--space-4) 0 0", padding: 0, display: "flex", flexWrap: "wrap", gap: "var(--space-5)" }}>
        {parts.map((p) => (
          <li key={p.label} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
            <span>{p.label}</span>
            <span className="num" style={{ fontWeight: 600 }}>{p.value}</span>
            <span style={muted}>({Math.round((100 * p.value) / total)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
