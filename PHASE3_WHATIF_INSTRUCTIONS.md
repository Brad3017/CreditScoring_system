# Phase 3: "What if" simulator and improvement tips

The same ground rules as Phase 2:

- No `git commit` or `git push`, and no co-author lines.
- Do not touch `ml_artifacts/`.
- Show each change as a diff.
- Use only the design tokens. Tailwind is not loaded.
- **Do not rebuild Docker until I say so.** Stop after step 5 and report.

## Goal

On an assessment report, the owner can change a few answers and immediately see how the score would change, **without saving anything**. This shows that the explanation is real: changing an answer the model relies on moves the score.

## Step 1: Backend endpoint

`POST /api/scoring/simulate/`:

- Owners only. Analysts and admins may also use it.
- Takes the same payload as `assess/` and runs the same serializer validation.
- Calls `services.score()` and the affordability function from Phase 2.
- **Creates no database rows at all.** No CreditRequest, no CreditAssessment, no BusinessProfile.
- Returns:
  - `credit_score`
  - `risk_category`
  - `probability_of_default`
  - `shap_values`
  - `out_of_range`
  - `recommended_limit`
  - `monthly_repayment_estimate`
- Add a simple rate limit of 60 requests a minute per user, using DRF's `UserRateThrottle` with a `simulate` scope.

**Payload source.** The original answers must be available to build the simulation from:

- Owners call `GET /api/scoring/assessments/<pk>/inputs/`, which returns the stored CreditRequest fields for **their own** assessment. It returns 404 for anyone else's.
- Analysts and admins already get these fields in the detail endpoint.

## Step 2: What-if panel on the report page

Add it to `AssessmentResultPage.jsx`, below the SHAP chart, inside a `.panel` titled **"Try a what-if"**:

- **Controls**, starting from the stored answers:
  - Loan amount: a number input plus a slider from 25,000 to 9,000,000
  - Repayment period: a select of 6, 12, 18, 24, 30 or 36 months
  - Days taken to pay suppliers: a slider from 7 to 90
  - Cash-flow stability: a select from 1 to 5
  - Collateral: a select of Low, Moderate or High
  - Late payment history: a select of Never, Rarely or Sometimes
- **Call `/simulate/` 400 ms after the last change** (debounced), not on every keystroke. Show "Calculating…" while waiting.
- **Results**, side by side in two bordered tiles:
  - **Original**: the stored score and band.
  - **What-if**: the new score and band, plus the change, for example "+42 points". Show the change in `var(--risk-low)` if better and `var(--risk-high)` if worse, **always with text**, never colour alone.
  - Below the tiles, show the recommended limit and monthly repayment for the what-if.
- A **Reset** button restores the original answers.
- A caption under the panel: *"This is a simulation. Nothing is saved, and it does not change your assessment or its review."*
- If any what-if values are out of range, show the same caution notice used on the report.

**For legacy (v1) assessments:** hide the panel and show *"The what-if tool is available for assessments made with the current model."* Their stored inputs lack loan purpose.

## Step 3: "What would improve this score"

On the report page, above the what-if panel, add a short list. It uses the **largest risk-raising SHAP values** among the features the owner can change:

- `loan_to_revenue`
- `tenure_months`
- `days_payable_outstanding`
- `cashflow_stability`
- `collateral_level`
- `late_payment_history`

Show at most three. Each is one factual sentence, for example:

> "Loan size relative to revenue raised your risk the most. A smaller loan, or a longer repayment period, would lower this factor. Try it in the what-if below."

Sentences describe the direction of the effect only. **Never promise an outcome or a score.** If none of the changeable features raised the risk, say: "None of the answers you can change raised your risk."

## Step 4: Tests

- `/simulate/` returns 200 with a score, and **the number of CreditRequest and CreditAssessment rows is unchanged** afterwards.
- Invalid input gets a 400.
- An owner can't fetch another owner's `/inputs/`.
- A simulation with the stored inputs returns the same score as the stored assessment.

## Step 5: Report

Report back with:

1. The files changed.
2. The test results.
3. The browser steps: open the Low-risk example, change the loan to 3,000,000 and the period to 6 months, and tell me what I should see. Then do the same on the High-risk example, improving cash flow to 5 and collateral to High.

**Then stop.**
