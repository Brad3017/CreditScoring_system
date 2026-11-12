"""
Tests for the xgb_msme_v3 scoring service, the request serializer and the submit endpoint.
Run with: python manage.py test scoring  (needs the test tools: pip install -r requirements-dev.txt)
"""
import json
import re
from io import BytesIO

import numpy as np
import pandas as pd
import xgboost as xgb
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from pypdf import PdfReader  # test-only: requirements-dev.txt
from rest_framework.test import APIClient

from . import letters, services
from .models import BusinessProfile, CreditAssessment, CreditRequest, LetterDownload
from .serializers import CreditRequestSerializer
from .views import LETTER_PENDING_MESSAGE

User = get_user_model()

# A strong applicant, written the way the form sends it.
LOW_RISK = {
    "business_name": "Test Hardware",
    "county": "Nairobi",
    "sector": "Retail",
    "legal_status": "Limited",
    "location_type": "Urban",
    "loan_purpose": "Working capital",
    "business_age_years": 12,
    "employees_count": 20,
    "monthly_revenue_kes": 1_000_000,
    "monthly_profit_kes": 300_000,
    "loan_amount": 1_500_000,
    "tenure_months": 12,
    "existing_loans": True,
    "prior_loan_count": 2,
    "late_payment_history": "Rarely",
    "collateral_level": "High",
    "cashflow_stability": 5,
    "owner_education": "Bachelor's",
    "days_payable_outstanding": 20,
}

# A middling applicant: Moderate Risk under v3 (score 600), inside the training ranges.
# affordable = 0.40 x 60,000 x 12 = 288,000; the 600,000 request is above it.
MODERATE_RISK = {
    "business_name": "Test Kiosk",
    "county": "Nairobi",
    "sector": "Retail",
    "legal_status": "Sole",
    "location_type": "Urban",
    "loan_purpose": "Working capital",
    "business_age_years": 5,
    "employees_count": 6,
    "monthly_revenue_kes": 300_000,
    "monthly_profit_kes": 60_000,
    "loan_amount": 600_000,
    "tenure_months": 12,
    "existing_loans": True,
    "prior_loan_count": 1,
    "late_payment_history": "Rarely",
    "collateral_level": "Moderate",
    "cashflow_stability": 3,
    "owner_education": "Secondary",
    "days_payable_outstanding": 45,
}

# A weak applicant, every input inside the training ranges.
HIGH_RISK = {
    **LOW_RISK,
    "sector": "Agriculture",
    "legal_status": "Sole",
    "location_type": "Rural",
    "loan_purpose": "Expansion",
    "business_age_years": 2,
    "employees_count": 3,
    "monthly_revenue_kes": 150_000,
    "monthly_profit_kes": 20_000,
    "loan_amount": 360_000,
    "tenure_months": 6,
    "existing_loans": True,
    "prior_loan_count": 0,
    "late_payment_history": "Sometimes",
    "collateral_level": "Low",
    "cashflow_stability": 1,
    "owner_education": "Primary",
    "days_payable_outstanding": 85,
}


class PrepareFeaturesTests(SimpleTestCase):
    def test_columns_order_and_encodings(self):
        X = services.prepare_features(LOW_RISK)
        meta = json.loads((settings.ML_ARTIFACTS_DIR / "model_metadata.json").read_text(encoding="utf-8"))

        self.assertEqual(list(X.columns), meta["features"])
        self.assertEqual(X.shape, (1, 17))
        self.assertTrue(all(dt == np.float64 for dt in X.dtypes))
        self.assertNotIn("county", X.columns)

        row = X.iloc[0]
        expected = {
            "sector": 2.0,               # Agriculture, Manufacturing, Retail, Services
            "legal_status": 0.0,         # Limited, Partnership, Sole
            "location_type": 1.0,        # Rural, Urban
            "loan_purpose": 4.0,         # ..., Renovation, Working capital
            "late_payment_history": 1.0, # Never=0, Rarely=1
            "owner_education": 3.0,      # Bachelor's=3
            "existing_loans": 1.0,       # Yes=1
            "profit_margin": 0.3,        # 300,000 / 1,000,000
            "loan_to_revenue": 1.5,      # 1,500,000 / 1,000,000
            "monthly_revenue_kes": 1_000_000.0,
            "loan_amount_kes": 1_500_000.0,
            "tenure_months": 12.0,
        }
        for column, value in expected.items():
            self.assertAlmostEqual(row[column], value, places=9, msg=column)

    def test_form_wording_is_normalised(self):
        X = services.prepare_features({**LOW_RISK, "legal_status": "Limited company", "late_payment_history": "Never late"})
        self.assertEqual(X.iloc[0]["legal_status"], 0.0)
        self.assertEqual(X.iloc[0]["late_payment_history"], 0.0)


class ScoreTests(SimpleTestCase):
    def test_score_shape(self):
        r = services.score(LOW_RISK)
        self.assertTrue(300 <= r["credit_score"] <= 850)
        self.assertIn(r["risk_category"], ("Low Risk", "Moderate Risk", "High Risk"))
        self.assertEqual(len(r["shap_values"]), 17)
        self.assertEqual({s["feature"] for s in r["shap_values"]}, set(services.FEATURES))
        for item in r["shap_values"]:
            self.assertEqual(set(item), {"feature", "label", "value", "direction"})
            self.assertIn(item["direction"], ("raises_risk", "lowers_risk"))
        magnitudes = [abs(s["value"]) for s in r["shap_values"]]
        self.assertEqual(magnitudes, sorted(magnitudes, reverse=True))
        self.assertEqual(len(r["shap_explanation"]), 3)
        self.assertEqual(r["model_version"], "xgb_msme_v3")

    def test_score_matches_band_and_formula(self):
        for applicant in (LOW_RISK, HIGH_RISK):
            r = services.score(applicant)
            raw = float(services.xgb_model.predict_proba(services.prepare_features(applicant))[0, 1])
            self.assertEqual(r["credit_score"], int(np.clip(np.round(850 - 550 * raw), 300, 850)))
            self.assertEqual(r["risk_category"], services.risk_category_for(raw))
        self.assertEqual(services.score(LOW_RISK)["risk_category"], "Low Risk")
        self.assertEqual(services.score(HIGH_RISK)["risk_category"], "High Risk")

    def test_same_probability_as_model_directly(self):
        """A hand-encoded row through a freshly loaded model gives the service's probability."""
        meta = json.loads((settings.ML_ARTIFACTS_DIR / "model_metadata.json").read_text(encoding="utf-8"))
        hand_encoded = pd.DataFrame([{
            "sector": 2, "legal_status": 0, "location_type": 1, "loan_purpose": 4,
            "business_age_years": 12, "employees_count": 20, "monthly_revenue_kes": 1_000_000,
            "profit_margin": 0.3, "loan_amount_kes": 1_500_000, "loan_to_revenue": 1.5,
            "tenure_months": 12, "existing_loans": 1, "prior_loan_count": 2,
            "late_payment_history": 1, "cashflow_stability": 5,
            "owner_education": 3, "days_payable_outstanding": 20,
        }], columns=meta["features"], dtype=float)

        fresh = xgb.XGBClassifier()
        fresh.load_model(str(settings.ML_ARTIFACTS_DIR / "msme_xgboost_credit_model.json"))
        direct = float(fresh.predict_proba(hand_encoded)[0, 1])

        via_service = float(services.xgb_model.predict_proba(services.prepare_features(LOW_RISK))[0, 1])
        self.assertAlmostEqual(via_service, direct, places=6)
        self.assertEqual(services.score(LOW_RISK)["probability_of_default"], round(direct, 4))

    def test_out_of_range_is_reported_but_score_unchanged(self):
        inside = services.score(LOW_RISK)
        self.assertEqual(inside["out_of_range"], [])
        outside = services.score({**LOW_RISK, "tenure_months": 48})
        self.assertTrue(any("Repayment period" in n for n in outside["out_of_range"]))


class BadInputTests(SimpleTestCase):
    def test_often_is_rejected(self):
        with self.assertRaisesMessage(ValueError, "Late payment history"):
            services.prepare_features({**LOW_RISK, "late_payment_history": "Often"})

    def test_unknown_sector_is_rejected(self):
        with self.assertRaisesMessage(ValueError, "Sector"):
            services.prepare_features({**LOW_RISK, "sector": "Mining"})

    def test_zero_revenue_is_rejected(self):
        with self.assertRaisesMessage(ValueError, "Monthly revenue"):
            services.prepare_features({**LOW_RISK, "monthly_revenue_kes": 0})

    def test_missing_value_is_rejected(self):
        data = {k: v for k, v in LOW_RISK.items() if k != "loan_purpose"}
        with self.assertRaisesMessage(ValueError, "Loan purpose is missing"):
            services.prepare_features(data)


class AffordabilityTests(SimpleTestCase):
    """metadata["limit_policy"]: affordable x share[band][collateral], capped at the request, floored to 1,000."""

    def policy(self):
        return services.LIMIT_POLICY

    def affordable(self, profit, tenure):
        return self.policy()["max_repayment_share_of_profit"] * profit * tenure

    def test_high_risk_gets_no_limit(self):
        for collateral in services.COLLATERAL_LEVELS:
            self.assertEqual(services.affordability(500_000, 200_000, 12, "High Risk", collateral)["recommended_limit"], 0)
        self.assertEqual(services.score(HIGH_RISK)["recommended_limit"], 0)

    def test_low_risk_is_min_of_request_and_affordable(self):
        for collateral in services.COLLATERAL_LEVELS:
            # affordable 240,000 below the request
            r = services.affordability(1_000_000, 50_000, 12, "Low Risk", collateral)
            self.assertEqual(r["affordable_limit"], self.affordable(50_000, 12))
            self.assertEqual(r["recommended_limit"], 240_000)
            # request below affordable
            self.assertEqual(services.affordability(100_000, 50_000, 12, "Low Risk", collateral)["recommended_limit"], 100_000)

    def test_moderate_risk_uses_collateral_share(self):
        shares = self.policy()["share_of_affordable_by_band"]["Moderate Risk"]
        for collateral, share in shares.items():
            r = services.affordability(1_000_000, 50_000, 12, "Moderate Risk", collateral)
            self.assertEqual(r["recommended_limit"], (self.affordable(50_000, 12) * share // 1000) * 1000, collateral)

    def test_never_exceeds_affordable_or_requested(self):
        for risk in ("Low Risk", "Moderate Risk", "High Risk"):
            for collateral in services.COLLATERAL_LEVELS:
                for loan, profit, tenure in ((300_000, 5_000_000, 36), (1_000_000, 33_333, 7), (55_555, 12_345, 9)):
                    r = services.affordability(loan, profit, tenure, risk, collateral)
                    self.assertLessEqual(r["recommended_limit"], r["requested_amount"])
                    self.assertLessEqual(r["recommended_limit"], r["affordable_limit"])
        self.assertLessEqual(services.score(LOW_RISK)["recommended_limit"], LOW_RISK["loan_amount"])

    def test_rounded_down_to_the_nearest_1000(self):
        # Moderate, low collateral: 0.5 x (0.4 x 33,333 x 7 = 93,332.4) = 46,666.2 -> 46,000
        r = services.affordability(1_000_000, 33_333, 7, "Moderate Risk", "Low")
        self.assertEqual(r["recommended_limit"], 46_000)
        self.assertEqual(r["recommended_limit"] % self.policy()["round_down_to"], 0)
        # Low risk, request 123,456 below affordable -> 123,000 (down, never up)
        self.assertEqual(services.affordability(123_456, 100_000, 12, "Low Risk", "Low")["recommended_limit"], 123_000)

    def test_limit_explanation(self):
        self.assertEqual(
            services.affordability(600_000, 60_000, 12, "Moderate Risk", "High")["limit_explanation"],
            "Moderate risk with high collateral: up to 100% of what your profit can repay over 12 months.",
        )
        self.assertEqual(
            services.affordability(600_000, 60_000, 12, "Moderate Risk", "Low")["limit_explanation"],
            "Moderate risk with low collateral: up to 50% of what your profit can repay over 12 months.",
        )
        # Collateral does not change the share for Low or High Risk, so it is not mentioned.
        self.assertEqual(
            services.affordability(600_000, 60_000, 6, "Low Risk", "Low")["limit_explanation"],
            "Low risk: up to 100% of what your profit can repay over 6 months.",
        )
        self.assertEqual(
            services.affordability(600_000, 60_000, 12, "High Risk", "High")["limit_explanation"],
            "High risk: no loan limit is recommended.",
        )


class SerializerTests(SimpleTestCase):
    def errors(self, **changes):
        s = CreditRequestSerializer(data={**LOW_RISK, **changes})
        self.assertFalse(s.is_valid())
        return s.errors

    def test_valid_payload(self):
        self.assertTrue(CreditRequestSerializer(data=LOW_RISK).is_valid())

    def test_profit_above_revenue(self):
        self.assertIn("monthly_profit_kes", self.errors(monthly_profit_kes=1_200_000))

    def test_tenure_zero(self):
        self.assertIn("tenure_months", self.errors(tenure_months=0))

    def test_other_rules(self):
        self.assertIn("monthly_revenue_kes", self.errors(monthly_revenue_kes=0))
        self.assertIn("monthly_profit_kes", self.errors(monthly_profit_kes=-1))
        self.assertIn("loan_amount", self.errors(loan_amount=0))
        self.assertIn("tenure_months", self.errors(tenure_months=61))
        self.assertIn("employees_count", self.errors(employees_count=-1))
        self.assertIn("cashflow_stability", self.errors(cashflow_stability=6))
        self.assertIn("late_payment_history", self.errors(late_payment_history="Often"))
        self.assertIn("sector", self.errors(sector="Mining"))
        self.assertIn("loan_purpose", self.errors(loan_purpose="Holiday"))

    def test_model_inputs_are_required(self):
        data = {k: v for k, v in LOW_RISK.items() if k != "sector"}
        s = CreditRequestSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn("sector", s.errors)


class SubmitEndpointTests(TestCase):
    url = "/api/scoring/assess/"

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="owner", email="owner@test.ke", password="x", role="owner")

    def test_owner_gets_v3_assessment(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(self.url, LOW_RISK, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(len(body["shap_values"]), 17)
        self.assertEqual(body["model_version"], "xgb_msme_v3")
        self.assertEqual(body["loan_purpose"], "Working capital")
        self.assertEqual(body["requested_amount"], 1_500_000)
        self.assertEqual(body["monthly_repayment_estimate"], 125_000)
        self.assertEqual(body["out_of_range"], [])

        stored = CreditAssessment.objects.get()
        self.assertEqual(stored.model_version, "xgb_msme_v3")
        self.assertEqual(len(stored.shap_values), 17)

    def test_bad_input_returns_400_and_saves_nothing(self):
        self.client.force_authenticate(self.owner)
        for bad in ({"late_payment_history": "Often"}, {"sector": "Mining"}, {"monthly_revenue_kes": 0}):
            res = self.client.post(self.url, {**LOW_RISK, **bad}, format="json")
            self.assertEqual(res.status_code, 400, bad)
        self.assertEqual(CreditRequest.objects.count(), 0)

    def test_staff_cannot_submit(self):
        analyst = User.objects.create_user(username="an", email="an@test.ke", password="x", role="analyst")
        self.client.force_authenticate(analyst)
        self.assertEqual(self.client.post(self.url, LOW_RISK, format="json").status_code, 403)


class ListQueryCountTests(TestCase):
    """List endpoints must not run one query per row (select_related on request and reviewer)."""

    def setUp(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        self.capture = lambda: CaptureQueriesContext(connection)
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="o", email="o@test.ke", password="x", role="owner")
        self.analyst = User.objects.create_user(username="a", email="a@test.ke", password="x", role="analyst", full_name="Ann Analyst")

    def add(self, n):
        for i in range(n):
            req = CreditRequest.objects.create(user=self.owner, business_name=f"Biz {i}", monthly_profit_kes=1000)
            CreditAssessment.objects.create(
                request=req, probability_of_default=0.5, credit_score=575, risk_category="Moderate Risk",
                model_version="xgb_msme_v2", review_status="approved", reviewed_by=self.analyst,
            )

    def queries_for(self, user, url):
        self.client.force_authenticate(user)
        with self.capture() as ctx:
            res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        return len(ctx.captured_queries), len(res.json())

    def test_constant_queries(self):
        for user, url in ((self.owner, "/api/scoring/assessments/"), (self.analyst, "/api/scoring/assessments/all/")):
            self.add(2)
            small, rows_small = self.queries_for(user, url)
            self.add(8)
            large, rows_large = self.queries_for(user, url)
            self.assertGreater(rows_large, rows_small)
            self.assertEqual(small, large, f"{url}: {small} queries for {rows_small} rows, {large} for {rows_large}")
            CreditAssessment.objects.all().delete()


class SimulateEndpointTests(TestCase):
    """What-if scoring: same validation as assess/, but nothing is written to the database."""
    url = "/api/scoring/simulate/"

    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # throttle counts live in the cache
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="sim", email="sim@test.ke", password="x", role="owner")
        self.other = User.objects.create_user(username="sim2", email="sim2@test.ke", password="x", role="owner")

    def counts(self):
        from .models import BusinessProfile
        return CreditRequest.objects.count(), CreditAssessment.objects.count(), BusinessProfile.objects.count()

    def test_returns_score_and_saves_nothing(self):
        self.client.force_authenticate(self.owner)
        before = self.counts()
        res = self.client.post(self.url, LOW_RISK, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(set(body), {
            "credit_score", "risk_category", "probability_of_default", "shap_values",
            "out_of_range", "recommended_limit", "monthly_repayment_estimate", "limit_explanation",
            "model_version",
        })
        self.assertTrue(300 <= body["credit_score"] <= 850)
        self.assertEqual(len(body["shap_values"]), 17)
        self.assertEqual(self.counts(), before)

    def test_staff_may_simulate(self):
        analyst = User.objects.create_user(username="sa", email="sa@test.ke", password="x", role="analyst")
        self.client.force_authenticate(analyst)
        self.assertEqual(self.client.post(self.url, LOW_RISK, format="json").status_code, 200)

    def test_anonymous_is_refused(self):
        self.assertEqual(self.client.post(self.url, LOW_RISK, format="json").status_code, 401)

    def test_invalid_input_returns_400(self):
        self.client.force_authenticate(self.owner)
        for bad in ({"late_payment_history": "Often"}, {"monthly_revenue_kes": 0}, {"tenure_months": 0}, {"cashflow_stability": 9}):
            res = self.client.post(self.url, {**LOW_RISK, **bad}, format="json")
            self.assertEqual(res.status_code, 400, bad)
        self.assertEqual(self.counts(), (0, 0, 0))

    def submit(self, user, payload):
        self.client.force_authenticate(user)
        res = self.client.post("/api/scoring/assess/", payload, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()

    def test_owner_cannot_fetch_another_owners_inputs(self):
        theirs = self.submit(self.other, LOW_RISK)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(f"/api/scoring/assessments/{theirs['pk']}/inputs/").status_code, 404)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/scoring/assessments/{theirs['pk']}/inputs/").status_code, 200)

    def test_stored_inputs_reproduce_stored_score(self):
        for payload in (LOW_RISK, MODERATE_RISK, HIGH_RISK):
            stored = self.submit(self.owner, payload)
            inputs = self.client.get(f"/api/scoring/assessments/{stored['pk']}/inputs/")
            self.assertEqual(inputs.status_code, 200)
            sim = self.client.post(self.url, inputs.json(), format="json")
            self.assertEqual(sim.status_code, 200, sim.content)
            self.assertEqual(sim.json()["credit_score"], stored["credit_score"])
            self.assertEqual(sim.json()["risk_category"], stored["risk_category"])
            self.assertEqual(sim.json()["recommended_limit"], stored["recommended_limit"])

    def test_rate_limited_at_60_per_minute(self):
        from unittest import mock
        self.client.force_authenticate(self.owner)
        # Skip the model for this check; only the throttle is under test.
        fake = {k: 0 for k in ("credit_score", "probability_of_default", "recommended_limit", "monthly_repayment_estimate")}
        fake.update(risk_category="Low Risk", shap_values=[], out_of_range=[], limit_explanation="", model_version="x")
        with mock.patch("scoring.views.evaluate_credit_request", return_value=fake):
            codes = [self.client.post(self.url, LOW_RISK, format="json").status_code for _ in range(61)]
        self.assertEqual(codes[:60], [200] * 60)
        self.assertEqual(codes[60], 429)


class KraPinTests(TestCase):
    """KRA PIN format (P + 9 digits + letter), normalisation and uniqueness on businesses and assessments."""
    businesses_url = "/api/scoring/businesses/"
    assess_url = "/api/scoring/assess/"
    FORMAT_MSG = "Enter a KRA PIN in the format P051234567X: the letter P, 9 digits, then a letter."
    DUP_MSG = "This KRA PIN is already registered to another business."
    BUSINESS = {
        "business_name": "Pin Traders", "sector": "Retail", "county": "Nairobi", "location_type": "Urban",
        "legal_status": "Sole", "business_age_years": 3, "employees_count": 4,
    }

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="pin1", email="pin1@test.ke", password="x", role="owner")
        self.other = User.objects.create_user(username="pin2", email="pin2@test.ke", password="x", role="owner")

    def add_business(self, user, pin, **changes):
        self.client.force_authenticate(user)
        return self.client.post(self.businesses_url, {**self.BUSINESS, **changes, "kra_pin": pin}, format="json")

    def test_valid_pin_is_accepted(self):
        res = self.add_business(self.owner, "P051234567X")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(BusinessProfile.objects.get(user=self.owner).kra_pin, "P051234567X")

    def test_lowercase_and_spaces_are_normalised(self):
        res = self.add_business(self.owner, " p051234567x ")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["kra_pin"], "P051234567X")

    def test_bad_formats_are_rejected(self):
        for bad in ("A051234567X", "P05123456X", "P0512345678", "P051234567XX"):
            res = self.add_business(self.owner, bad)
            self.assertEqual(res.status_code, 400, bad)
            self.assertEqual(res.json()["kra_pin"], [self.FORMAT_MSG], bad)
        self.assertEqual(BusinessProfile.objects.count(), 0)

    def test_blank_pin_is_stored_as_null_and_does_not_clash(self):
        self.assertEqual(self.add_business(self.owner, "").status_code, 201)
        self.assertEqual(self.add_business(self.other, "  ").status_code, 201)
        self.assertEqual(list(BusinessProfile.objects.values_list("kra_pin", flat=True)), [None, None])

    def test_duplicate_pin_is_rejected_on_the_profile_page(self):
        self.assertEqual(self.add_business(self.owner, "P051234567X").status_code, 201)
        res = self.add_business(self.other, "p051234567x", business_name="Other Shop")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["kra_pin"], [self.DUP_MSG])
        self.assertNotIn("Pin Traders", res.content.decode())
        res = self.add_business(self.owner, "P051234567X", business_name="Second Shop")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["kra_pin"], ["This KRA PIN is already registered to your business 'Pin Traders'."])
        # Re-saving a business with its own PIN is not a duplicate.
        pk = BusinessProfile.objects.get(user=self.owner).pk
        res = self.client.patch(f"{self.businesses_url}{pk}/", {"kra_pin": "P051234567X", "employees_count": 9}, format="json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_assessment_with_bad_pin_saves_nothing(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(self.assess_url, {**LOW_RISK, "kra_pin": "A051234567X"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["kra_pin"], [self.FORMAT_MSG])
        self.assertEqual((CreditRequest.objects.count(), BusinessProfile.objects.count()), (0, 0))

    def test_analyst_sees_pin_owner_list_does_not(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post(self.assess_url, {**LOW_RISK, "kra_pin": "P051234567X"}, format="json").json()
        self.assertNotIn("kra_pin", str(created))
        analyst = User.objects.create_user(username="pa", email="pa@test.ke", password="x", role="analyst")
        self.client.force_authenticate(analyst)
        detail = self.client.get(f"/api/scoring/assessments/{created['pk']}/").json()
        self.assertEqual(detail["business"]["kra_pin"], "P051234567X")

    def test_data_migration_normalises_and_nulls(self):
        import importlib
        from django.apps import apps
        migration = importlib.import_module("scoring.migrations.0008_normalise_kra_pin")
        rows = {}
        for i, raw in enumerate(["p051234567x", "A123456789B", "", "P051234567X", "P111111111Q"]):
            u = User.objects.create_user(username=f"m{i}", email=f"m{i}@test.ke", password="x", role="owner")
            p = BusinessProfile.objects.create(user=u, **self.BUSINESS)
            # .update() bypasses save(), planting the raw legacy value.
            BusinessProfile.objects.filter(pk=p.pk).update(kra_pin=raw)
            rows[raw] = p.pk
        normalised, nulled = migration.normalise_kra_pins(apps, None)
        pin = lambda raw: BusinessProfile.objects.get(pk=rows[raw]).kra_pin
        self.assertEqual(pin("p051234567x"), "P051234567X")   # trimmed + uppercased
        self.assertIsNone(pin("A123456789B"))                 # old A-format
        self.assertIsNone(pin(""))                            # empty string -> NULL
        self.assertIsNone(pin("P051234567X"))                 # clashes with the earlier row once normalised
        self.assertEqual(pin("P111111111Q"), "P111111111Q")   # already valid, untouched
        self.assertEqual((normalised, nulled), (1, 3))


class BusinessLinkTests(TestCase):
    """One business = one BusinessProfile = one KRA PIN; an owner may have several businesses.
    An assessment is linked to the business the owner chose, never to a "latest" profile."""
    assess_url = "/api/scoring/assess/"
    businesses_url = "/api/scoring/businesses/"
    OWN_MSG = ("This KRA PIN is already registered to your business 'Test Hardware'. "
               "Select that business instead, or enter the PIN of the new business.")
    DUP_MSG = "This KRA PIN is already registered to another business."

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="bl1", email="bl1@test.ke", password="x", role="owner")
        self.other = User.objects.create_user(username="bl2", email="bl2@test.ke", password="x", role="owner")

    def submit(self, user, **changes):
        self.client.force_authenticate(user)
        return self.client.post(self.assess_url, {**LOW_RISK, **changes}, format="json")

    def first_business(self, user=None, pin="P051234567A"):
        res = self.submit(user or self.owner, kra_pin=pin)  # LOW_RISK business_name: "Test Hardware"
        self.assertEqual(res.status_code, 201, res.content)
        return CreditRequest.objects.get(pk=CreditAssessment.objects.get(pk=res.json()["pk"]).request_id).business

    def counts(self):
        return CreditRequest.objects.count(), CreditAssessment.objects.count(), BusinessProfile.objects.count()

    def test_second_business_with_a_new_pin_gets_its_own_profile(self):
        first = self.first_business()
        res = self.submit(self.owner, business_name="Kamau Kiosk", kra_pin="P099999999B")
        self.assertEqual(res.status_code, 201, res.content)
        a = CreditAssessment.objects.select_related("request__business").get(pk=res.json()["pk"])
        self.assertNotEqual(a.request.business_id, first.pk)
        self.assertEqual(a.request.business.business_name, "Kamau Kiosk")
        self.assertEqual(a.request.business.kra_pin, "P099999999B")
        self.assertEqual(a.request.business.user, self.owner)
        self.assertEqual(res.json()["business_id"], a.request.business_id)
        self.assertEqual(BusinessProfile.objects.filter(user=self.owner).count(), 2)

    def test_same_pin_for_a_different_business_of_the_same_owner_is_refused(self):
        self.first_business()
        before = self.counts()
        res = self.submit(self.owner, business_name="Kamau Kiosk", kra_pin="p051234567a")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json(), {"kra_pin": [self.OWN_MSG]})
        self.assertEqual(self.counts(), before)

    def test_same_pin_from_another_owner_is_refused_without_revealing_the_business(self):
        self.first_business()
        before = self.counts()
        res = self.submit(self.other, business_name="Other Shop", kra_pin="P051234567A")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json(), {"kra_pin": [self.DUP_MSG]})
        body = res.content.decode()
        self.assertNotIn("Test Hardware", body)
        self.assertNotIn(self.owner.email, body)
        self.assertEqual(self.counts(), before)

    def test_choosing_another_owners_business_is_404(self):
        theirs = self.first_business(self.other)
        before = self.counts()
        res = self.submit(self.owner, business_id=theirs.pk, kra_pin=None)
        self.assertEqual(res.status_code, 404)
        self.assertEqual(self.submit(self.owner, business_id=999_999).status_code, 404)
        self.assertEqual(self.counts(), before)

    def test_choosing_an_existing_business_links_to_it_and_uses_its_name(self):
        business = self.first_business()
        res = self.submit(self.owner, business_id=business.pk, business_name="  test HARDWARE ", kra_pin="P051234567A")
        self.assertEqual(res.status_code, 201, res.content)
        a = CreditAssessment.objects.select_related("request").get(pk=res.json()["pk"])
        self.assertEqual(a.request.business_id, business.pk)
        self.assertEqual(a.request.business_name, "Test Hardware")  # the profile's name, not the payload's
        # Name and PIN may also be left out entirely.
        res = self.submit(self.owner, business_id=business.pk, business_name=None, kra_pin=None)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(BusinessProfile.objects.filter(user=self.owner).count(), 1)

    def test_existing_business_with_a_different_pin_or_name_is_refused(self):
        business = self.first_business()
        before = self.counts()
        res = self.submit(self.owner, business_id=business.pk, kra_pin="P099999999B")
        self.assertEqual(res.status_code, 400)
        self.assertIn("does not belong to 'Test Hardware'", res.json()["kra_pin"][0])
        res = self.submit(self.owner, business_id=business.pk, business_name="Kamau Kiosk")
        self.assertEqual(res.status_code, 400)
        self.assertIn("choose Add a new business", res.json()["business_name"][0])
        self.assertEqual(self.counts(), before)

    def test_no_business_id_never_falls_back_to_the_latest_profile(self):
        business = self.first_business()
        res = self.submit(self.owner, business_name="Kamau Kiosk", kra_pin=None)
        self.assertEqual(res.status_code, 201, res.content)
        a = CreditAssessment.objects.select_related("request").get(pk=res.json()["pk"])
        self.assertNotEqual(a.request.business_id, business.pk)
        self.assertEqual(a.request.business.business_name, "Kamau Kiosk")
        # A new business needs a name.
        self.assertEqual(self.submit(self.owner, business_name="  ").status_code, 400)

    def test_request_user_must_own_the_business(self):
        theirs = self.first_business(self.other)
        req = CreditRequest(user=self.owner, business=theirs, business_name=theirs.business_name, monthly_profit_kes=1000)
        with self.assertRaises(DjangoValidationError):
            req.save()
        with self.assertRaises(DjangoValidationError):
            req.full_clean()
        self.assertFalse(CreditRequest.objects.filter(user=self.owner).exists())

    def test_pin_is_editable_until_the_business_has_an_assessment(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(self.businesses_url, {**KraPinTests.BUSINESS, "kra_pin": "P011111111A"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        pk = res.json()["id"]
        self.assertFalse(res.json()["pin_locked"])
        res = self.client.patch(f"{self.businesses_url}{pk}/", {"kra_pin": "P022222222B"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(self.submit(self.owner, business_id=pk, business_name=None, kra_pin=None).status_code, 201)

        self.client.force_authenticate(self.owner)
        got = self.client.get(f"{self.businesses_url}{pk}/").json()
        self.assertEqual((got["pin_locked"], got["assessment_count"]), (True, 1))
        res = self.client.patch(f"{self.businesses_url}{pk}/", {"kra_pin": "P033333333C"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["kra_pin"], ["Contact support to change a registered KRA PIN."])
        res = self.client.patch(f"{self.businesses_url}{pk}/", {"kra_pin": None}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(BusinessProfile.objects.get(pk=pk).kra_pin, "P022222222B")
        # Other fields stay editable; sending the unchanged PIN back is fine.
        res = self.client.patch(f"{self.businesses_url}{pk}/", {"kra_pin": "P022222222B", "employees_count": 30}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(BusinessProfile.objects.get(pk=pk).employees_count, 30)

    def test_owners_only_see_and_edit_their_own_businesses(self):
        mine = self.first_business()
        theirs = self.first_business(self.other, pin="P077777777C")
        self.client.force_authenticate(self.owner)
        listed = self.client.get(self.businesses_url).json()
        self.assertEqual([b["id"] for b in listed], [mine.pk])
        self.assertEqual(self.client.get(f"{self.businesses_url}{theirs.pk}/").status_code, 404)
        self.assertEqual(self.client.patch(f"{self.businesses_url}{theirs.pk}/", {"employees_count": 1}, format="json").status_code, 404)

    def test_check_business_links_reports_and_changes_nothing(self):
        from io import StringIO
        from django.core.management import call_command
        mine = self.first_business()
        theirs = self.first_business(self.other, pin="P077777777C")
        good = self.submit(self.owner, business_id=mine.pk, business_name=None, kra_pin=None).json()["pk"]
        # Plant the two bad shapes with .update(), which skips the model check.
        bad_name = CreditAssessment.objects.get(pk=good).request
        CreditRequest.objects.filter(pk=bad_name.pk).update(business_name="Kamau Kiosk")
        bad_user = CreditRequest.objects.filter(user=self.owner).exclude(pk=bad_name.pk).first()
        CreditRequest.objects.filter(pk=bad_user.pk).update(business=theirs)
        snapshot = list(CreditRequest.objects.order_by("id").values())

        out = StringIO()
        call_command("check_business_links", stdout=out)
        text = out.getvalue()
        self.assertIn("Snapshot name differs from the linked business: 1", text)
        self.assertIn(f"request {bad_name.pk} ", text)
        self.assertIn("'Kamau Kiosk' -> business", text)
        self.assertIn("Request user is not the business owner: 1", text)
        self.assertIn(f"request {bad_user.pk} ", text)
        self.assertEqual(list(CreditRequest.objects.order_by("id").values()), snapshot)


# ---------------------------------------------------------------------------
# "Learn" lessons and lesson views
# ---------------------------------------------------------------------------
import unittest
from pathlib import Path

CONTENT_DIR = Path(settings.BASE_DIR) / "frontend" / "credit-scoring-frontend" / "src" / "content"
LESSON_FIELDS = {"title", "summary", "why", "scoreLink", "steps"}


@unittest.skipUnless((CONTENT_DIR / "lessons.en.json").exists(),
                     "frontend/ is not in this image (.dockerignore); run with the repo mounted at /app")
class LessonContentTests(SimpleTestCase):
    def load(self, name):
        with open(CONTENT_DIR / name, encoding="utf-8") as f:
            return json.load(f)

    def test_every_key_is_a_model_feature_or_limit_input(self):
        features = set(json.load(open(settings.ML_ARTIFACTS_DIR / "model_metadata.json", encoding="utf-8"))["features"])
        unknown = set(self.load("lessons.en.json")) - features - set(services.LIMIT_INPUTS)
        self.assertEqual(unknown, set(), f"lesson keys that are neither model features nor limit inputs: {unknown}")

    def test_every_lesson_has_five_fields_and_three_steps(self):
        for key, lesson in self.load("lessons.en.json").items():
            self.assertEqual(set(lesson), LESSON_FIELDS, key)
            for field in LESSON_FIELDS - {"steps"}:
                self.assertTrue(isinstance(lesson[field], str) and lesson[field].strip(), f"{key}.{field}")
            self.assertEqual(len(lesson["steps"]), 3, key)
            self.assertTrue(all(isinstance(x, str) and x.strip() for x in lesson["steps"]), key)

    def test_translations_use_the_same_keys_and_shape(self):
        # e.g. lessons.sw.json, added later: only keys that exist in English, same five fields.
        english = set(self.load("lessons.en.json"))
        for path in CONTENT_DIR.glob("lessons.*.json"):
            if path.name == "lessons.en.json":
                continue
            other = self.load(path.name)
            self.assertLessEqual(set(other), english, path.name)
            for key, lesson in other.items():
                self.assertEqual(set(lesson), LESSON_FIELDS, f"{path.name}:{key}")
                self.assertEqual(len(lesson["steps"]), 3, f"{path.name}:{key}")


class LessonViewTests(TestCase):
    url = "/api/learn/viewed/"

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="lv", email="lv@test.ke", password="x", role="owner")

    def post(self, key="late_payment_history"):
        return self.client.post(self.url, {"feature_key": key}, format="json")

    def test_owner_recorded_once_per_day(self):
        from .models import LessonView
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.post().status_code, 200)   # same lesson, same day: not recorded again
        self.assertEqual(self.post("cashflow_stability").status_code, 201)
        self.assertEqual(LessonView.objects.filter(user=self.owner).count(), 2)

    def test_next_day_is_recorded_again(self):
        import datetime
        from unittest import mock
        from .models import LessonView
        self.client.force_authenticate(self.owner)
        self.post()
        with mock.patch("scoring.views.timezone.localdate", return_value=datetime.date.today() + datetime.timedelta(days=1)):
            self.assertEqual(self.post().status_code, 201)
        self.assertEqual(LessonView.objects.filter(user=self.owner, feature_key="late_payment_history").count(), 2)

    def test_owners_only(self):
        self.assertEqual(self.post().status_code, 401)
        for role in ("analyst", "admin"):
            staff = User.objects.create_user(username=role, email=f"{role}@lv.ke", password="x", role=role)
            self.client.force_authenticate(staff)
            self.assertEqual(self.post().status_code, 403, role)

    def test_unknown_key_rejected(self):
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.post("not_a_feature").status_code, 400)

    def test_admin_overview_counts_views(self):
        self.client.force_authenticate(self.owner)
        self.post("late_payment_history")
        self.post("cashflow_stability")
        other = User.objects.create_user(username="lv2", email="lv2@test.ke", password="x", role="owner")
        self.client.force_authenticate(other)
        self.post("late_payment_history")
        admin = User.objects.create_user(username="lva", email="lva@test.ke", password="x", role="admin")
        self.client.force_authenticate(admin)
        body = self.client.get("/api/scoring/admin/overview/").json()
        self.assertEqual(body["lesson_views"], [
            {"feature_key": "late_payment_history", "views": 2},
            {"feature_key": "cashflow_stability", "views": 1},
        ])


# ---------------------------------------------------------------------------
# Model v3: no repayment confidence; collateral sets the loan limit, never the score
# ---------------------------------------------------------------------------
class ModelV3Tests(TestCase):
    REMOVED = ("repayment_confidence", "collateral_level")

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="v3", email="v3@test.ke", password="x", role="owner")
        self.meta = json.loads((settings.ML_ARTIFACTS_DIR / "model_metadata.json").read_text(encoding="utf-8"))

    def test_metadata_is_v3(self):
        self.assertEqual(self.meta["model_version"], "xgb_msme_v3")
        self.assertEqual(len(self.meta["features"]), 17)
        self.assertIn("limit_policy", self.meta)

    def test_prepare_features_has_the_17_metadata_features_in_order(self):
        for applicant in (LOW_RISK, MODERATE_RISK, HIGH_RISK):
            X = services.prepare_features(applicant)
            self.assertEqual(list(X.columns), self.meta["features"])
            self.assertEqual(X.shape, (1, 17))
            for column in self.REMOVED:
                self.assertNotIn(column, X.columns)

    def test_removed_inputs_never_reach_the_model(self):
        # Even when sent, repayment confidence changes nothing.
        a = services.score({**MODERATE_RISK, "repayment_confidence": 1})
        b = services.score({**MODERATE_RISK, "repayment_confidence": 5})
        self.assertEqual(a["probability_of_default"], b["probability_of_default"])
        self.assertNotIn("repayment_confidence", {v["feature"] for v in a["shap_values"]})
        self.assertNotIn("collateral_level", {v["feature"] for v in a["shap_values"]})

    def test_collateral_changes_the_limit_but_not_the_score(self):
        results = {c: services.score({**MODERATE_RISK, "collateral_level": c}) for c in services.COLLATERAL_LEVELS}
        first = results["Low"]
        self.assertEqual(first["risk_category"], "Moderate Risk")
        for r in results.values():
            self.assertEqual(r["probability_of_default"], first["probability_of_default"])
            self.assertEqual(r["credit_score"], first["credit_score"])
            self.assertEqual(r["risk_category"], first["risk_category"])
        # affordable 288,000: Low 0.5 -> 144,000; Moderate 0.75 -> 216,000; High 1.0 -> 288,000
        self.assertEqual(results["Low"]["recommended_limit"], 144_000)
        self.assertEqual(results["Moderate"]["recommended_limit"], 216_000)
        self.assertEqual(results["High"]["recommended_limit"], 288_000)

    def test_hand_built_row_probability_matches_predict_proba(self):
        # MODERATE_RISK encoded by hand from the metadata lists and mappings.
        row = pd.DataFrame([{
            "sector": 2, "legal_status": 2, "location_type": 1, "loan_purpose": 4,
            "business_age_years": 5, "employees_count": 6, "monthly_revenue_kes": 300_000,
            "profit_margin": 0.2, "loan_amount_kes": 600_000, "loan_to_revenue": 2.0,
            "tenure_months": 12, "existing_loans": 1, "prior_loan_count": 1,
            "late_payment_history": 1, "cashflow_stability": 3, "owner_education": 1,
            "days_payable_outstanding": 45,
        }], columns=self.meta["features"], dtype=float)
        fresh = xgb.XGBClassifier()
        fresh.load_model(str(settings.ML_ARTIFACTS_DIR / "msme_xgboost_credit_model.json"))
        direct = float(fresh.predict_proba(row)[0, 1])
        via_service = float(services.xgb_model.predict_proba(services.prepare_features(MODERATE_RISK))[0, 1])
        self.assertAlmostEqual(via_service, direct, places=6)

    def test_request_without_repayment_confidence_is_accepted_and_stored_as_null(self):
        self.assertNotIn("repayment_confidence", MODERATE_RISK)
        self.assertTrue(CreditRequestSerializer(data=MODERATE_RISK).is_valid())
        self.client.force_authenticate(self.owner)
        res = self.client.post("/api/scoring/assess/", MODERATE_RISK, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(CreditRequest.objects.get().repayment_confidence)
        self.assertEqual(
            res.json()["limit_explanation"],
            "Moderate risk with moderate collateral: up to 75% of what your profit can repay over 12 months.",
        )

    def test_request_without_collateral_is_rejected(self):
        data = {k: v for k, v in MODERATE_RISK.items() if k != "collateral_level"}
        s = CreditRequestSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn("collateral_level", s.errors)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post("/api/scoring/assess/", data, format="json").status_code, 400)
        self.assertEqual(CreditRequest.objects.count(), 0)
        with self.assertRaisesMessage(ValueError, "Collateral is missing"):
            services.prepare_features(data)

    def test_collateral_must_be_low_moderate_or_high(self):
        s = CreditRequestSerializer(data={**MODERATE_RISK, "collateral_level": "Very high"})
        self.assertFalse(s.is_valid())
        self.assertIn("collateral_level", s.errors)

    def stored(self, version, score, label, collateral="High"):
        req = CreditRequest.objects.create(
            user=self.owner, business_name=f"{version} {score}", monthly_profit_kes=60_000,
            collateral_level=collateral, tenure_months=12,
        )
        return CreditAssessment.objects.create(
            request=req, probability_of_default=0.5, credit_score=score, risk_category=label,
            model_version=version, shap_values=[{"feature": "collateral_level", "label": "Collateral", "value": 0.1, "direction": "raises_risk"}],
        )

    def test_legacy_only_when_label_disagrees_with_score_band(self):
        v1 = self.stored("xgb_msme_v1", 553, "High Risk")     # 553 is in the Moderate band
        v2 = self.stored("xgb_msme_v2", 600, "Moderate Risk")
        edge = self.stored("xgb_msme_v3", 700, "Moderate Risk")  # pd just above 0.272727 rounds to 700
        self.client.force_authenticate(self.owner)
        body = {a["pk"]: a for a in self.client.get("/api/scoring/assessments/").json()}
        self.assertTrue(body[v1.pk]["is_legacy"])
        self.assertFalse(body[v1.pk]["is_current_model"])
        self.assertFalse(body[v2.pk]["is_legacy"])
        self.assertFalse(body[v2.pk]["is_current_model"])
        self.assertFalse(body[edge.pk]["is_legacy"])
        self.assertTrue(body[edge.pk]["is_current_model"])
        # Earlier-model limits came from the old rule; the v3 sentence would misdescribe them.
        self.assertIsNone(body[v2.pk]["limit_explanation"])
        # Stored SHAP values are returned as stored, removed features included.
        self.assertEqual(body[v2.pk]["shap_values"][0]["feature"], "collateral_level")

    def test_collateral_lesson_can_still_be_recorded(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post("/api/learn/viewed/", {"feature_key": "collateral_level"}, format="json")
        self.assertEqual(res.status_code, 201)
        res = self.client.post("/api/learn/viewed/", {"feature_key": "repayment_confidence"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_admin_model_and_fairness(self):
        admin = User.objects.create_user(username="v3a", email="v3a@test.ke", password="x", role="admin")
        self.stored("xgb_msme_v3", 600, "Moderate Risk", collateral="Low")
        self.client.force_authenticate(admin)
        model = self.client.get("/api/scoring/admin/model/").json()
        self.assertIn("Without both (chosen)", model["report"]["feature_decisions"])
        excluded = {e["key"]: e for e in model["excluded_inputs"]}
        self.assertEqual(excluded["collateral_level"]["reason"], self.meta["excluded_columns"]["collateral_level"])
        self.assertEqual(excluded["repayment_confidence"]["label"], "Repayment confidence")
        fairness = self.client.get("/api/scoring/admin/fairness/").json()
        collateral = next(d for d in fairness["dimensions"] if d["field"] == "collateral_level")
        self.assertEqual(collateral["groups"][0]["name"], "Low")


# ---------------------------------------------------------------------------
# Decision letter (PDF). pypdf is a test-only dependency: pip install -r requirements-dev.txt
# ---------------------------------------------------------------------------
class DecisionLetterTests(TestCase):
    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="lo", email="lo@test.ke", password="x", role="owner",
                                              full_name="Wanjiku Kamau")
        self.other = User.objects.create_user(username="lx", email="lx@test.ke", password="x", role="owner")
        self.analyst = User.objects.create_user(username="la", email="la@test.ke", password="x", role="analyst",
                                                full_name="Otieno Analyst")

    # helpers -------------------------------------------------------------
    def submit(self, data=MODERATE_RISK, user=None):
        self.client.force_authenticate(user or self.owner)
        res = self.client.post("/api/scoring/assess/", data, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return CreditAssessment.objects.get(pk=res.json()["pk"])

    def decide(self, a, decision, note=""):
        self.client.force_authenticate(self.analyst)
        res = self.client.post(f"/api/scoring/assessments/{a.pk}/review/", {"decision": decision, "note": note}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        a.refresh_from_db()
        return a

    def letter(self, a, user=None, query=""):
        self.client.force_authenticate(user or self.owner)
        pk = a if isinstance(a, int) else a.pk
        return self.client.get(f"/api/scoring/assessments/{pk}/letter/{query}")

    @staticmethod
    def pdf(content):
        reader = PdfReader(BytesIO(getattr(content, "content", content)))
        text = " ".join(" ".join(p.extract_text() for p in reader.pages).split())
        return reader, text

    # tests ---------------------------------------------------------------
    def test_approved_letter_is_a_one_page_pdf_with_the_stored_figures(self):
        a = self.decide(self.submit(), "approved", "Welcome aboard.")
        res = self.letter(a)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        ref = f"BS-{timezone.localtime(a.reviewed_at).year}-{a.pk:06d}"
        self.assertEqual(res["Content-Disposition"], f'attachment; filename="BiasharaScore_decision_{ref}.pdf"')
        reader, text = self.pdf(res)
        self.assertEqual(len(reader.pages), 1)
        for expected in (
            MODERATE_RISK["business_name"], f"{a.credit_score} out of 850", "Sample letter", f"Ref: {ref}",
            "Wanjiku Kamau", "KRA PIN not provided",
            # MODERATE_RISK: Moderate Risk with Moderate collateral -> 0.75 x 288,000 = 216,000.
            "your application has been approved for up to KES 216,000", "repayable over 12 months",
            # The limit is below the request, so the flat estimate is for the limit: 216,000 / 12.
            "Estimated monthly repayment: KES 18,000",
            "This is less than the KES 600,000 you asked for", a.risk_category,
            "Scores run from 300 to 850.", "Welcome aboard.", "Otieno Analyst", "Your rights",
            f"Model {a.model_version}", f"Assessment ASSESS-{a.pk}",
        ):
            self.assertIn(expected, text)
        # Reasons: the 3 largest stored SHAP values by absolute size, in the report's wording.
        top = sorted(a.shap_values, key=lambda v: abs(v["value"]), reverse=True)[:3]
        for v in top:
            word = "raised" if v["direction"] == "raises_risk" else "lowered"
            self.assertIn(f"{v['label']} {word} the assessed risk.", text)

    def test_the_letter_never_runs_past_one_page(self):
        a = self.decide(self.submit(), "approved", "x" * 1000)
        reader, text = self.pdf(self.letter(a))
        self.assertEqual(len(reader.pages), 1)
        squashed = text.replace(" ", "")
        self.assertIn("x" * 600 + "…", squashed)
        self.assertNotIn("x" * 601, squashed)
        words = " ".join(["Please bring six months of M-Pesa statements and supplier invoices."] * 15)
        a = self.decide(a, "referred", words)
        reader, _ = self.pdf(self.letter(a))
        self.assertEqual(len(reader.pages), 1)

    def test_declined_letter_has_no_loan_amount(self):
        a = self.decide(self.submit(HIGH_RISK), "declined", "Repayment record too weak for now.")
        _, text = self.pdf(self.letter(a))
        self.assertIn("After reviewing your application, we are unable to offer credit at this time.", text)
        self.assertNotIn("KES", text)
        self.assertNotIn("approved", text)

    def test_referred_letter_asks_for_more_information(self):
        a = self.decide(self.submit(), "referred", "Please send recent bank statements.")
        _, text = self.pdf(self.letter(a))
        self.assertIn("Before we can decide, we need more information from you. Please see the note below.", text)
        self.assertIn("Please send recent bank statements.", text)
        self.assertNotIn("KES", text)

    def test_pending_assessment_returns_409(self):
        a = self.submit()
        res = self.letter(a)
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json(), {"detail": LETTER_PENDING_MESSAGE})
        self.assertEqual(self.letter(a, self.analyst).status_code, 409)
        self.assertEqual(LetterDownload.objects.count(), 0)

    def test_access_rules(self):
        a = self.decide(self.submit(), "approved")
        # Another owner gets the same 404 as for an ID that does not exist.
        self.assertEqual(self.letter(a, self.other).status_code, 404)
        self.assertEqual(self.letter(999_999, self.other).status_code, 404)
        self.assertEqual(self.letter(a, self.analyst).status_code, 200)
        admin = User.objects.create_user(username="ad", email="ad@test.ke", password="x", role="admin")
        self.assertEqual(self.letter(a, admin).status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/scoring/assessments/{a.pk}/letter/").status_code, 401)

    def test_inline_preview_is_staff_only_and_not_counted(self):
        a = self.decide(self.submit(), "approved")
        res = self.letter(a, self.analyst, "?inline=1")
        self.assertTrue(res["Content-Disposition"].startswith("inline;"))
        self.assertEqual(LetterDownload.objects.count(), 0)
        res = self.letter(a, query="?inline=1")  # an owner always gets an attachment
        self.assertTrue(res["Content-Disposition"].startswith("attachment;"))

    def test_download_creates_a_letterdownload_row_and_the_count_reaches_the_analyst(self):
        a = self.decide(self.submit(), "approved")
        self.letter(a)
        self.assertEqual(LetterDownload.objects.get().user, self.owner)
        self.letter(a)
        self.assertEqual(LetterDownload.objects.filter(assessment=a).count(), 2)
        self.client.force_authenticate(self.analyst)
        self.assertEqual(self.client.get(f"/api/scoring/assessments/{a.pk}/").json()["letter_downloads"], 2)

    def test_letter_reflects_the_latest_decision(self):
        a = self.decide(self.submit(), "approved")
        self.assertIn("approved for up to", self.pdf(self.letter(a))[1])
        a = self.decide(a, "declined", "Changed after a second look.")
        _, text = self.pdf(self.letter(a))
        self.assertIn("unable to offer credit", text)
        self.assertIn("Changed after a second look.", text)

    def test_legacy_assessment_without_shap_values_gets_a_valid_one_page_letter(self):
        a = self.submit()
        CreditAssessment.objects.filter(pk=a.pk).update(shap_values=[], model_version="xgb_msme_v1")
        a = self.decide(CreditAssessment.objects.get(pk=a.pk), "approved")
        reader, text = self.pdf(self.letter(a))
        self.assertEqual(len(reader.pages), 1)
        self.assertIn(letters.LEGACY_FACTORS, text)
        self.assertNotIn("What could improve your result", text)
        self.assertIn("Model xgb_msme_v1", text)

    def test_tips_use_the_report_page_rule(self):
        a = self.decide(self.submit(), "approved")
        a.shap_values = [
            {"feature": "collateral_level", "label": "Collateral", "value": 0.9, "direction": "raises_risk"},
            {"feature": "sector", "label": "Sector", "value": 0.8, "direction": "raises_risk"},
            {"feature": "cashflow_stability", "label": "Cash-flow stability", "value": 0.2, "direction": "raises_risk"},
            {"feature": "late_payment_history", "label": "Late payment history", "value": 0.5, "direction": "raises_risk"},
            {"feature": "tenure_months", "label": "Repayment period", "value": -0.4, "direction": "lowers_risk"},
        ]
        self.assertEqual(letters.improvement_tips(a), [
            "Late payment history raised your risk the most among the answers you can change.",
            "Cash-flow stability also raised your risk.",
        ])
        a.shap_values = [{"feature": "sector", "label": "Sector", "value": 0.8, "direction": "raises_risk"}]
        self.assertEqual(letters.improvement_tips(a), [])
        self.assertIn(letters.NO_TIPS, self.pdf(letters.build_decision_letter(a))[1])

    def test_approved_at_the_full_amount_uses_the_stored_repayment(self):
        a = self.decide(self.submit({**LOW_RISK, "loan_amount": 1_200_000}), "approved")
        self.assertEqual(float(a.recommended_limit), 1_200_000)  # affordable 1,440,000, so the full request
        _, text = self.pdf(self.letter(a))
        self.assertIn(f"Estimated monthly repayment: {letters.kes(a.monthly_repayment_estimate)}", text)
        self.assertNotIn("This is less than", text)

    def test_reference_and_dates(self):
        a = self.decide(self.submit(), "approved")
        self.assertRegex(letters.letter_reference(a), r"^BS-\d{4}-\d{6}$")
        self.assertRegex(letters.long_date(a.reviewed_at), r"^\d{1,2} [A-Z][a-z]+ \d{4}$")
        self.assertIn(letters.long_date(a.reviewed_at), self.pdf(self.letter(a))[1])

    def test_accent_matches_the_design_token(self):
        tokens = Path(settings.BASE_DIR) / "frontend" / "credit-scoring-frontend" / "src" / "styles" / "tokens.css"
        if not tokens.exists():
            self.skipTest("frontend/ is not in this image")
        first = re.search(r"--accent:\s*(#[0-9a-fA-F]{6})", tokens.read_text(encoding="utf-8"))
        self.assertEqual(first.group(1).lower(), letters.ACCENT_HEX)
