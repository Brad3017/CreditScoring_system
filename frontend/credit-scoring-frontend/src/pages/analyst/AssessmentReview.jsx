import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AnalystLayout from "../../components/AnalystLayout";
import StatusPill from "../../components/StatusPill";
import RiskScale from "../../components/RiskScale";
import { card, cardHead, cardTitle, muted, inputStyle, kes, fmtDateTime } from "../../components/analystUi";
import { fetchMe, fetchAssessmentDetail, reviewAssessment } from "../../lib/api";

function parseFactor(text = "") {
  const s = String(text);
  if (/^caution/i.test(s)) return { hurt: true, text: s.replace(/^caution:\s*/i, "") };
  if (/^positive/i.test(s)) return { hurt: false, text: s.replace(/^positive:\s*/i, "") };
  return { hurt: null, text: s };
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--line)" }}>
      <dt style={{ color: "var(--ink-2)" }}>{label}</dt>
      <dd className="num" style={{ margin: 0, fontWeight: 600, textAlign: "right" }}>{value}</dd>
    </div>
  );
}

export default function AssessmentReview() {
  const { pk } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [a, setA] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [me, detail] = await Promise.all([fetchMe(), fetchAssessmentDetail(pk)]);
        setUser(me);
        setA(detail);
        setNote(detail.review_note || "");
      } catch (e) {
        setError(e.message || "Could not load this assessment.");
      }
    })();
  }, [pk]);

  async function decide(decision) {
    setError(""); setSaved(""); setSaving(true);
    try {
      const updated = await reviewAssessment(pk, decision, note);
      setA(updated);
      setSaved("Decision saved. The applicant can now see it.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const r = a?.request;
  const factors = (a?.explanation || []).map(parseFactor);
  const needsNote = !note.trim() || note.trim().length < 5;

  return (
    <AnalystLayout
      title={a?.business_name || "Assessment review"}
      subtitle={a ? `${a.id} · submitted ${a.created_at}` : "Loading…"}
      user={user}
      actions={<button type="button" className="btn btn-secondary" onClick={() => navigate("/analyst/requests")}>Back to requests</button>}
    >
      {error && <p role="alert" style={{ color: "var(--risk-high)" }}>{error}</p>}
      {!a && !error && <p style={{ color: "var(--ink-2)" }}>Loading…</p>}

      {a && (
        <div className="two-col" style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: "var(--space-6)", alignItems: "start" }}>
          <div style={{ display: "grid", gap: "var(--space-6)" }}>
            <section style={card}>
              <div style={cardHead}>
                <h2 style={cardTitle}>Model result</h2>
                <StatusPill status={a.review_status} />
              </div>
              <RiskScale score={a.credit_score} riskCategory={a.risk_category} />
              <dl style={{ margin: "var(--space-5) 0 0" }}>
                <Row label="Probability of default" value={`${(a.probability_of_default * 100).toFixed(1)}%`} />
                <Row label="Recommended limit" value={kes(a.recommended_limit)} />
                <Row label="Model version" value="xgb_msme_v1" />
              </dl>
            </section>

            <section style={card}>
              <div style={cardHead}><h2 style={cardTitle}>What shaped this result</h2></div>
              {factors.length === 0 ? (
                <p style={{ color: "var(--ink-2)" }}>No explanation was stored for this assessment.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {factors.map((f, i) => (
                    <li key={i} style={{ padding: "var(--space-3) 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                      {f.hurt !== null && (
                        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginRight: "var(--space-3)", color: f.hurt ? "var(--risk-high)" : "var(--risk-low)" }}>
                          {f.hurt ? "Hurt" : "Helped"}
                        </span>
                      )}
                      {f.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={card}>
              <div style={cardHead}><h2 style={cardTitle}>What the applicant submitted</h2></div>
              <dl style={{ margin: 0 }}>
                <Row label="Applicant" value={`${a.applicant.name} (${a.applicant.email})`} />
                <Row label="Sector / county" value={`${a.sector}, ${a.county}`} />
                <Row label="Loan requested" value={`${kes(r.loan_amount)} over ${r.tenure_months} months`} />
                <Row label="Monthly revenue" value={kes(a.monthly_revenue)} />
                <Row label="Monthly profit" value={kes(r.monthly_profit_kes)} />
                <Row label="Days to pay suppliers" value={r.days_payable_outstanding} />
                <Row label="Cash-flow stability (1–5)" value={r.cashflow_stability} />
                <Row label="Existing loans" value={r.existing_loans ? `Yes (${r.prior_loan_count} prior)` : "No"} />
                <Row label="Late payment history" value={r.late_payment_history} />
                <Row label="Collateral" value={r.collateral_level} />
                <Row label="Repayment confidence (1–5)" value={r.repayment_confidence} />
                <Row label="Business age" value={`${r.business_age_years} years`} />
                <Row label="Employees" value={r.employees_count} />
                <Row label="Legal status" value={r.legal_status} />
              </dl>
            </section>
          </div>

          <aside style={{ ...card, position: "sticky", top: "var(--space-6)" }}>
            <div style={cardHead}><h2 style={cardTitle}>Your decision</h2></div>
            {a.reviewed_at && (
              <p style={{ ...muted, marginTop: 0 }}>
                Last decision by {a.reviewed_by || "an analyst"} on {fmtDateTime(a.reviewed_at)}.
              </p>
            )}
            <label htmlFor="note" style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              Note to the applicant
            </label>
            <textarea
              id="note"
              rows={6}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required for a decline or a request for more information. Keep it clear and specific."
              style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
            />
            <p style={{ ...muted, marginTop: "var(--space-2)" }}>
              The model gives a recommendation. You make the decision.
            </p>

            <div style={{ display: "grid", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => decide("approved")}>Approve</button>
              <button type="button" className="btn btn-secondary" disabled={saving || needsNote} onClick={() => decide("referred")}>Ask for more information</button>
              <button type="button" className="btn btn-secondary" disabled={saving || needsNote} onClick={() => decide("declined")}>Decline</button>
            </div>
            {saved && <p role="status" style={{ color: "var(--risk-low)", marginBottom: 0 }}>{saved}</p>}
          </aside>
        </div>
      )}
    </AnalystLayout>
  );
}
