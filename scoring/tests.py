"""
Tests for the xgb_msme_v2 scoring service, the request serializer and the submit endpoint.
Run with: python manage.py test scoring
"""
import json

import numpy as np
import pandas as pd
import xgboost as xgb
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase
from rest_framework.test import APIClient

from . import services
from .models import CreditAssessment, CreditRequest
from .serializers import CreditRequestSerializer

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
    "repayment_confidence": 5,
    "owner_education": "Bachelor's",
    "days_payable_outstanding": 20,
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
    "repayment_confidence": 1,
    "owner_education": "Primary",
    "days_payable_outstanding": 85,
}


class PrepareFeaturesTests(SimpleTestCase):
    def test_columns_order_and_encodings(self):
        X = services.prepare_features(LOW_RISK)
        meta = json.loads((settings.ML_ARTIFACTS_DIR / "model_metadata.json").read_text(encoding="utf-8"))

        self.assertEqual(list(X.columns), meta["features"])
        self.assertEqual(X.shape, (1, 19))
        self.assertTrue(all(dt == np.float64 for dt in X.dtypes))
        self.assertNotIn("county", X.columns)

        row = X.iloc[0]
        expected = {
            "sector": 2.0,               # Agriculture, Manufacturing, Retail, Services
            "legal_status": 0.0,         # Limited, Partnership, Sole
            "location_type": 1.0,        # Rural, Urban
            "loan_purpose": 4.0,         # ..., Renovation, Working capital
            "late_payment_history": 1.0, # Never=0, Rarely=1
            "collateral_level": 2.0,     # High=2
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
        self.assertEqual(len(r["shap_values"]), 19)
        self.assertEqual({s["feature"] for s in r["shap_values"]}, set(services.FEATURES))
        for item in r["shap_values"]:
            self.assertEqual(set(item), {"feature", "label", "value", "direction"})
            self.assertIn(item["direction"], ("raises_risk", "lowers_risk"))
        magnitudes = [abs(s["value"]) for s in r["shap_values"]]
        self.assertEqual(magnitudes, sorted(magnitudes, reverse=True))
        self.assertEqual(len(r["shap_explanation"]), 3)
        self.assertEqual(r["model_version"], "xgb_msme_v2")

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
            "late_payment_history": 1, "collateral_level": 2, "cashflow_stability": 5,
            "repayment_confidence": 5, "owner_education": 3, "days_payable_outstanding": 20,
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
    def test_high_risk_gets_no_limit(self):
        self.assertEqual(services.affordability(500_000, 200_000, 12, "High Risk")["recommended_limit"], 0)
        self.assertEqual(services.score(HIGH_RISK)["recommended_limit"], 0)

    def test_limit_never_exceeds_request(self):
        for risk in ("Low Risk", "Moderate Risk", "High Risk"):
            r = services.affordability(300_000, 5_000_000, 36, risk)
            self.assertLessEqual(r["recommended_limit"], r["requested_amount"])
        self.assertLessEqual(services.score(LOW_RISK)["recommended_limit"], LOW_RISK["loan_amount"])

    def test_rule_and_rounding(self):
        # affordable = 0.4 * 50,000 * 12 = 240,000
        low = services.affordability(1_000_000, 50_000, 12, "Low Risk")
        self.assertEqual(low["affordable_limit"], 240_000)
        self.assertEqual(low["recommended_limit"], 240_000)
        self.assertEqual(low["monthly_repayment_estimate"], round(1_000_000 / 12, 2))
        # moderate = half of 0.4 * 33,333 * 7 = 46,666.2 -> rounded down to 46,000
        self.assertEqual(services.affordability(1_000_000, 33_333, 7, "Moderate Risk")["recommended_limit"], 46_000)


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

    def test_owner_gets_v2_assessment(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(self.url, LOW_RISK, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(len(body["shap_values"]), 19)
        self.assertEqual(body["model_version"], "xgb_msme_v2")
        self.assertEqual(body["loan_purpose"], "Working capital")
        self.assertEqual(body["requested_amount"], 1_500_000)
        self.assertEqual(body["monthly_repayment_estimate"], 125_000)
        self.assertEqual(body["out_of_range"], [])

        stored = CreditAssessment.objects.get()
        self.assertEqual(stored.model_version, "xgb_msme_v2")
        self.assertEqual(len(stored.shap_values), 19)

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
