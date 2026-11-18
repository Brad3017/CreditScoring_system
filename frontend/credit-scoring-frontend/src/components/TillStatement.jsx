// Lipa na M-Pesa till statement figures, as read on the server (scoring/statements/).
//   TillTiles          the four owner-facing tiles: sales / month, unique customers, repeat customers, average sale
//   TillChecks         the checks: a tick for each pass, the message for each warning
//   TillStatementPanel the analyst view: monthly sales chart, customer metrics, flags, warnings, expenses note
import { BarList } from "./charts";
import { card, cardHead, cardTitle, muted, th, td } from "./analystUi";
import { t } from "../lib/i18n";
import { kes, monthLabel, pct, tillLine, trendLabel } from "../lib/till";

function Tile({ label, value }) {
  return (
    <div className="stat">
      <dt style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>{label}</dt>
      <dd className="num" style={{ margin: "var(--space-1) 0 0", fontWeight: 600, fontSize: "var(--text-lg)" }}>{value}</dd>
    </div>
  );
}

export function TillTiles({ statement: s }) {
  return (
    <dl className="stat-grid" style={{ margin: 0 }}>
      <Tile label={t("till.sales")} value={kes(s.avg_monthly_revenue)} />
      <Tile label={t("till.uniqueCustomers")} value={Number(s.unique_customers).toLocaleString("en-KE")} />
      <Tile label={t("till.repeatCustomers")} value={pct(s.repeat_customer_share)} />
      <Tile label={t("till.avgSale")} value={kes(s.avg_ticket)} />
    </dl>
  );
}

const MARK = {
  pass: { sign: "✓", color: "var(--risk-low)" },
  warn: { sign: "!", color: "var(--risk-moderate)" },
  fail: { sign: "✕", color: "var(--risk-high)" },
};

// warningsOnly: just the warn (and fail) checks, with a short "No warnings." when there are none.
export function TillChecks({ checks = [], warningsOnly = false }) {
  const shown = warningsOnly ? checks.filter((c) => c.status !== "pass") : checks;
  if (!shown.length) return <p style={{ margin: 0, color: "var(--ink-2)" }}>{t("till.noWarnings")}</p>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
      {shown.map((c) => {
        const m = MARK[c.status] || MARK.warn;
        return (
          <li key={c.code} style={{ display: "flex", gap: "var(--space-3)", alignItems: "baseline" }}>
            <span aria-hidden="true" style={{
              flex: "none", width: "1.25rem", height: "1.25rem", borderRadius: "50%", display: "inline-grid", placeItems: "center",
              border: `1px solid ${m.color}`, color: m.color, fontSize: "var(--text-xs)", fontWeight: 700,
            }}>{m.sign}</span>
            <span style={{ color: c.status === "pass" ? "var(--ink-2)" : "var(--ink)" }}>
              <span className="sr-only">{c.status}: </span>{c.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// "Aug 2026 (part)" when the statement starts or ends inside that month.
function monthRows(s) {
  const rows = s.monthly_breakdown || [];
  const startsMidMonth = s.period_start && !s.period_start.endsWith("-01");
  const end = s.period_end ? new Date(`${s.period_end}T00:00:00Z`) : null;
  const endsMidMonth = end && new Date(end.getTime() + 86400000).getUTCDate() !== 1;
  return rows.map((m, i) => {
    const part = (i === 0 && startsMidMonth) || (i === rows.length - 1 && endsMidMonth);
    return { label: `${monthLabel(m.month)}${part ? " (part)" : ""}`, value: m.sales, payments: m.payments, customers: m.unique_customers };
  });
}

// Analyst detail. Laid out like the other cards on the review page.
export function TillStatementPanel({ statement: s, expenses }) {
  const months = monthRows(s);
  const f = s.flags || {};
  const sub = { margin: "0 0 var(--space-3)", fontSize: "var(--text-base)" };
  return (
    <section style={card} aria-labelledby="till-heading">
      <div style={cardHead}>
        <h2 id="till-heading" style={cardTitle}>{t("till.statementTitle")}</h2>
        <span style={muted}>{tillLine(s)}</span>
      </div>
      <div style={{ display: "grid", gap: "var(--space-6)" }}>
        <div>
          <h3 style={sub}>{t("till.monthlySales")}</h3>
          <BarList rows={months} format={kes} />
          <details style={{ marginTop: "var(--space-3)" }}>
            <summary style={{ ...muted, cursor: "pointer" }}>View as table</summary>
            <div className="table-wrap" style={{ marginTop: "var(--space-2)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Month", "Sales (KES)", "Payments", "Unique customers"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.label}>
                      <td style={td}>{m.label}</td>
                      <td style={td} className="num">{Math.round(m.value).toLocaleString("en-KE")}</td>
                      <td style={td} className="num">{m.payments}</td>
                      <td style={td} className="num">{m.customers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <dl className="stat-grid" style={{ margin: 0 }}>
          <Tile label={t("till.uniqueCustomers")} value={Number(s.unique_customers).toLocaleString("en-KE")} />
          <Tile label={t("till.repeatCustomers")} value={pct(s.repeat_customer_share)} />
          <Tile label={t("till.avgSale")} value={kes(s.avg_ticket)} />
          <Tile label={t("till.trend")} value={trendLabel(f.revenue_trend_pct)} />
          <Tile label={t("till.zeroDays")} value={f.zero_sale_days ?? "–"} />
        </dl>

        <div>
          <h3 style={sub}>{t("till.warnings")}</h3>
          <TillChecks checks={s.checks} warningsOnly />
        </div>

        <p style={{ margin: 0, padding: "var(--space-3) var(--space-4)", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
          <strong>{t("till.expensesSelfReported")}</strong>
          {expenses != null && <> {t("till.expenses")}: <span className="num">{kes(expenses)}</span>.</>}
        </p>
      </div>
    </section>
  );
}
