# Phase 2B: score consistency, layout polish and loading speed

The same ground rules as Phase 2 apply:

- No `git commit` or `git push`, and no co-author lines.
- Do not touch `ml_artifacts/`.
- Show each change as a diff.
- Use only the design tokens. Tailwind is not loaded.
- **Do not rebuild Docker until I say so.** Stop after step C5 and report.

Do the three parts **in order**: A, then B, then C.

## Part A: old assessments show a score that doesn't match their risk label

**The problem.** Assessments made with model `xgb_msme_v1` used different cut-offs: High risk if PD ≥ 0.40 and Moderate if PD ≥ 0.25. With `score = 850 − 550 × PD`, that means a score of 630 or below was "High risk". The score scale (`RiskScale.jsx`) uses High 300–499, Moderate 500–699 and Low 700–850. So an old record with a score of 553 is labelled **High risk** while the marker sits in the **Moderate** band. New `xgb_msme_v2` assessments are consistent, because their bands come from `model_metadata.json` and match the scale.

**The rules.** Never silently change a stored decision record. Never re-score old records with the new model, because their inputs differ: there was no loan purpose, and county was used.

**A1.** Add a `is_legacy` boolean to the API payload. It is true when `model_version` ≠ the current `metadata["model_version"]`. Include `model_version` in the payload too.

**A2.** In `RiskScale.jsx`:
- Highlight the band that the **score** falls in, for all records.
- The risk pill keeps showing the **stored** `risk_category`.
- When `is_legacy` is true, show a small neutral notice under the scale: *"Scored with an earlier model (xgb_msme_v1) that used different risk bands. The label is kept as originally recorded."*

**A3.** Apply A2 everywhere the score appears: Home (latest score card), My Assessments list, the assessment report, the analyst review page, and the analyst requests list. Show legacy records with a small "Earlier model" tag.

**A4.** Add a management command `python manage.py list_legacy_assessments` that prints the ID, business, score, stored category and model version of each legacy record. **Do not delete anything.** I'll decide whether to remove test records myself in Django admin.

## Part B: layout and borders

The goal is a neat, well-defined layout that uses the screen width properly. **Keep the existing colours, fonts and tokens.**

### B1. Owner top bar (`components/AppShell.jsx`)

It currently looks cramped in the middle of wide screens. Fix it like this:

- The header background and its bottom border (`1px solid var(--line-strong)`) span the full window width. The header is sticky at the top, on `var(--surface)`.
- The header's inner container is wider than the page content: `max-width: 1440px`, `padding: 0 var(--space-8)`, `margin: 0 auto`. Below 1100px, padding drops to `var(--space-5)`.
- Lay it out in three zones with CSS grid: `grid-template-columns: auto 1fr auto`.
  - **Left:** the brand, with the teal "B" mark (the same as `AuthShell`) followed by "BiasharaScore".
  - **Centre:** the nav links, left-aligned with `gap: var(--space-6)`, `height: 64px`, items vertically centred. The active link gets a 2px `var(--accent)` underline that sits on the header's bottom border.
  - **Right:** the user block (avatar initials, name and email in two lines, with ellipsis if long), a 1px `var(--line)` divider, then the Sign out button.
- **Below 900px:** the nav becomes a horizontally scrollable row under the brand, and the email is hidden.

### B2. Page width and spacing

- Page content `max-width: 1320px`, centred, with `padding: var(--space-8)` (`var(--space-5)` below 900px).
- Vertical gap between sections: `var(--space-6)`.
- The page title area (h1 plus subtitle) gets a bottom border, `1px solid var(--line)`, with `padding-bottom: var(--space-4)`.

### B3. Borders and containers

- If `.panel`, `.panel-title`, `.split` and `.stack` are missing from `src/styles/tokens.css`, add them. Use `border: 1px solid var(--line-strong)`, `border-radius: var(--radius-lg)`, `padding: var(--space-6)`, `background: var(--surface)`. Make `.card` identical to `.panel`.
- Every content section on the owner pages (Home, New assessment, History, Analytics, Business profile, the report) sits inside a `.panel`. No section floats on the bare background.
- **Panel headers:** title on the left, optional action on the right, with a `1px solid var(--line)` divider beneath.
- **Tables:** a `1px solid var(--line-strong)` header bottom border, `1px solid var(--line)` row dividers, and the whole table wrapped in a bordered, rounded container with `overflow-x: auto`.
- **Forms:** group fields into bordered fieldsets with a heading, such as Business, Finances and Borrowing history. Inputs get `1px solid var(--line-strong)`, a radius of `var(--radius)`, and a visible `2px solid var(--accent)` focus outline.
- **Stat tiles** (the numbers on Home and Analytics) are bordered tiles in an auto-fit grid (`minmax(200px, 1fr)`) with equal heights.
- Apply the same panel and table rules to the analyst and admin pages, using their existing `Sidebar.jsx` layout. Do not change the sidebar.

### B4. Check

Take screenshots of Home, the report, Analytics, New assessment, `/analyst/requests` and `/console` at **1920px, 1366px and 390px** wide. Confirm there is no horizontal page scroll, no text overlap, and that the top bar uses the full width.

## Part C: loading speed

**Measure first, then fix, then measure again.** Report the before and after numbers.

### C1. Measure

Use the browser Network tab with cache disabled, against http://localhost:8080 with the Docker build. Record:

- (a) total load time of `/login`
- (b) time from clicking Sign in to Home being fully shown
- (c) the API response time of `/api/auth/login/`, `/api/auth/me/` and `/api/scoring/assessments/`
- (d) the JavaScript bundle size

Also add temporary timing logs to the login view and the assessments view. Remove them afterwards.

### C2. Backend

- **Gunicorn.** Two sync workers make the page's parallel API calls wait in line. Change the Dockerfile `CMD` to `gunicorn credit_scoring.wsgi:application --bind 0.0.0.0:8000 --workers 2 --threads 4 --worker-class gthread --timeout 90`. Keep 2 workers, because each one loads XGBoost and SHAP.
- **Model loading.** Confirm the model, metadata and SHAP explainer load **once per worker at import**, never per request.
- **Queries.** Check the list endpoints use `select_related` and do not run one query per row. Use `django.db.connection.queries` in a test, or log the query count.
- **Do not lower the password hashing cost.** Login takes a few hundred milliseconds by design, for security.

### C3. Frontend

- **Fonts.** If Newsreader and Instrument Sans load through a CSS `@import` from Google Fonts, replace it with `<link rel="preconnect">` and `<link rel="stylesheet" …&display=swap>` in `index.html`. Better still, self-host them with `@fontsource/newsreader` and `@fontsource/instrument-sans`, importing only the weights we use.
- **Code splitting.** Load the analyst and admin pages lazily with `React.lazy` and `Suspense`, so owners never download them. Show a simple "Loading…" fallback.
- **Login.** Store the user returned by the login response (name, email and role) with the session, so the first page doesn't need an extra `/auth/me/` round trip. Keep `fetchMe()` for refresh.
- **Parallel requests.** Every page that makes more than one request runs them in parallel with `Promise.all`, never one after another.
- **Unused code.** Remove imports of unused libraries and components, such as the shadcn files and any charting library no longer used. Confirm with `npx vite build`, which shows the chunk sizes. Use `lucide-react` named imports only.
- **Loading states.** Show a skeleton or a "Loading…" line inside each panel immediately, rather than a blank screen.

### C4. nginx

Confirm gzip is on for JS, CSS and JSON. Confirm `/assets/` has long cache headers and `index.html` has `Cache-Control: no-cache`.

### C5. Measure again and report

Report a before/after table for (a) to (d), the list of files changed, and anything you chose not to change and why. **Then stop.**
