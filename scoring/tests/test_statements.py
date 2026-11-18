"""Lipa na M-Pesa till statements: parser, summary, checks, upload endpoint and assessments that use them.

Fixtures: scoring/tests/fixtures/statements/ (10 test till statements + ground_truth.json; see its README).
Each fixture PDF is parsed once per test run (_parsed() caches at module level): pdfplumber is slow.
"""
import dataclasses
import hashlib
import io
import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from unittest import mock, skipUnless

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.testing import consenting_user

from scoring import services
from scoring.models import BusinessProfile, CreditAssessment, CreditRequest, StatementUpload
from scoring.statements import (
    StatementError, TillRow, categorise, customer_name, has_failures, parse_till_pdf, profit_from, run_checks,
    summarise,
)
from scoring.statements.categorise import OTHER_IN, OTHER_OUT, SALE, SWEEP

try:
    from pypdf import PdfReader, PdfWriter
    HAVE_PYPDF = True
except ImportError:  # test-only dependency (requirements-dev.txt)
    HAVE_PYPDF = False

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    HAVE_REPORTLAB = True
except ImportError:
    HAVE_REPORTLAB = False

User = get_user_model()

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "statements"
TRUTH = {t["file"]: t for t in json.loads((FIXTURES / "ground_truth.json").read_text(encoding="utf-8"))}
SMALLEST = "09_akinyi_cereals_till_statement.pdf"     # 8 pages: the cheapest one to upload for real
LAKESIDE = "04_lakeside_fish_traders_till_statement.pdf"
PASSWORD = "202611"

_PARSED = {}


def _parsed(name):
    """Parsed once per test run, then shared. Callers must not change the result (copy it first)."""
    if name not in _PARSED:
        with (FIXTURES / name).open("rb") as fh:
            _PARSED[name] = parse_till_pdf(fh)
    return _PARSED[name]


def _bytes(name):
    return (FIXTURES / name).read_bytes()


def _row(details, paid_in=0, withdrawn=0, balance=0, receipt="TST0000001"):
    return TillRow(receipt=receipt, completed_at=datetime(2026, 9, 1, 10, 0), details=details, status="Completed",
                   paid_in=Decimal(paid_in), withdrawn=Decimal(withdrawn), balance=Decimal(balance))


def _pdf_with_lines(lines):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = 800
    for line in lines:
        c.drawString(60, y, line)
        y -= 18
    c.showPage()
    c.save()
    return buf.getvalue()


class FixtureParseTests(SimpleTestCase):
    """All 10 fixtures against ground_truth.json."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.results = {}
        for name in sorted(TRUTH):
            p = _parsed(name)
            cls.results[name] = (p, summarise(p))

    def test_all_ten_fixtures_parse(self):
        self.assertEqual(len(self.results), 10)
        for name, (p, _) in self.results.items():
            t = TRUTH[name]
            with self.subTest(name):
                self.assertEqual(p.organisation_name, t["organisation_name"])
                self.assertEqual(p.shortcode, t["shortcode"])
                self.assertEqual([p.period_start.isoformat(), p.period_end.isoformat()], t["period"])
                self.assertEqual(p.days, t["days"])
                self.assertEqual(p.skipped_rows, 0)

    def test_transactions_and_payments_match_exactly(self):
        for name, (p, s) in self.results.items():
            t = TRUTH[name]
            with self.subTest(name):
                self.assertEqual(len(p.rows), t["till_transactions"])
                self.assertEqual(s["transactions_count"], t["till_transactions"])
                self.assertEqual(s["till_payments"], t["till_payments"])

    def test_revenue_customers_repeat_share_and_sweeps(self):
        for name, (_, s) in self.results.items():
            t = TRUTH[name]
            with self.subTest(name):
                expected = t["avg_monthly_till_revenue"]
                self.assertLessEqual(abs(s["avg_monthly_revenue"] - expected) / expected, 0.005)
                self.assertEqual(s["unique_customers"], t["unique_customers"])
                self.assertAlmostEqual(s["repeat_customer_share"], t["repeat_customer_share"], delta=0.01)
                self.assertEqual(s["flags"]["sweeps_total"], t["till_sweeps_total"])
                self.assertEqual(s["avg_ticket"], t["avg_ticket"])

    def test_sweeps_are_not_revenue(self):
        for name, (p, s) in self.results.items():
            t = TRUTH[name]
            with self.subTest(name):
                total_paid_in = sum(r.paid_in for r in p.rows)
                self.assertEqual(s["revenue_total"], t["till_revenue_total"])
                # The sweeps move the owner's own money out; they never count as sales.
                self.assertGreater(s["flags"]["sweeps_total"], 0)
                self.assertEqual(Decimal(s["revenue_total"]), total_paid_in)  # every paid-in row here is a sale
                self.assertEqual(s["flags"]["other_in_total"], 0)
                self.assertEqual(s["flags"]["other_out_total"], 0)

    def test_rows_are_oldest_first_and_checks_pass(self):
        for name, (p, s) in self.results.items():
            with self.subTest(name):
                self.assertLessEqual(p.rows[0].completed_at, p.rows[-1].completed_at)
                checks = {c["code"]: c["status"] for c in run_checks(
                    p, s, owner_name=TRUTH[name]["organisation_name"], today=p.period_end)}
                self.assertTrue(all(v == "pass" for v in checks.values()), checks)

    def test_monthly_breakdown_adds_up(self):
        _, s = self.results[LAKESIDE]
        self.assertEqual([m["month"] for m in s["monthly_breakdown"]], ["2026-08", "2026-09", "2026-10", "2026-11"])
        self.assertEqual(sum(m["payments"] for m in s["monthly_breakdown"]), s["till_payments"])
        self.assertEqual(sum(m["sales"] for m in s["monthly_breakdown"]), s["revenue_total"])

    def test_high_risk_fixtures_show_falling_sales(self):
        for name, (_, s) in self.results.items():
            if TRUTH[name]["expected_band"] == "high":
                with self.subTest(name):
                    self.assertLess(s["flags"]["revenue_trend_pct"], 0)
                    self.assertGreater(s["flags"]["zero_sale_days"], 0)

    def test_tampered_balance_fails_the_chain(self):
        original = _parsed(LAKESIDE)
        rows = list(original.rows)
        rows[100] = dataclasses.replace(rows[100], balance=rows[100].balance + Decimal("500"))
        tampered = dataclasses.replace(original, rows=rows)
        checks = {c["code"]: c for c in run_checks(tampered, summarise(tampered), today=tampered.period_end)}
        self.assertEqual(checks["balance_chain"]["status"], "fail")
        self.assertIn(rows[100].receipt, checks["balance_chain"]["message"])

    def test_duplicate_receipt_fails(self):
        original = _parsed(LAKESIDE)
        rows = list(original.rows)
        rows[10] = dataclasses.replace(rows[10], receipt=rows[9].receipt)
        dup = dataclasses.replace(original, rows=rows)
        checks = {c["code"]: c["status"] for c in run_checks(dup, summarise(dup), today=dup.period_end)}
        self.assertEqual(checks["duplicate_receipts"], "fail")


class CheckRuleTests(SimpleTestCase):
    def setUp(self):
        self.p = _parsed(LAKESIDE)
        self.s = summarise(self.p)

    def statuses(self, **kwargs):
        kwargs.setdefault("today", self.p.period_end)
        return {c["code"]: c["status"] for c in run_checks(self.p, self.s, **kwargs)}

    def test_short_period_fails(self):
        with override_settings(STATEMENT_MIN_DAYS=100):
            self.assertEqual(self.statuses()["min_period"], "fail")
        self.assertEqual(self.statuses()["min_period"], "pass")

    def test_old_statement_warns(self):
        self.assertEqual(self.statuses(today=date(2027, 1, 30))["recency"], "warn")

    def test_identity_warns_and_strict_mode_fails(self):
        s = self.statuses(owner_name="Jane Doe", business_name="Other Shop", saved_till="9900999")
        self.assertEqual((s["name_match"], s["till_number_match"]), ("warn", "warn"))
        with override_settings(STATEMENT_STRICT_IDENTITY=True):
            s = self.statuses(owner_name="Jane Doe", business_name="Other Shop", saved_till="9900999")
            self.assertEqual((s["name_match"], s["till_number_match"]), ("fail", "fail"))
        s = self.statuses(owner_name="Peter Ochieng", saved_till="9900104")
        self.assertEqual((s["name_match"], s["till_number_match"]), ("pass", "pass"))
        # Business name words count too, but not filler like "traders".
        self.assertEqual(self.statuses(business_name="Otieno Fish")["name_match"], "pass")
        self.assertEqual(self.statuses(business_name="Lake Traders")["name_match"], "warn")

    def test_no_sales_fails(self):
        empty = dataclasses.replace(self.p, rows=[r for r in self.p.rows if categorise(r) != SALE])
        statuses = {c["code"]: c["status"] for c in run_checks(empty, summarise(empty), today=empty.period_end)}
        self.assertEqual(statuses["no_sales"], "fail")


class CategoriseTests(SimpleTestCase):
    def test_rules(self):
        self.assertEqual(categorise(_row("Merchant Payment from - 2547******672 MARY MWANGI", 960)), SALE)
        self.assertEqual(categorise(_row("merchant payment online from - 07******672 MARY MWANGI", 960)), SALE)
        self.assertEqual(categorise(_row("Merchant Account to Customer Account Transfer to - 2547******104 X", 0, 3770)), SWEEP)
        self.assertEqual(categorise(_row("Reversal of Merchant Payment", 500)), OTHER_IN)
        self.assertEqual(categorise(_row("Pay Bill to 123456 - SUPPLIER", 0, 500)), OTHER_OUT)

    def test_customer_name_ignores_the_number_format(self):
        app = _row("Merchant Payment from - 2547******672 Mary  Mwangi", 960)
        online = _row("Merchant Payment Online from - 07******123 MARY MWANGI", 960)
        self.assertEqual(customer_name(app), "MARY MWANGI")
        self.assertEqual(customer_name(app), customer_name(online))

    def test_profit_never_negative(self):
        self.assertEqual(profit_from(107530, 96000), Decimal("11530"))
        self.assertEqual(profit_from(30030, 36000), Decimal("0"))


@skipUnless(HAVE_REPORTLAB, "reportlab is not installed")
class WrongDocumentTests(SimpleTestCase):
    def test_personal_statement_is_refused(self):
        pdf = _pdf_with_lines(["M-PESA STATEMENT", "Customer Name: Jane Test", "Mobile Number: 0712000000",
                               "Statement Period: 01 Aug 2026 - 31 Oct 2026"])
        with self.assertRaises(StatementError) as ctx:
            parse_till_pdf(io.BytesIO(pdf))
        self.assertEqual(ctx.exception.code, "personal_statement_not_supported")

    def test_other_pdf_is_unknown_format(self):
        with self.assertRaises(StatementError) as ctx:
            parse_till_pdf(io.BytesIO(_pdf_with_lines(["Invoice 123", "Total: 5,000.00"])))
        self.assertEqual(ctx.exception.code, "unknown_format")

    def test_not_a_pdf_is_unreadable(self):
        with self.assertRaises(StatementError) as ctx:
            parse_till_pdf(io.BytesIO(b"%PDF-1.4 this is not really a pdf"))
        self.assertEqual(ctx.exception.code, "unreadable")


def _make_business(user, name="Akinyi Cereals", **extra):
    return BusinessProfile.objects.create(
        user=user, business_name=name, sector="Retail", business_age_years=4, legal_status="Sole",
        location_type="Urban", employees_count=3, county="Busia", **extra,
    )


class UploadEndpointTests(TestCase):
    url = "/api/statements/upload/"

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = consenting_user(username="lucy", email="lucy@test.ke", password="x", role="owner",
                                              full_name="Lucy Akinyi")
        self.other = consenting_user(username="kev", email="kev@test.ke", password="x", role="owner")
        self.business = _make_business(self.owner)
        self.client.force_authenticate(self.owner)

    def upload(self, content, name=SMALLEST, **fields):
        data = {"business_id": self.business.pk, "consent": "true", **fields,
                "file": SimpleUploadedFile(name, content, content_type="application/pdf")}
        return self.client.post(self.url, data, format="multipart")

    def test_valid_statement_then_the_same_file_again(self):
        content = _bytes(SMALLEST)
        res = self.upload(content)
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        t = TRUTH[SMALLEST]
        self.assertEqual(body["status"], "accepted")
        self.assertEqual(body["shortcode"], t["shortcode"])
        self.assertEqual(body["till_payments"], t["till_payments"])
        self.assertEqual(body["unique_customers"], t["unique_customers"])
        self.assertEqual(body["avg_monthly_revenue"], t["avg_monthly_till_revenue"])
        self.assertEqual([body["period_start"], body["period_end"]], t["period"])
        self.assertIn("revenue_trend_pct", body["flags"])
        self.assertTrue({c["code"] for c in body["checks"]} >= {"balance_chain", "name_match"})

        stored = StatementUpload.objects.get()
        self.assertEqual(stored.file_sha256, hashlib.sha256(content).hexdigest())
        self.assertIsNotNone(stored.consent_given_at)
        # The first accepted statement fills in the till number.
        self.business.refresh_from_db()
        self.assertEqual(self.business.till_number, t["shortcode"])

        again = self.upload(content)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()["id"], body["id"])
        self.assertEqual(StatementUpload.objects.count(), 1)

        # Owner can read it back; another owner cannot; an analyst can.
        self.assertEqual(self.client.get(f"/api/statements/{body['id']}/").status_code, 200)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/statements/{body['id']}/").status_code, 404)
        analyst = consenting_user(username="an", email="an@test.ke", password="x", role="analyst")
        self.client.force_authenticate(analyst)
        self.assertEqual(self.client.get(f"/api/statements/{body['id']}/").status_code, 200)

    def test_saved_till_number_is_not_overwritten(self):
        self.business.till_number = "123456"
        self.business.save()
        with mock.patch("scoring.statement_views.parse_till_pdf", return_value=_parsed(SMALLEST)):
            res = self.upload(b"%PDF-1.4 stand-in")
        self.assertEqual(res.status_code, 201, res.content)
        checks = {c["code"]: c["status"] for c in res.json()["checks"]}
        self.assertEqual(checks["till_number_match"], "warn")
        self.business.refresh_from_db()
        self.assertEqual(self.business.till_number, "123456")

    def test_not_a_pdf(self):
        res = self.upload(b"hello, this is a text file", name="notes.pdf")
        self.assertEqual((res.status_code, res.json()["code"]), (400, "unreadable"))
        self.assertEqual(StatementUpload.objects.count(), 0)

    def test_consent_is_required(self):
        for consent in ("false", ""):
            res = self.upload(b"%PDF-1.4", consent=consent)
            self.assertEqual((res.status_code, res.json()["code"]), (400, "consent_required"))

    def test_other_owners_business_is_404(self):
        theirs = _make_business(self.other, name="Their Shop")
        res = self.upload(b"%PDF-1.4", business_id=theirs.pk)
        self.assertEqual(res.status_code, 404)

    def test_staff_cannot_upload(self):
        analyst = consenting_user(username="an2", email="an2@test.ke", password="x", role="analyst")
        self.client.force_authenticate(analyst)
        self.assertEqual(self.upload(b"%PDF-1.4").status_code, 403)

    @override_settings(STATEMENT_MAX_BYTES=1000)
    def test_too_large(self):
        res = self.upload(b"%PDF-1.4" + b"0" * 2000)
        self.assertEqual((res.status_code, res.json()["code"]), (400, "file_too_large"))

    @override_settings(STATEMENT_MIN_DAYS=100)
    def test_failed_check_is_saved_as_rejected(self):
        with mock.patch("scoring.statement_views.parse_till_pdf", return_value=_parsed(SMALLEST)):
            res = self.upload(b"%PDF-1.4 stand-in")
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertEqual(body["code"], "statement_rejected")
        self.assertIn("fail", {c["status"] for c in body["checks"] if c["code"] == "min_period"})
        stored = StatementUpload.objects.get()
        self.assertEqual(stored.status, "rejected")
        self.assertIn("at least 100 days", stored.rejection_reason)
        self.business.refresh_from_db()
        self.assertEqual(self.business.till_number, "")

    def test_parser_error_codes_pass_through(self):
        for code in ("personal_statement_not_supported", "unknown_format", "too_many_pages"):
            with mock.patch("scoring.statement_views.parse_till_pdf", side_effect=StatementError(code)):
                res = self.upload(b"%PDF-1.4 stand-in " + code.encode())
            self.assertEqual((res.status_code, res.json()["code"]), (400, code))

    @skipUnless(HAVE_PYPDF, "pypdf is not installed")
    def test_password_protected_statement(self):
        writer = PdfWriter(clone_from=PdfReader(io.BytesIO(_bytes(SMALLEST))))
        writer.encrypt(user_password=PASSWORD, owner_password=None, algorithm="AES-128")
        buf = io.BytesIO()
        writer.write(buf)
        locked = buf.getvalue()

        res = self.upload(locked)
        self.assertEqual((res.status_code, res.json()["code"]), (400, "password_required"))
        res = self.upload(locked, password="000000")
        self.assertEqual((res.status_code, res.json()["code"]), (400, "wrong_password"))
        res = self.upload(locked, password=PASSWORD)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["till_payments"], TRUTH[SMALLEST]["till_payments"])


def _accepted_statement(user, business, name=LAKESIDE, status=StatementUpload.ACCEPTED):
    """A stored statement built from the cached parse (no upload, no second parse)."""
    p = _parsed(name)
    s = summarise(p)
    return StatementUpload.objects.create(
        user=user, business=business, file_sha256=hashlib.sha256(name.encode()).hexdigest(),
        organisation_name=p.organisation_name, shortcode=p.shortcode, period_start=p.period_start,
        period_end=p.period_end, transactions_count=s["transactions_count"], skipped_rows=p.skipped_rows,
        avg_monthly_revenue=s["avg_monthly_revenue"], till_payments=s["till_payments"],
        unique_customers=s["unique_customers"], repeat_customer_share=s["repeat_customer_share"],
        avg_ticket=s["avg_ticket"], monthly_breakdown=s["monthly_breakdown"], flags=s["flags"],
        checks=run_checks(p, s, today=p.period_end), status=status, consent_given_at=timezone.now(),
    )


# Answers for everything else, as the form sends them. Revenue is deliberately NOT the statement's figure.
FORM = {
    "county": "Kisumu", "sector": "Retail", "legal_status": "Sole", "location_type": "Urban",
    "loan_purpose": "Working capital", "business_age_years": 4, "employees_count": 3,
    "monthly_revenue_kes": 999_999, "monthly_profit_kes": 500_000, "loan_amount": 100_000, "tenure_months": 12,
    "existing_loans": False, "prior_loan_count": 0, "late_payment_history": "Never", "collateral_level": "Moderate",
    "cashflow_stability": 3, "owner_education": "Secondary", "days_payable_outstanding": 30,
}


class AssessmentWithStatementTests(TestCase):
    url = "/api/scoring/assess/"

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = consenting_user(username="peter", email="peter@test.ke", password="x", role="owner",
                                              full_name="Peter Ochieng")
        self.other = consenting_user(username="kev2", email="kev2@test.ke", password="x", role="owner")
        self.business = _make_business(self.owner, name="Lakeside Fish Traders")
        self.statement = _accepted_statement(self.owner, self.business)
        self.client.force_authenticate(self.owner)

    def submit(self, **extra):
        return self.client.post(self.url, {**FORM, "business_id": self.business.pk, **extra}, format="json")

    def test_statement_revenue_replaces_the_form_value(self):
        res = self.submit(till_statement_id=self.statement.pk, monthly_expenses_kes=96_000)
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(body["revenue_source"], "till_statement")
        self.assertEqual(body["monthly_revenue"], 107_530)
        self.assertEqual(body["monthly_expenses"], 96_000)
        self.assertEqual(body["till_statement"]["shortcode"], "9900104")
        self.assertEqual(body["till_statement"]["unique_customers"], 111)

        req = CreditRequest.objects.get()
        self.assertEqual(req.revenue_source, "till_statement")
        self.assertEqual(req.till_statement_id, self.statement.pk)
        self.assertEqual(req.monthly_revenue_kes, Decimal("107530"))
        self.assertEqual(req.monthly_expenses_kes, Decimal("96000"))
        self.assertEqual(req.monthly_profit_kes, Decimal("11530"))

        # Scored on the statement's revenue and revenue - expenses, not on what the client sent.
        expected = services.score({**FORM, "loan_amount_kes": 100_000, "monthly_revenue_kes": 107_530,
                                   "monthly_profit_kes": 11_530})
        self.assertEqual(CreditAssessment.objects.get().credit_score, expected["credit_score"])

        # Shown to analysts too, with the detail they need.
        analyst = consenting_user(username="an3", email="an3@test.ke", password="x", role="analyst")
        self.client.force_authenticate(analyst)
        detail = self.client.get(f"/api/scoring/assessments/{body['pk']}/").json()
        self.assertEqual(detail["till_statement"]["monthly_breakdown"][0]["month"], "2026-08")
        self.assertEqual(detail["request"]["monthly_expenses_kes"], 96_000)

    def test_without_statement_nothing_changes(self):
        res = self.submit(monthly_revenue_kes=300_000, monthly_profit_kes=60_000, monthly_expenses_kes=1)
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(body["revenue_source"], "self_reported")
        self.assertIsNone(body["till_statement"])
        self.assertIsNone(body["monthly_expenses"])
        req = CreditRequest.objects.get()
        self.assertEqual((req.monthly_revenue_kes, req.monthly_profit_kes), (Decimal("300000"), Decimal("60000")))
        self.assertIsNone(req.monthly_expenses_kes)

    def test_client_cannot_set_the_source_itself(self):
        res = self.submit(monthly_revenue_kes=300_000, monthly_profit_kes=60_000,
                          revenue_source="till_statement", till_statement=self.statement.pk)
        self.assertEqual(res.status_code, 201, res.content)
        req = CreditRequest.objects.get()
        self.assertEqual(req.revenue_source, "self_reported")
        self.assertIsNone(req.till_statement_id)

    def test_expenses_above_revenue_score_with_zero_profit(self):
        res = self.submit(till_statement_id=self.statement.pk, monthly_expenses_kes=150_000)
        self.assertEqual(res.status_code, 201, res.content)
        req = CreditRequest.objects.get()
        self.assertEqual(req.monthly_profit_kes, Decimal("0"))
        self.assertEqual(req.monthly_expenses_kes, Decimal("150000"))
        self.assertEqual(res.json()["recommended_limit"], 0)

    def test_statement_that_cannot_be_used_is_400(self):
        theirs_business = _make_business(self.other, name="Their Fish")
        theirs = _accepted_statement(self.other, theirs_business)
        rejected = _accepted_statement(self.owner, self.business, status=StatementUpload.REJECTED)
        second_business = _make_business(self.owner, name="Peter Second Shop")
        cases = {
            "another owner's": theirs.pk,
            "rejected": rejected.pk,
            "missing": 999_999,
            "not a number": "abc",
        }
        for label, sid in cases.items():
            with self.subTest(label):
                res = self.submit(till_statement_id=sid, monthly_expenses_kes=96_000)
                self.assertEqual(res.status_code, 400)
                self.assertIn("till_statement_id", res.json())
        with self.subTest("another of the owner's businesses"):
            res = self.submit(till_statement_id=self.statement.pk, monthly_expenses_kes=96_000,
                              business_id=second_business.pk)
            self.assertEqual(res.status_code, 400)
        with self.subTest("a new business"):
            res = self.client.post(self.url, {**FORM, "business_name": "Brand New", "till_statement_id": self.statement.pk,
                                              "monthly_expenses_kes": 96_000}, format="json")
            self.assertEqual(res.status_code, 400)
        self.assertEqual(CreditRequest.objects.count(), 0)

    def test_expenses_are_required_with_a_statement(self):
        for bad in (None, "", "-5", "lots"):
            with self.subTest(bad):
                payload = {"till_statement_id": self.statement.pk}
                if bad is not None:
                    payload["monthly_expenses_kes"] = bad
                res = self.submit(**payload)
                self.assertEqual(res.status_code, 400)
                self.assertIn("monthly_expenses_kes", res.json())

    def test_statement_cannot_be_deleted_while_used(self):
        from django.db.models import ProtectedError
        self.assertEqual(self.submit(till_statement_id=self.statement.pk, monthly_expenses_kes=96_000).status_code, 201)
        with self.assertRaises(ProtectedError):
            self.statement.delete()


class TillNumberProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = consenting_user(username="tn", email="tn@test.ke", password="x", role="owner")
        self.business = _make_business(self.owner)
        self.client.force_authenticate(self.owner)

    def test_owner_edits_till_number(self):
        url = f"/api/scoring/businesses/{self.business.pk}/"
        self.assertEqual(self.client.patch(url, {"till_number": "9900109"}, format="json").status_code, 200)
        self.business.refresh_from_db()
        self.assertEqual(self.business.till_number, "9900109")
        for bad in ("12AB56", "1234", "12345678"):
            with self.subTest(bad):
                self.assertEqual(self.client.patch(url, {"till_number": bad}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(url, {"till_number": ""}, format="json").status_code, 200)
        self.business.refresh_from_db()
        self.assertEqual(self.business.till_number, "")
