// Requested amount, flat monthly repayment estimate and recommended limit, all from the API.
import { muted } from "./analystUi";

const kes = (n) => (n == null ? "Not recorded" : `KES ${Math.round(Number(n)).toLocaleString("en-KE")}`);

function Item({ label, value, note }) {
  return (
    <div>
      <dt style={muted}>{label}</dt>
      <dd className="num" style={{ margin: "var(--space-1) 0 0", fontWeight: 600, fontSize: "var(--text-lg)" }}>{value}</dd>
      {note && <dd style={{ ...muted, margin: "2px 0 0" }}>{note}</dd>}
    </div>
  );
}

export default function AffordabilityPanel({ assessment: a }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--space-5)", margin: 0 }}>
      <Item label="Requested amount" value={kes(a.requested_amount)} note={a.loan_purpose ? `For ${a.loan_purpose.toLowerCase()}` : null} />
      <Item label="Estimated monthly repayment" value={kes(a.monthly_repayment_estimate)} note="Flat estimate, excluding interest" />
      <Item label="Recommended limit" value={kes(a.recommended_limit)} />
    </dl>
  );
}
