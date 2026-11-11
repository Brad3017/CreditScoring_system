// "What would improve this score": the largest risk-raising SHAP values among the answers an
// owner can change. Sentences state the direction of an effect only; they never promise a score.
import { Link } from "react-router-dom";
import { muted } from "./analystUi";
import { hasScoreLesson } from "../lib/lessons";

// Collateral is not here: since model v3 it sets only the loan limit, never the score.
const CHANGEABLE = [
  "loan_to_revenue",
  "tenure_months",
  "days_payable_outstanding",
  "cashflow_stability",
  "late_payment_history",
];

// What the owner could look at for each factor. Facts about the input, not about the outcome.
const HINT = {
  loan_to_revenue: "A smaller loan lowers this ratio. Try it in the what-if below.",
  tenure_months: "Try other repayment periods in the what-if below.",
  days_payable_outstanding: "Try a different number of days in the what-if below.",
  cashflow_stability: "Try a different rating in the what-if below.",
  late_payment_history: "Try other records in the what-if below to see how much weight this answer carries.",
};

export default function ImprovementTips({ values }) {
  const raising = (values || [])
    .filter((v) => CHANGEABLE.includes(v.feature) && v.direction === "raises_risk" && v.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  if (!raising.length) {
    return <p style={{ margin: 0 }}>None of the answers you can change raised your risk.</p>;
  }

  return (
    <>
      <ul style={{ margin: 0, paddingLeft: "1.2em", display: "grid", gap: "var(--space-3)" }}>
        {raising.map((v, i) => (
          <li key={v.feature}>
            {v.label} {i === 0 ? "raised your risk the most among the answers you can change" : "also raised your risk"}.{" "}
            {HINT[v.feature]}
            {hasScoreLesson(v.feature) && (
              <>
                {" "}
                <Link to={`/learn/${v.feature}`} aria-label={`Read the guide: ${v.label}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Read the guide
                </Link>
              </>
            )}
          </li>
        ))}
      </ul>
      <p style={{ ...muted, margin: "var(--space-4) 0 0" }}>
        Based on the model's factor contributions for this assessment. Changing an answer does not guarantee a different result.
      </p>
    </>
  );
}
