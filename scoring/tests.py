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
            "out_of_range", "recommended_limit", "monthly_repayment_estimate",
        })
        self.assertTrue(300 <= body["credit_score"] <= 850)
        self.assertEqual(len(body["shap_values"]), 19)
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
        for payload in (LOW_RISK, HIGH_RISK):
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
        fake.update(risk_category="Low Risk", shap_values=[], out_of_range=[])
        with mock.patch("scoring.views.evaluate_credit_request", return_value=fake):
            codes = [self.client.post(self.url, LOW_RISK, format="json").status_code for _ in range(61)]
        self.assertEqual(codes[:60], [200] * 60)
        self.assertEqual(codes[60], 429)


class KraPinTests(TestCase):
    """KRA PIN format (P + 9 digits + letter), normalisation, uniqueness and saving from an assessment."""
    profile_url = "/api/scoring/business-profile/"
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

    def put_profile(self, user, pin):
        self.client.force_authenticate(user)
        return self.client.put(self.profile_url, {**self.BUSINESS, "kra_pin": pin}, format="json")

    def profile(self, user):
        from .models import BusinessProfile
        return BusinessProfile.objects.get(user=user)

    def test_valid_pin_is_accepted(self):
        res = self.put_profile(self.owner, "P051234567X")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(self.profile(self.owner).kra_pin, "P051234567X")

    def test_lowercase_and_spaces_are_normalised(self):
        res = self.put_profile(self.owner, " p051234567x ")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["kra_pin"], "P051234567X")
        self.assertEqual(self.profile(self.owner).kra_pin, "P051234567X")

    def test_bad_formats_are_rejected(self):
        for bad in ("A051234567X", "P05123456X", "P0512345678", "P051234567XX"):
            res = self.put_profile(self.owner, bad)
            self.assertEqual(res.status_code, 400, bad)
            self.assertEqual(res.json()["kra_pin"], [self.FORMAT_MSG], bad)

    def test_blank_pin_is_stored_as_null_and_does_not_clash(self):
        self.assertEqual(self.put_profile(self.owner, "").status_code, 200)
        self.assertEqual(self.put_profile(self.other, "  ").status_code, 200)
        self.assertIsNone(self.profile(self.owner).kra_pin)
        self.assertIsNone(self.profile(self.other).kra_pin)

    def test_duplicate_pin_on_second_business_is_rejected(self):
        self.assertEqual(self.put_profile(self.owner, "P051234567X").status_code, 200)
        res = self.put_profile(self.other, "p051234567x")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["kra_pin"], [self.DUP_MSG])
        # Re-saving your own PIN is not a duplicate.
        self.assertEqual(self.put_profile(self.owner, "P051234567X").status_code, 200)

    def submit(self, user, pin, **changes):
        self.client.force_authenticate(user)
        return self.client.post(self.assess_url, {**LOW_RISK, **changes, "kra_pin": pin}, format="json")

    def test_first_assessment_creates_profile_with_pin(self):
        res = self.submit(self.owner, "p051234567x")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(self.profile(self.owner).kra_pin, "P051234567X")

    def test_assessment_never_overwrites_existing_pin(self):
        self.assertEqual(self.submit(self.owner, "P051234567X").status_code, 201)
        self.assertEqual(self.submit(self.owner, "P999999999Z").status_code, 201)
        self.assertEqual(self.profile(self.owner).kra_pin, "P051234567X")

    def test_assessment_fills_pin_when_profile_has_none(self):
        self.assertEqual(self.put_profile(self.owner, "").status_code, 200)
        self.assertEqual(self.submit(self.owner, "P051234567X").status_code, 201)
        self.assertEqual(self.profile(self.owner).kra_pin, "P051234567X")

    def test_assessment_with_bad_or_duplicate_pin_saves_nothing(self):
        res = self.submit(self.owner, "A051234567X")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["kra_pin"], [self.FORMAT_MSG])
        self.put_profile(self.other, "P051234567X")
        res = self.submit(self.owner, "P051234567X")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["kra_pin"], [self.DUP_MSG])
        self.assertEqual(CreditRequest.objects.filter(user=self.owner).count(), 0)

    def test_analyst_sees_pin_owner_list_does_not(self):
        created = self.submit(self.owner, "P051234567X").json()
        self.assertNotIn("kra_pin", str(created))
        analyst = User.objects.create_user(username="pa", email="pa@test.ke", password="x", role="analyst")
        self.client.force_authenticate(analyst)
        detail = self.client.get(f"/api/scoring/assessments/{created['pk']}/").json()
        self.assertEqual(detail["business"]["kra_pin"], "P051234567X")

    def test_data_migration_normalises_and_nulls(self):
        import importlib
        from django.apps import apps
        from .models import BusinessProfile
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


class BusinessProfileRoundTripTests(TestCase):
    """PUT then GET returns the same values; an assessment never overwrites saved profile fields."""
    url = "/api/scoring/business-profile/"
    SAVED = {
        "business_name": "Kamau Hardware", "kra_pin": "P051234567X", "sector": "Services", "county": "Kisumu",
        "location_type": "Rural", "legal_status": "Partnership", "business_age_years": 7, "employees_count": 12,
    }

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.owner = User.objects.create_user(username="rt", email="rt@test.ke", password="x", role="owner")
        self.client.force_authenticate(self.owner)

    def test_put_then_get_returns_same_values(self):
        put = self.client.put(self.url, self.SAVED, format="json")
        self.assertEqual(put.status_code, 200, put.content)
        got = self.client.get(self.url).json()
        for field, value in self.SAVED.items():
            self.assertEqual(got[field], value, field)

    def test_assessment_keeps_saved_profile_fields(self):
        self.client.put(self.url, self.SAVED, format="json")
        # LOW_RISK differs in every profile field (name, sector, county, location, legal status, size).
        res = self.client.post("/api/scoring/assess/", {**LOW_RISK, "kra_pin": "P999999999Z"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        got = self.client.get(self.url).json()
        for field, value in self.SAVED.items():
            self.assertEqual(got[field], value, field)

    def test_assessment_fills_only_empty_fields(self):
        from .models import BusinessProfile
        self.client.put(self.url, self.SAVED, format="json")
        BusinessProfile.objects.filter(user=self.owner).update(business_name="", kra_pin=None)
        self.client.post("/api/scoring/assess/", {**LOW_RISK, "kra_pin": "P999999999Z"}, format="json")
        got = self.client.get(self.url).json()
        self.assertEqual(got["business_name"], LOW_RISK["business_name"])  # was empty -> filled
        self.assertEqual(got["kra_pin"], "P999999999Z")                     # was empty -> filled
        self.assertEqual(got["sector"], "Services")                        # saved -> kept
