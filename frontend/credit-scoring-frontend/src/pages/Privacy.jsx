// Public privacy notice (/privacy): readable without signing in. Version and date must change together
// with CONSENT_VERSION in accounts/consent_texts.py whenever this text changes.
import { Link } from "react-router-dom";
import { NOTICE_DATE, NOTICE_VERSION, PRIVACY_EMAIL } from "../lib/consent";

const h2 = { fontSize: "var(--text-lg)", margin: "var(--space-8) 0 var(--space-2)" };
const p = { margin: "0 0 var(--space-3)" };
const ul = { margin: "0 0 var(--space-3)", paddingLeft: "1.25rem", display: "grid", gap: "var(--space-1)" };

export default function Privacy() {
  return (
    <div style={{ minHeight: "100vh", padding: "var(--space-12) var(--space-4)" }}>
      <article className="panel" style={{ maxWidth: "46rem", margin: "0 auto", lineHeight: "var(--leading-body)" }}>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>BiasharaScore</p>
        <h1 style={{ fontSize: "var(--text-xl)", margin: "var(--space-1) 0 var(--space-2)" }}>Privacy notice</h1>
        <p style={{ ...p, color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>Version {NOTICE_VERSION} · {NOTICE_DATE}</p>

        <h2 style={h2}>Who we are</h2>
        <p style={p}>
          BiasharaScore is a credit-scoring tool for Kenyan micro, small and medium enterprises (MSMEs). It is a
          final-year project at Strathmore University. Questions about your data:{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: "var(--accent)", fontWeight: 600 }}>{PRIVACY_EMAIL}</a>.
        </p>

        <h2 style={h2}>What we collect</h2>
        <ul style={ul}>
          <li>Account details: your name, email, phone number and national ID number.</li>
          <li>Your business profile: business name, KRA PIN, county, sector and till number.</li>
          <li>The financial figures you enter, such as sales, costs and loans.</li>
          <li>
            Summaries read from Lipa na M-Pesa till statements you upload. <strong>The statement file itself is
            deleted right after it is read.</strong>
          </li>
          <li>Your assessments and the decisions credit analysts make on them.</li>
        </ul>

        <h2 style={h2}>Why we use it</h2>
        <p style={p}>
          To estimate your business's credit risk, explain the result to you, let a credit analyst review it, and
          produce your decision letter and report.
        </p>

        <h2 style={h2}>Automated scoring and your right to human review</h2>
        <p style={p}>
          A machine-learning model produces your score and shows the main reasons for it. The score is not the final
          decision: a credit analyst reviews every application before a decision is made. You can also ask for a
          review at any time with the <strong>Request a review</strong> button on your result page (Data Protection
          Act 2019, section 35).
        </p>

        <h2 style={h2}>Who can see it</h2>
        <p style={p}>
          Only the credit analysts and administrators of this service. We don't sell your data or share it with
          anyone else.
        </p>

        <h2 style={h2}>How long we keep it</h2>
        <p style={p}>
          Your account and assessment data are kept while your account is active. Till statement files are not kept
          at all.
        </p>

        <h2 style={h2}>Your rights</h2>
        <p style={p}>Under the Data Protection Act 2019 you have the right to:</p>
        <ul style={ul}>
          <li>be told how your data is used (this notice);</li>
          <li>see the data we hold about you, and have it corrected or deleted;</li>
          <li>object to how it is used;</li>
          <li>
            withdraw your consent at any time, under <strong>Account → Privacy and consent</strong>;
          </li>
          <li>
            complain to the Office of the Data Protection Commissioner at{" "}
            <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600 }}>
              odpc.go.ke<span className="sr-only"> (opens in a new tab)</span>
            </a>.
          </li>
        </ul>
        <p style={p}>
          To use these rights, or to have your account and data deleted, email{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: "var(--accent)", fontWeight: 600 }}>{PRIVACY_EMAIL}</a>.
        </p>

        <p style={{ margin: "var(--space-8) 0 0", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line)", color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>
          Version {NOTICE_VERSION} · {NOTICE_DATE} · <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Back to BiasharaScore</Link>
        </p>
      </article>
    </div>
  );
}
