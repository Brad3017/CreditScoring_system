import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import { getLesson, storedDirection } from "../lib/lessons";
import { fetchMyAssessments, recordLessonView } from "../lib/api";

const backLink = (
  <Link to="/learn" style={{ color: "var(--accent)", fontWeight: 600 }}>← Back to all guides</Link>
);

export default function LearnLesson() {
  const { key } = useParams();
  const lesson = getLesson(key);
  const [direction, setDirection] = useState(null);

  useEffect(() => {
    if (!lesson) return undefined;
    let cancelled = false;
    // Personal note from the latest stored assessment only. Any failure just means no note.
    fetchMyAssessments()
      .then((list) => { if (!cancelled) setDirection(storedDirection(list?.[0], key)); })
      .catch(() => {});
    recordLessonView(key); // best effort, at most once per day on the server
    return () => { cancelled = true; };
  }, [key, lesson]);

  if (!lesson) {
    return (
      <AppShell>
        <header className="page-head">
          <h1>Guide not found</h1>
          <p>We couldn't find that guide. It may have been renamed or removed.</p>
        </header>
        <section className="panel">{backLink}</section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" style={{ margin: 0 }}>{backLink}</nav>

      <header className="page-head">
        <h1>{lesson.title}</h1>
        <p>{lesson.summary}</p>
      </header>

      {direction && (
        <p role="note" style={{
          margin: 0, padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius)", fontWeight: 600,
          border: `1px solid var(--risk-${direction === "raised" ? "high" : "low"})`,
          background: `var(--risk-${direction === "raised" ? "high" : "low"}-soft)`,
          color: `var(--risk-${direction === "raised" ? "high" : "low"})`,
        }}>
          In your latest assessment, this {direction} your risk.
        </p>
      )}

      <article className="panel" style={{ display: "grid", gap: "var(--space-6)", maxWidth: "72ch" }}>
        <section aria-labelledby="why-heading">
          <h2 id="why-heading" style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-lg)" }}>Why lenders look at this</h2>
          <p style={{ margin: 0 }}>{lesson.why}</p>
        </section>
        <section aria-labelledby="score-heading">
          <h2 id="score-heading" style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-lg)" }}>How it relates to your score</h2>
          <p style={{ margin: 0 }}>{lesson.scoreLink}</p>
        </section>
        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-lg)" }}>Steps you can take</h2>
          <ol style={{ margin: 0, paddingLeft: "1.4em", display: "grid", gap: "var(--space-2)" }}>
            {lesson.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </section>
        <footer style={{ borderTop: "1px solid var(--line)", paddingTop: "var(--space-4)", display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <p style={{ margin: 0, color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>General information, not financial advice.</p>
          {backLink}
        </footer>
      </article>
    </AppShell>
  );
}
