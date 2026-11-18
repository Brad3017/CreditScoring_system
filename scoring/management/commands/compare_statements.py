"""python manage.py compare_statements scoring/tests/fixtures/statements

1. Parses every *_till_statement.pdf in the folder (checks run with today = the statement's last day) and
   compares the figures with ground_truth.json: % difference for revenue, payments, unique customers and
   repeat share.
2. Scores each owner twice with the real scoring service (scoring/services.py), on one fixed baseline:
     (a) verified       revenue from the till statement, expenses = suggested_monthly_expenses
     (b) self-reported  revenue = statement revenue x 1.20, expenses x 0.90
                        (a typical owner rounding sales up and costs down)
   Profit = revenue - expenses, never below 0 (as for a real till-statement assessment).
Writes nothing to the database.
"""
import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from scoring import services
from scoring.statements import StatementError, parse_till_pdf, profit_from, run_checks, summarise

# A fixed, valid set of answers for everything the statement does not supply. Retail, 4 years, 3 employees,
# KES 100,000 over 12 months, moderate collateral (the limit policy's middle level); the rest are the
# CreditRequest model defaults.
BASELINE = {
    "sector": "Retail",
    "legal_status": "Sole",
    "location_type": "Urban",
    "loan_purpose": "Working capital",
    "business_age_years": 4,
    "employees_count": 3,
    "loan_amount_kes": 100_000,
    "tenure_months": 12,
    "existing_loans": False,
    "prior_loan_count": 0,
    "late_payment_history": "Never",
    "collateral_level": "Moderate",
    "cashflow_stability": 3,
    "owner_education": "Secondary",
    "days_payable_outstanding": 30,
}
SELF_REPORT_REVENUE = Decimal("1.20")
SELF_REPORT_EXPENSES = Decimal("0.90")

BAND_SHORT = {"Low Risk": "Low", "Moderate Risk": "Moderate", "High Risk": "High"}


def _pct(got, expected):
    if not expected:
        return "n/a" if got else "0.0%"
    return f"{(float(got) - float(expected)) / float(expected) * 100:+.1f}%"


def _score(revenue, expenses):
    revenue = Decimal(str(revenue))
    result = services.score({
        **BASELINE,
        "monthly_revenue_kes": float(revenue),
        "monthly_profit_kes": float(profit_from(revenue, expenses)),
    })
    return result["credit_score"], BAND_SHORT.get(result["risk_category"], result["risk_category"]), result["recommended_limit"]


class Command(BaseCommand):
    help = "Parse the test till statements, compare them with ground_truth.json, and score verified vs self-reported sales."

    def add_arguments(self, parser):
        parser.add_argument("folder", help="Folder with *_till_statement.pdf files and ground_truth.json")

    def handle(self, *args, **opts):
        folder = Path(opts["folder"])
        truth_path = folder / "ground_truth.json"
        if not truth_path.exists():
            raise CommandError(f"{truth_path} not found.")
        truth = {t["file"]: t for t in json.loads(truth_path.read_text(encoding="utf-8"))}
        files = sorted(folder.glob("*_till_statement.pdf"))
        if not files:
            raise CommandError(f"No *_till_statement.pdf files in {folder}.")

        parsed_rows, score_rows = [], []
        for path in files:
            t = truth.get(path.name)
            try:
                with path.open("rb") as fh:
                    parsed = parse_till_pdf(fh)
            except StatementError as exc:
                self.stderr.write(f"{path.name}: {exc.code}")
                continue
            s = summarise(parsed)
            checks = run_checks(parsed, s, today=parsed.period_end)
            problems = ",".join(c["code"] for c in checks if c["status"] == "fail") or "none"
            if t:
                parsed_rows.append((
                    path.name, _pct(s["avg_monthly_revenue"], t["avg_monthly_till_revenue"]),
                    _pct(s["till_payments"], t["till_payments"]), _pct(s["unique_customers"], t["unique_customers"]),
                    _pct(s["repeat_customer_share"], t["repeat_customer_share"]), problems,
                ))
                expenses = Decimal(str(t["suggested_monthly_expenses"]))
            else:
                parsed_rows.append((path.name, "no truth", "", "", "", problems))
                expenses = None

            if expenses is None:
                continue
            revenue = Decimal(s["avg_monthly_revenue"])
            a = _score(revenue, expenses)
            b = _score(revenue * SELF_REPORT_REVENUE, expenses * SELF_REPORT_EXPENSES)
            score_rows.append((
                path.name, t["expected_band"].capitalize(),
                f"{a[0]} {a[1]} {a[2]:,.0f}", f"{b[0]} {b[1]} {b[2]:,.0f}",
                f"{b[0] - a[0]:+d}", str(s["unique_customers"]), f"{s['repeat_customer_share'] * 100:.0f}%",
            ))

        self._table(
            "Parsed vs ground_truth.json (% difference)",
            ("file", "revenue", "payments", "unique cust.", "repeat share", "failed checks"),
            parsed_rows,
        )
        self.stdout.write("")
        self._table(
            "Scores: (a) verified from the till statement vs (b) self-reported (sales x1.20, costs x0.90). "
            "Each cell: score band limit (KES)",
            ("file", "expected", "(a) verified", "(b) self-reported", "b - a", "unique cust.", "repeat %"),
            score_rows,
        )

    def _table(self, title, head, rows):
        widths = [max(len(str(x)) for x in col) for col in zip(head, *rows)] if rows else [len(h) for h in head]
        line = lambda cells: "  ".join(str(c).ljust(w) for c, w in zip(cells, widths))  # noqa: E731
        self.stdout.write(title)
        self.stdout.write(line(head))
        self.stdout.write(line(["-" * w for w in widths]))
        for r in rows:
            self.stdout.write(line(r))
