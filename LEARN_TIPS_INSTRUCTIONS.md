# Financial literacy tips ("Learn" feature)

The same ground rules as before:

- No git commits, and no co-author lines.
- Don't touch `ml_artifacts/`.
- Show diffs.
- Use only the design tokens. Tailwind is not loaded.
- Don't rebuild Docker until I say so.
- Stop and report when done.

## Goal

Each factor that shapes an owner's score links to a short, plain-language lesson explaining why it matters to lenders and what the owner can do about it. This turns the score into education.

The lessons are **general information, not financial advice**. They never promise a score or a loan.

## 1. Content

- Store the lessons in `src/content/lessons.en.json`, keyed by the model feature key. Use the exact text in section 6 below. **Don't rewrite it.**
- Each lesson has: `title`, `summary` (one line), `why` (a short paragraph), `scoreLink` (one sentence on how it relates to this system's score), and `steps` (a list of 3 practical steps).
- Keep the structure translation-ready. The Swahili version will be added later as `lessons.sw.json`, with the same keys. If i18n is already set up, load the file for the current language and fall back to English.

## 2. A "Learn" page: `/learn` (owners)

- Add it to the owner top bar as **"Learn"**, after Analytics.
- Show an intro panel: *"Short guides to what lenders look at, and practical steps to strengthen your business's credit."*
- Below it, show a grid of lesson cards (`.panel`). Each card has the title and summary, and opens the full lesson.
- Each lesson opens at `/learn/<feature_key>` and shows:
  - the title
  - "Why lenders look at this"
  - "How it relates to your score"
  - "Steps you can take"
  - a footer note: *"General information, not financial advice."*
  - a "Back to all guides" link
- If the owner has an assessment, show a small personal note at the top of the lesson. Base it on their latest assessment's `shap_values` for that feature:
  - if it raised their risk: *"In your latest assessment, this raised your risk."*
  - if it lowered their risk: *"In your latest assessment, this lowered your risk."*

  Use only the stored data. Show nothing if there's no assessment or the feature has no value.

## 3. Links from the report

- **SHAP chart** (owner report page): next to each factor that has a lesson, add a small **"Learn why"** link to `/learn/<feature_key>`. Make it keyboard-accessible.
- **"What would improve this score"**: each tip ends with a **"Read the guide"** link to its lesson.
- **Home page**: if the latest assessment exists, show one panel, **"Recommended reading"**. It links the lessons for the top two risk-raising factors that have lessons. Hide the panel if none raised risk.

## 4. Analytics (optional, small)

Record when an owner opens a lesson. Use a `LessonView` model (user, feature_key, viewed_at), written by `POST /api/learn/viewed/`, at most once per user per lesson per day.

On the admin console Overview, add a small table: **"Most-read guides"**, showing lesson titles and their view counts. Explain the migration before creating it.

## 5. Tests and checks

- Every lesson key in the JSON is a real feature key in `model_metadata.json`.
- Every lesson has all five fields, and exactly 3 steps.
- `/learn/<unknown_key>` shows a friendly "Guide not found" message with a link back.
- The lesson-view endpoint (if built): owners only, no duplicates within the same day.

## 6. Lesson content (use verbatim)

```json
{
  "late_payment_history": {
    "title": "Why paying on time matters most",
    "summary": "Your repayment record is the strongest signal of how you'll handle a new loan.",
    "why": "Lenders look first at how you have repaid before. A business that has paid loans and bills on time is seen as likely to do so again. In Kenya, lenders can also report late loan repayments to credit reference bureaus (CRBs), which other lenders check.",
    "scoreLink": "In this system, a history of late payments raises the assessed risk more than any other answer.",
    "steps": [
      "Set repayment reminders a few days before each due date, or use automatic payments where your lender offers them.",
      "If you expect to miss a payment, talk to your lender before the due date. Agreeing a new date is better than paying late without notice.",
      "Clear any small overdue balances first. A clean recent record matters most."
    ]
  },
  "days_payable_outstanding": {
    "title": "Why paying suppliers late affects your credit",
    "summary": "How quickly you pay suppliers shows whether your cash covers your obligations.",
    "why": "Taking a long time to pay suppliers can be a sign that money is tight. It can also damage supplier relationships, so you may lose credit terms or discounts. Lenders read it as a warning about cash pressure.",
    "scoreLink": "In this system, taking more days to pay suppliers tends to raise the assessed risk.",
    "steps": [
      "Agree clear payment terms with each supplier and keep to them.",
      "Plan payments around when your own customers pay you, so money arrives before bills are due.",
      "If you need longer, negotiate it openly. Agreed terms are better than paying late."
    ]
  },
  "cashflow_stability": {
    "title": "Steady cash flow: why predictability counts",
    "summary": "Lenders want to see that money comes in regularly enough to cover repayments.",
    "why": "Even a profitable business can struggle to repay if its income arrives in unpredictable bursts. Regular, predictable sales make it easier to meet a fixed monthly repayment.",
    "scoreLink": "In this system, steadier cash flow lowers the assessed risk.",
    "steps": [
      "Keep simple weekly records of money in and money out, so you can see your patterns.",
      "Build a small reserve in good months to cover quieter ones.",
      "Look for steady income sources, such as regular customers or contracts, alongside one-off sales."
    ]
  },
  "loan_to_revenue": {
    "title": "Borrowing the right amount for your business",
    "summary": "A loan that is large compared with your sales is harder to repay.",
    "why": "Lenders compare the size of the loan with how much your business earns. When a loan is many times your monthly sales, repayments take a big share of your income, and there is less room for a bad month.",
    "scoreLink": "In this system, a larger loan relative to your monthly revenue raises the assessed risk.",
    "steps": [
      "Work out exactly what the loan is for, and borrow only what that needs.",
      "Use the scenario tool on your report to see how a smaller amount changes your result.",
      "Consider borrowing in stages: a smaller first loan, repaid well, can support a larger one later."
    ]
  },
  "tenure_months": {
    "title": "Choosing a repayment period you can manage",
    "summary": "The repayment period sets how much you pay each month.",
    "why": "A shorter period means larger monthly repayments. A longer period means smaller monthly repayments, but usually more interest in total. The right period is one where the monthly amount fits comfortably within your cash flow.",
    "scoreLink": "In this system, the repayment period affects your result together with the loan size and your income.",
    "steps": [
      "Before applying, check what monthly repayment you could pay in your quietest month.",
      "Compare the monthly repayment and the total cost for two or three different periods.",
      "Avoid a period so short that repayments take most of your profit."
    ]
  },
  "collateral_level": {
    "title": "What collateral is and why lenders ask for it",
    "summary": "Security gives a lender a way to recover money if a loan is not repaid.",
    "why": "Collateral, or security, is an asset the lender can claim if the loan isn't repaid. Common examples are a vehicle logbook, stock, equipment or a title deed. Stronger security lowers the lender's risk.",
    "scoreLink": "In this system, offering stronger security lowers the assessed risk.",
    "steps": [
      "List the business assets you own, with any documents that prove ownership.",
      "Keep ownership documents such as logbooks and receipts organised and up to date.",
      "Understand what you could lose before pledging an asset. Only offer security you are prepared to commit."
    ]
  },
  "profit_margin": {
    "title": "Profit margin: what your business keeps",
    "summary": "It's not only how much you sell, but how much of it you keep.",
    "why": "Profit margin is the share of your sales left after costs. A healthy margin means money is available for repayments, even after paying for stock, rent and wages. A thin margin leaves little room for repayments or surprises.",
    "scoreLink": "In this system, a higher profit margin generally lowers the assessed risk.",
    "steps": [
      "Track your main costs every month, so you know where money goes.",
      "Review your prices against your costs, especially when supplier prices rise.",
      "Cut or renegotiate costs that don't help you sell more."
    ]
  },
  "existing_loans": {
    "title": "Managing more than one loan",
    "summary": "Loans you already have reduce what you can afford to repay on a new one.",
    "why": "Lenders consider all the loans you are currently repaying, including mobile loans. Several loans at once can stretch your cash flow, and missing one can affect your record with all lenders.",
    "scoreLink": "In this system, whether you already have loans running is one of the factors considered.",
    "steps": [
      "Write down every loan you have, with its monthly repayment and end date.",
      "Try to finish or reduce existing loans before taking a new one.",
      "Avoid taking a new loan to repay an old one unless the terms are clearly better."
    ]
  },
  "prior_loan_count": {
    "title": "Building a borrowing track record",
    "summary": "Loans repaid in the past help a lender trust you with a new one.",
    "why": "A history of loans that were taken and repaid shows lenders how you behave as a borrower. Businesses with no history are harder for lenders to judge.",
    "scoreLink": "In this system, your number of previous loans is one of the factors considered, together with how you repaid them.",
    "steps": [
      "Start with a small loan you are confident you can repay, and repay it on time.",
      "Keep records of loans you have repaid, such as statements and clearance letters.",
      "Remember that how you repaid matters more than how many loans you took."
    ]
  }
}
```

## 7. Report back

Report:

- the files changed
- any migration
- the test results
- the browser steps:
  - open `/learn`
  - open one lesson
  - from a report, click "Learn why" on the top factor
  - check the personal note and the "Recommended reading" panel on Home

**Then stop.**
