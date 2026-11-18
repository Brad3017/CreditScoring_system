"""Consent and privacy (Data Protection Act 2019 s.32 and s.35; General Regulations 2021 reg. 4).
Run with: python manage.py test accounts.tests.test_consent --keepdb
"""
from types import SimpleNamespace
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from accounts import consent_texts as texts
from accounts.consent import grant, has_consent, missing_required
from accounts.models import ConsentRecord
from accounts.testing import consenting_user
from scoring.models import BusinessProfile, CreditAssessment, CreditRequest, StatementUpload

User = get_user_model()

SIGNUP = "/api/auth/signup/"
ME = "/api/auth/me/"
CONSENTS = "/api/consents/"
ASSESS = "/api/scoring/assess/"
QUEUE = "/api/scoring/assessments/all/"
MINE = "/api/scoring/assessments/"

FORM = {
    "business_name": "Mama Mboga", "kra_pin": "P051234567Q",
    "county": "Kisumu", "sector": "Retail", "legal_status": "Sole", "location_type": "Urban",
    "loan_purpose": "Working capital", "business_age_years": 4, "employees_count": 3,
    "monthly_revenue_kes": 120_000, "monthly_profit_kes": 30_000, "loan_amount": 100_000, "tenure_months": 12,
    "existing_loans": False, "prior_loan_count": 0, "late_payment_history": "Never", "collateral_level": "Moderate",
    "cashflow_stability": 3, "owner_education": "Secondary", "days_payable_outstanding": 30,
}


def bare_user(name, role="owner"):
    """A user with NO consent records (like every account that existed before this feature)."""
    return User.objects.create_user(username=name, email=f"{name}@test.ke", password="x", role=role)


def make_assessment(owner):
    req = CreditRequest.objects.create(user=owner, business_name="Biz", monthly_profit_kes=1000)
    return CreditAssessment.objects.create(
        request=req, probability_of_default=0.2, credit_score=700, risk_category="Low Risk",
        recommended_limit=50_000, shap_explanation="", shap_values=[], model_version="xgb_msme_v3",
    )


class SignupConsentTests(TestCase):
    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")

    def body(self, **extra):
        return {"email": "new@test.ke", "password": "Secret-123", "full_name": "New Owner", **extra}

    def test_signup_without_privacy_notice_is_400(self):
        res = self.client.post(SIGNUP, self.body(), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("privacy_notice_accepted", res.json())
        res = self.client.post(SIGNUP, self.body(privacy_notice_accepted=False), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(email="new@test.ke").exists())

    def test_signup_records_privacy_notice_with_ip_and_version(self):
        res = self.client.post(SIGNUP, self.body(privacy_notice_accepted=True), format="json",
                               REMOTE_ADDR="10.0.0.5", HTTP_USER_AGENT="TestBrowser/1.0")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["missing_consents"], [])
        user = User.objects.get(email="new@test.ke")
        rec = ConsentRecord.objects.get(user=user, purpose="privacy_notice")
        self.assertEqual((rec.version, rec.ip_address, rec.user_agent), (texts.CONSENT_VERSION, "10.0.0.5", "TestBrowser/1.0"))
        self.assertIsNone(rec.withdrawn_at)
        # The optional email updates were not ticked: no record.
        self.assertFalse(ConsentRecord.objects.filter(user=user, purpose="communications").exists())

    def test_signup_communications_opt_in(self):
        res = self.client.post(SIGNUP, self.body(privacy_notice_accepted=True, communications_opt_in=True), format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(has_consent(User.objects.get(email="new@test.ke"), "communications"))


class OwnerGateTests(TestCase):
    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = bare_user("gate")
        self.client.force_authenticate(self.owner)

    def test_protected_owner_endpoint_is_403_without_privacy_notice(self):
        res = self.client.get("/api/scoring/businesses/")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["code"], "consent_required")
        self.assertEqual(res.json()["purposes"], ["privacy_notice"])

    def test_me_and_consent_endpoints_still_work(self):
        me = self.client.get(ME)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["missing_consents"], ["privacy_notice"])
        overview = self.client.get(CONSENTS)
        self.assertEqual(overview.status_code, 200)
        self.assertEqual({c["purpose"] for c in overview.json()["consents"]},
                         {"privacy_notice", "credit_scoring", "statement_processing", "communications"})
        self.assertEqual(APIClient(HTTP_HOST="localhost").get("/api/consents/texts/").status_code, 200)  # public
        self.assertEqual(self.client.post(CONSENTS, {"purpose": "privacy_notice"}, format="json").status_code, 201)
        self.assertEqual(self.client.get(ME).json()["missing_consents"], [])
        self.assertEqual(self.client.get("/api/scoring/businesses/").status_code, 200)

    def test_grant_rejects_statement_processing_and_other_roles_purposes(self):
        for purpose in ("statement_processing", "staff_confidentiality", "nonsense"):
            res = self.client.post(CONSENTS, {"purpose": purpose}, format="json")
            self.assertEqual(res.status_code, 400, purpose)
        self.assertFalse(ConsentRecord.objects.filter(user=self.owner).exists())


class StaffGateTests(TestCase):
    def test_analyst_needs_confidentiality_then_200(self):
        client = APIClient(HTTP_HOST="localhost")
        analyst = bare_user("an", role="analyst")
        client.force_authenticate(analyst)
        res = client.get(QUEUE)
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json(), {"code": "consent_required", "purposes": ["staff_confidentiality"],
                                      "detail": "Please accept the staff confidentiality agreement to continue."})
        self.assertEqual(client.get(ME).json()["missing_consents"], ["staff_confidentiality"])
        self.assertEqual(client.post(CONSENTS, {"purpose": "privacy_notice"}, format="json").status_code, 400)
        self.assertEqual(client.post(CONSENTS, {"purpose": "staff_confidentiality"}, format="json").status_code, 201)
        self.assertEqual(client.get(QUEUE).status_code, 200)

    def test_admin_endpoints_need_confidentiality(self):
        client = APIClient(HTTP_HOST="localhost")
        admin = bare_user("adm", role="admin")
        client.force_authenticate(admin)
        self.assertEqual(client.get("/api/auth/admin/users/").status_code, 403)
        grant(admin, "staff_confidentiality")
        self.assertEqual(client.get("/api/auth/admin/users/").status_code, 200)


class CreditScoringConsentTests(TestCase):
    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = bare_user("cs")
        grant(self.owner, "privacy_notice")
        self.client.force_authenticate(self.owner)
        self.analyst = consenting_user(username="rev", email="rev@test.ke", password="x", role="analyst")
        self.staff = APIClient(HTTP_HOST="localhost")
        self.staff.force_authenticate(self.analyst)

    def test_assessment_creation_needs_credit_scoring(self):
        res = self.client.post(ASSESS, FORM, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["code"], "consent_required")
        self.assertEqual(res.json()["purposes"], ["credit_scoring"])
        self.assertFalse(CreditAssessment.objects.exists())
        self.assertEqual(self.client.post(CONSENTS, {"purpose": "credit_scoring"}, format="json").status_code, 201)
        res = self.client.post(ASSESS, FORM, format="json")
        self.assertEqual(res.status_code, 201, res.content)

    def test_withdrawal_blocks_new_assessments_and_approval_but_not_viewing_or_decline(self):
        grant(self.owner, "credit_scoring")
        old = make_assessment(self.owner)
        other = make_assessment(self.owner)
        res = self.client.post(f"{CONSENTS}credit_scoring/withdraw/")
        self.assertEqual(res.status_code, 200, res.content)
        row = next(c for c in res.json()["consents"] if c["purpose"] == "credit_scoring")
        self.assertFalse(row["active"])
        self.assertIsNotNone(row["withdrawn_at"])

        self.assertEqual(self.client.post(ASSESS, FORM, format="json").status_code, 403)
        mine = self.client.get(MINE)
        self.assertEqual(mine.status_code, 200)
        self.assertEqual({a["pk"] for a in mine.json()}, {old.pk, other.pk})

        detail = self.staff.get(f"/api/scoring/assessments/{old.pk}/").json()
        self.assertEqual(detail["consent_block"]["code"], "consent_withdrawn")
        res = self.staff.post(f"/api/scoring/assessments/{old.pk}/review/", {"decision": "approved"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "consent_withdrawn")
        self.assertRegex(res.json()["detail"],
                         r"^The owner withdrew consent for credit scoring on \d{2} \w{3} \d{4}\. This application can't be approved\.$")
        old.refresh_from_db()
        self.assertEqual(old.review_status, "pending")
        res = self.staff.post(f"/api/scoring/assessments/{other.pk}/review/",
                              {"decision": "declined", "note": "Owner withdrew consent."}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        res = self.staff.post(f"/api/scoring/assessments/{old.pk}/review/",
                              {"decision": "referred", "note": "Waiting for the owner."}, format="json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_approval_allowed_with_active_consent(self):
        grant(self.owner, "credit_scoring")
        a = make_assessment(self.owner)
        self.assertIsNone(self.staff.get(f"/api/scoring/assessments/{a.pk}/").json()["consent_block"])
        res = self.staff.post(f"/api/scoring/assessments/{a.pk}/review/", {"decision": "approved"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_approval_blocked_when_never_given(self):
        a = make_assessment(self.owner)
        res = self.staff.post(f"/api/scoring/assessments/{a.pk}/review/", {"decision": "approved"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "consent_missing")


class WithdrawRulesTests(TestCase):
    def test_privacy_notice_and_staff_confidentiality_cannot_be_withdrawn(self):
        client = APIClient(HTTP_HOST="localhost")
        owner = consenting_user(username="w1", email="w1@test.ke", password="x", role="owner")
        client.force_authenticate(owner)
        res = client.post(f"{CONSENTS}privacy_notice/withdraw/")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "not_withdrawable")
        self.assertTrue(has_consent(owner, "privacy_notice"))

        analyst = consenting_user(username="w2", email="w2@test.ke", password="x", role="analyst")
        client.force_authenticate(analyst)
        self.assertEqual(client.post(f"{CONSENTS}staff_confidentiality/withdraw/").status_code, 400)
        self.assertTrue(has_consent(analyst, "staff_confidentiality"))

    def test_communications_toggle(self):
        client = APIClient(HTTP_HOST="localhost")
        owner = consenting_user(username="w3", email="w3@test.ke", password="x", role="owner")
        client.force_authenticate(owner)
        self.assertEqual(client.post(CONSENTS, {"purpose": "communications"}, format="json").status_code, 201)
        self.assertTrue(has_consent(owner, "communications"))
        self.assertEqual(client.post(f"{CONSENTS}communications/withdraw/").status_code, 200)
        self.assertFalse(has_consent(owner, "communications"))
        self.assertEqual(client.post(f"{CONSENTS}communications/withdraw/").status_code, 400)  # nothing active


class VersionBumpTests(TestCase):
    def test_new_version_asks_again(self):
        owner = consenting_user(username="vb", email="vb@test.ke", password="x", role="owner")
        client = APIClient(HTTP_HOST="localhost")
        client.force_authenticate(owner)
        self.assertTrue(has_consent(owner, "privacy_notice"))
        with mock.patch.object(texts, "CONSENT_VERSION", "1.1"):
            self.assertFalse(has_consent(owner, "privacy_notice"))
            self.assertEqual(missing_required(owner), ["privacy_notice"])
            self.assertEqual(client.get(ME).json()["missing_consents"], ["privacy_notice"])
            self.assertEqual(client.get("/api/scoring/businesses/").status_code, 403)
            self.assertEqual(client.post(CONSENTS, {"purpose": "privacy_notice"}, format="json").status_code, 201)
            self.assertTrue(has_consent(owner, "privacy_notice"))
        self.assertEqual(
            list(ConsentRecord.objects.filter(user=owner, purpose="privacy_notice").order_by("id").values_list("version", flat=True)),
            [texts.CONSENT_VERSION, "1.1"],
        )


class StatementConsentRecordTests(TestCase):
    def test_upload_writes_statement_processing_record(self):
        owner = consenting_user(username="st", email="st@test.ke", password="x", role="owner", full_name="Peter Ochieng")
        business = BusinessProfile.objects.create(
            user=owner, business_name="Lakeside Fish Traders", sector="Retail", business_age_years=4,
            legal_status="Sole", location_type="Urban", employees_count=3, county="Kisumu",
        )
        client = APIClient(HTTP_HOST="localhost")
        client.force_authenticate(owner)
        from datetime import date
        parsed = SimpleNamespace(organisation_name="LAKESIDE FISH TRADERS", shortcode="9900104",
                                 period_start=date(2026, 8, 17), period_end=date(2026, 11, 16), skipped_rows=0)
        summary = {"transactions_count": 10, "avg_monthly_revenue": 100_000, "till_payments": 10,
                   "unique_customers": 5, "repeat_customer_share": 0.5, "avg_ticket": 1000,
                   "monthly_breakdown": [], "flags": {}}
        checks = [{"code": "balance_chain", "status": "pass", "message": "ok"}]
        with mock.patch("scoring.statement_views.parse_till_pdf", return_value=parsed), \
                mock.patch("scoring.statement_views.summarise", return_value=summary), \
                mock.patch("scoring.statement_views.run_checks", return_value=checks):
            res = client.post("/api/statements/upload/", {
                "file": SimpleUploadedFile("s.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
                "business_id": business.pk, "consent": "true",
            }, format="multipart", REMOTE_ADDR="10.1.2.3")
        self.assertEqual(res.status_code, 201, res.content)
        upload = StatementUpload.objects.get()
        rec = ConsentRecord.objects.get(user=owner, purpose="statement_processing")
        self.assertEqual((rec.reference, rec.version, rec.ip_address), (str(upload.id), texts.CONSENT_VERSION, "10.1.2.3"))


class RequestReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = consenting_user(username="rr", email="rr@test.ke", password="x", role="owner")
        self.other = consenting_user(username="rx", email="rx@test.ke", password="x", role="owner")
        self.a = make_assessment(self.owner)
        self.client.force_authenticate(self.owner)

    def url(self, pk):
        return f"/api/scoring/assessments/{pk}/request-review/"

    def test_request_review_flow(self):
        res = self.client.post(self.url(self.a.pk), {"reason": "My sales are higher than the form shows."}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertIsNotNone(body["review_requested_at"])
        self.assertEqual(body["review_request_reason"], "My sales are higher than the form shows.")
        self.assertFalse(body["review_resolved"])
        # A second request while the first is unresolved.
        res = self.client.post(self.url(self.a.pk), {"reason": "Again"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "review_already_requested")

        # The analyst decides: resolved, and the request is kept.
        analyst = consenting_user(username="ra", email="ra@test.ke", password="x", role="analyst")
        staff = APIClient(HTTP_HOST="localhost")
        staff.force_authenticate(analyst)
        queue_row = next(r for r in staff.get(QUEUE).json() if r["pk"] == self.a.pk)
        self.assertIsNotNone(queue_row["review_requested_at"])
        staff.post(f"/api/scoring/assessments/{self.a.pk}/review/",
                   {"decision": "referred", "note": "Checked the figures."}, format="json")
        row = next(r for r in self.client.get(MINE).json() if r["pk"] == self.a.pk)
        self.assertTrue(row["review_resolved"])
        self.assertEqual(row["review_request_reason"], "My sales are higher than the form shows.")

    def test_someone_elses_assessment_is_404(self):
        theirs = make_assessment(self.other)
        res = self.client.post(self.url(theirs.pk), {"reason": "Please"}, format="json")
        self.assertEqual(res.status_code, 404)
        theirs.refresh_from_db()
        self.assertIsNone(theirs.review_requested_at)

    def test_reason_required_and_limited(self):
        self.assertEqual(self.client.post(self.url(self.a.pk), {"reason": "  "}, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url(self.a.pk), {"reason": "x" * 501}, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url(self.a.pk), {"reason": "x" * 500}, format="json").status_code, 200)


class HistoryTests(TestCase):
    def test_granting_again_after_withdrawal_adds_a_row(self):
        owner = consenting_user(username="h1", email="h1@test.ke", password="x", role="owner")
        client = APIClient(HTTP_HOST="localhost")
        client.force_authenticate(owner)
        client.post(f"{CONSENTS}credit_scoring/withdraw/")
        client.post(CONSENTS, {"purpose": "credit_scoring"}, format="json")
        rows = list(ConsentRecord.objects.filter(user=owner, purpose="credit_scoring").order_by("id"))
        self.assertEqual(len(rows), 2)
        self.assertIsNotNone(rows[0].withdrawn_at)   # the first grant is kept, with its withdrawal date
        self.assertIsNone(rows[1].withdrawn_at)
        self.assertTrue(has_consent(owner, "credit_scoring"))
        # Granting while already active does not add rows.
        client.post(CONSENTS, {"purpose": "credit_scoring"}, format="json")
        self.assertEqual(ConsentRecord.objects.filter(user=owner, purpose="credit_scoring").count(), 2)

    def test_admin_sees_full_history_newest_first(self):
        owner = consenting_user(username="h2", email="h2@test.ke", password="x", role="owner")
        admin = consenting_user(username="h3", email="h3@test.ke", password="x", role="admin")
        client = APIClient(HTTP_HOST="localhost")
        client.force_authenticate(owner)
        client.post(f"{CONSENTS}credit_scoring/withdraw/")
        client.force_authenticate(admin)
        res = client.get(f"/api/auth/admin/users/{owner.pk}/consents/")
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.json()
        self.assertEqual(len(rows), ConsentRecord.objects.filter(user=owner).count())
        self.assertEqual(rows, sorted(rows, key=lambda r: (r["granted_at"], r["id"]), reverse=True))
        self.assertTrue(any(r["purpose"] == "credit_scoring" and r["withdrawn_at"] for r in rows))
        # Owners and analysts can't read it.
        client.force_authenticate(owner)
        self.assertEqual(client.get(f"/api/auth/admin/users/{owner.pk}/consents/").status_code, 403)
