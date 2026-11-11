import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { getLessons } from "../lib/lessons";

export default function Learn() {
  const lessons = Object.entries(getLessons());
  return (
    <AppShell>
      <header className="page-head">
        <h1>Learn</h1>
        <p>Short guides to what lenders look at, and practical steps to strengthen your business's credit.</p>
      </header>

      <ul aria-label="Guides" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "var(--space-5)" }}>
        {lessons.map(([key, lesson]) => (
          <li key={key} className="panel" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>
              <Link to={`/learn/${key}`} style={{ color: "var(--ink)", textDecoration: "none" }}>{lesson.title}</Link>
            </h2>
            <p style={{ margin: 0, color: "var(--ink-2)", flex: 1 }}>{lesson.summary}</p>
            {/* Visible call to action; hidden from screen readers to avoid announcing the same link twice. */}
            <Link to={`/learn/${key}`} aria-hidden="true" tabIndex={-1} style={{ color: "var(--accent)", fontWeight: 600 }}>
              Read the guide →
            </Link>
          </li>
        ))}
      </ul>

      <p style={{ color: "var(--ink-2)", fontSize: "var(--text-xs)", margin: 0 }}>General information, not financial advice.</p>
    </AppShell>
  );
}
