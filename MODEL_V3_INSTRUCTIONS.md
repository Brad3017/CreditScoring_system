# Switch the app to model v3 (no repayment confidence; collateral moves to the loan limit)

The same ground rules as before:

- No git commits, and no co-author lines.
- Show diffs, and explain any migration before creating it.
- Don't rebuild Docker until I say so.
- **Stop and report when done.**

I have already replaced the three files in `ml_artifacts/` with the v3 versions. **Do not edit them.**

## What changed in the model

- `model_metadata.json` → `model_version` is now **`xgb_msme_v3`**, with **17 features**.
- **Removed from the model:** `repayment_confidence` and `collateral_level`. See `metadata["excluded_columns"]` for the reasons.
- **New: `metadata["limit_policy"]`.** Collateral is now used **only** to set the recommended loan limit, never the risk score:
  - `affordable = max_repayment_share_of_profit (0.40) × monthly_profit × tenure_months`
  - `share = share_of_affordable_by_band[risk_category][collateral_level]`. For example, Moderate Risk gives Low 0.5, Moderate 0.75 and High 1.0. Low Risk is always 1.0, and High Risk is always 0.
  - `recommended_limit = min(requested, affordable × share)`, rounded **down** to the nearest `round_down_to` (1,000).
- The risk bands, score formula and encodings are unchanged in structure, and are still read from the metadata.

## Steps

### 1. Scoring service (`scoring/services.py`)

- Read all of the above from the metadata. Nothing is hard-coded: no 0.40, no shares and no band names.
- `prepare_features` must produce exactly the 17 features in `metadata["features"]` order. **Never pass `repayment_confidence` or `collateral_level` to the model.**
- Replace the affordability rule from Phase 2 with `limit_policy`. `collateral_level` is still **required** in the request, because the limit needs it.
- `shap_values` now has 17 items.
- Remove repayment confidence from the out-of-range checks.

### 2. Database and API

- Keep the `repayment_confidence` column on `CreditRequest`, for history. Make it `null=True, blank=True` and stop requiring it in the serializer. Explain the migration first.
- Keep `collateral_level` required, and validate it as `Low`, `Moderate` or `High`.
- Return `limit_explanation` in the assessment payload as a short plain sentence built from the policy. For example:

  > "Moderate risk with high collateral: up to 100% of what your profit can repay over 12 months."

### 3. Assessment form and pages

- Remove the **"How confident are you in repaying?"** question from `NewAssessment.jsx` and its review step.
- Keep the collateral question, but change its helper text to:

  > "Collateral doesn't affect your risk score. It can increase the loan amount recommended for moderate-risk applications."

- **Affordability panel** (report and analyst review): show `limit_explanation` under the recommended limit.
- **Scenario tool** (if built): remove repayment confidence. Collateral stays as a control, but it changes only the limit, not the score. The UI should make that visible: the score stays the same and the limit changes.
- **"What would improve this score" tips:** remove `collateral_level` from the list of changeable risk factors. It is no longer in the score.

### 4. Learn guides (`src/content/lessons.en.json`)

- Replace `collateral_level.scoreLink` with:

  > "In this system, collateral does not affect your risk score. It can increase the loan amount recommended when your risk is moderate, but never above what your profit can repay."

- Collateral lessons are no longer linked from the SHAP chart, because collateral is not in it. Keep the guide on the Learn page.

### 5. Old assessments (legacy display)

- **v1 assessments** keep the legacy notice from Phase 2B, because their label can disagree with the score scale.
- **v2 assessments** use the same bands, so their labels are consistent. Show them normally with a small "Earlier model (v2)" tag, and **no warning notice**.
- Change `is_legacy` accordingly: true **only** when the stored risk label disagrees with the score's band.
- Their stored SHAP values may include the two removed features. Show them as stored. Don't recompute them.

### 6. Admin console

- **Model monitor:** show `feature_decisions` from `model_report.json` as a small table titled **"Inputs tested for removal"**. Next to it, add one line listing the excluded inputs and their reasons, taken from the metadata.
- **Fairness page:** add `collateral_level` as a grouping. This lets us confirm that applicants with little collateral are not scored worse.

### 7. Tests

- `prepare_features` returns the 17 metadata features in order, and contains neither removed column.
- **Changing `collateral_level` does not change** `probability_of_default`, `credit_score` or `risk_category`, but does change `recommended_limit` for Moderate Risk.
- Recommended limit checks:
  - High Risk → 0
  - Low Risk → `min(requested, affordable)`
  - The limit never exceeds `affordable` or `requested`
  - It is rounded down to the nearest 1,000
- **Probability match:** a hand-built row's probability equals `model.predict_proba` to 6 decimals.
- A request without `repayment_confidence` is accepted. A request without `collateral_level` is rejected.

## Report back

- Files changed, migrations, and test results.
- Browser steps to check the change:
  1. Submit the same application twice, once with collateral Low and once with collateral High, at a moderate-risk profile.
  2. The score should be identical, and the limit higher with High collateral.
  3. Give me the exact inputs for that check.

**Then stop.**
