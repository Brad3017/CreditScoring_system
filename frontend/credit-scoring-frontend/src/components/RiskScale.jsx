// Credit score on a 300–850 scale, with the active band highlighted and labelled.
// Renders a clear message when there is no score, rather than a fake value.

const MIN = 300;
const MAX = 850;

const BANDS = [
  { key: "high", label: "High risk", range: "300–499", from: 300, to: 499, color: "--risk-high", soft: "--risk-high-soft" },
  { key: "moderate", label: "Moderate", range: "500–699", from: 500, to: 699, color: "--risk-moderate", soft: "--risk-moderate-soft" },
  { key: "low", label: "Low risk", range: "700–850", from: 700, to: 850, color: "--risk-low", soft: "--risk-low-soft" },
];

// Matches the risk_category strings the API returns.
export function riskKeyFromCategory(category = "") {
  const c = category.toLowerCase();
  if (c.includes("high")) return "high";
  if (c.includes("moderate") || c.includes("medium")) return "moderate";
  if (c.includes("low")) return "low";
  return null;
}

// The scale highlights the band the SCORE falls in. The pill shows the STORED risk_category,
// which for records scored by an earlier model (isLegacy) may come from different cut-offs.
export default function RiskScale({ score, riskCategory, isLegacy = false, modelVersion }) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return <p style={{ color: "var(--ink-2)" }}>No score yet. Submit an assessment to see it here.</p>;
  }

  const clamped = Math.max(MIN, Math.min(MAX, score));
  const position = ((clamped - MIN) / (MAX - MIN)) * 100;
  const active = BANDS.find((b) => clamped >= b.from && clamped <= b.to);
  const stored = BANDS.find((b) => b.key === riskKeyFromCategory(riskCategory));

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <span
          className="num"
          style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-score)", lineHeight: 0.9, color: "var(--ink)" }}
        >
          {score}
        </span>
        <span style={{ color: "var(--ink-2)", paddingBottom: "0.4rem" }}>out of {MAX}</span>
        {stored && (
          <span
            style={{
              marginLeft: "auto",
              alignSelf: "center",
              padding: "var(--space-1) var(--space-3)",
              borderRadius: 999,
              background: `var(${stored.soft})`,
              color: `var(${stored.color})`,
              fontWeight: 600,
              fontSize: "var(--text-sm)",
            }}
          >
            {stored.label}
          </span>
        )}
      </div>

      <div
        role="img"
        aria-label={`Score ${score} out of ${MAX}, in the ${active.label.toLowerCase()} band of the scale`}
        style={{ position: "relative", marginTop: "var(--space-6)", paddingTop: "var(--space-4)" }}
      >
        {/* Track: each band is a segment sized to its share of the scale */}
        <div style={{ display: "flex", height: 12, gap: 4 }}>
          {BANDS.map((b) => {
            const isActive = active?.key === b.key;
            return (
              <div
                key={b.key}
                style={{
                  flex: b.to - b.from + 1,
                  borderRadius: 6,
                  background: isActive || !active ? `var(${b.color})` : `var(${b.soft})`,
                  opacity: !active ? 0.55 : 1,
                  transition: "background 300ms ease",
                }}
              />
            );
          })}
        </div>

        {/* Marker: the line sits exactly at the score's position. The number badge shifts
            sideways near the ends of the scale (0% at 300, 100% at 850) so it never overflows. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${position}%`,
            top: 0,
            transform: "translateX(-1px)",
            width: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            transition: "left 600ms ease-out",
          }}
        >
          <span
            className="num"
            style={{
              transform: `translateX(-${position}%)`,
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              background: "var(--ink)",
              color: "var(--surface)",
              padding: "1px 6px",
              borderRadius: 4,
              marginBottom: 4,
            }}
          >
            {score}
          </span>
          {/* Ends just below the track, above the band labels, so it never crosses their text. */}
          <span style={{ width: 2, height: 14, background: "var(--ink)", borderRadius: 1 }} />
        </div>
      </div>

      {/* Labels sit under their own segment */}
      <div style={{ display: "flex", gap: 4, marginTop: "var(--space-3)" }}>
        {BANDS.map((b) => {
          const isActive = active?.key === b.key;
          return (
            <div key={b.key} style={{ flex: b.to - b.from + 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? `var(${b.color})` : "var(--ink-2)",
                }}
              >
                {b.label}
              </div>
              <div className="num" style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>
                {b.range}
              </div>
            </div>
          );
        })}
      </div>

      {isLegacy && (
        <p role="note" style={{ margin: "var(--space-4) 0 0", padding: "var(--space-3) var(--space-4)", border: "1px solid var(--line)", borderRadius: "var(--radius)", color: "var(--ink-2)", fontSize: "var(--text-xs)" }}>
          Scored with an earlier model ({modelVersion || "xgb_msme_v1"}) that used different risk bands. The label is kept as originally recorded.
        </p>
      )}
    </figure>
  );
}
