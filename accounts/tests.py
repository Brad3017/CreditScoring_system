"""
Account tests: profile fields on PATCH /api/auth/me/, token refresh, login payload, role stability.
Run with: python manage.py test accounts
"""
import importlib
from datetime import timedelta

from django.apps import apps
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

User = get_user_model()
ME = "/api/auth/me/"
PHONE_MSG = "Enter a Kenyan mobile number in the format +254712345678."
NID_DUP_MSG = "This national ID number is already registered to another account."


class MeProfileFieldsTests(TestCase):
    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.user = User.objects.create_user(username="u1", email="u1@test.ke", password="x", role="owner")
        self.client.force_authenticate(self.user)

    def test_patch_saves_and_returns_new_fields(self):
        res = self.client.patch(ME, {
            "full_name": "Amina Otieno", "national_id": "12345678", "phone": "0712 345 678", "county": "Kisumu",
        }, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["national_id"], "12345678")
        self.assertEqual(body["phone"], "+254712345678")  # normalised
        self.assertEqual(body["county"], "Kisumu")
        self.user.refresh_from_db()
        self.assertEqual(
            (self.user.full_name, self.user.national_id, self.user.phone, self.user.county),
            ("Amina Otieno", "12345678", "+254712345678", "Kisumu"),
        )
        self.assertEqual(self.client.get(ME).json()["phone"], "+254712345678")

    def test_email_and_role_are_read_only(self):
        res = self.client.patch(ME, {"email": "x@test.ke", "role": "admin"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual((self.user.email, self.user.role), ("u1@test.ke", "owner"))

    def test_phone_formats(self):
        for given, stored in (
            ("+254712345678", "+254712345678"),
            ("0112345678", "+254112345678"),
            ("254712345678", "+254712345678"),
        ):
            res = self.client.patch(ME, {"phone": given}, format="json")
            self.assertEqual(res.status_code, 200, given)
            self.assertEqual(res.json()["phone"], stored)
        for bad in ("+254812345678", "071234567", "+2547123456789", "12345"):
            res = self.client.patch(ME, {"phone": bad}, format="json")
            self.assertEqual(res.status_code, 400, bad)
            self.assertEqual(res.json()["phone"], [PHONE_MSG])

    def test_duplicate_national_id_rejected_and_blanks_do_not_clash(self):
        other = User.objects.create_user(username="u2", email="u2@test.ke", password="x", role="owner", national_id="12345678")
        res = self.client.patch(ME, {"national_id": "12345678"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["national_id"], [NID_DUP_MSG])
        other.national_id = ""
        other.save()
        self.assertEqual(self.client.patch(ME, {"national_id": "  "}, format="json").status_code, 200)
        self.user.refresh_from_db()
        other.refresh_from_db()
        self.assertIsNone(self.user.national_id)
        self.assertIsNone(other.national_id)


class TokenRefreshTests(TestCase):
    """Backend half of the refresh flow. The frontend retry is checked in the browser."""

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")
        self.user = User.objects.create_user(username="r1", email="r1@test.ke", password="x", role="owner")

    def test_expired_access_is_401_then_refresh_gives_a_working_token(self):
        expired = AccessToken.for_user(self.user)
        expired.set_exp(lifetime=timedelta(seconds=-1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired}")
        res = self.client.get(ME)
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["code"], "token_not_valid")

        self.client.credentials()
        refreshed = self.client.post("/api/auth/refresh/", {"refresh": str(RefreshToken.for_user(self.user))}, format="json")
        self.assertEqual(refreshed.status_code, 200)
        self.assertIn("access", refreshed.json())
        self.assertIn("refresh", refreshed.json())  # rotation is on: the client must store the new one

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.json()['access']}")
        self.assertEqual(self.client.get(ME).status_code, 200)

    def test_bad_refresh_token_is_401(self):
        res = self.client.post("/api/auth/refresh/", {"refresh": "nonsense"}, format="json")
        self.assertEqual(res.status_code, 401)


class LoginTests(TestCase):
    def test_login_returns_user_and_records_last_login(self):
        User.objects.create_user(username="l1", email="l1@test.ke", password="Secret-123", role="analyst", full_name="Lee One")
        res = APIClient(HTTP_HOST="localhost").post(
            "/api/auth/login/", {"email": "l1@test.ke", "password": "Secret-123"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(set(res.json()["user"]), {"id", "email", "full_name", "role"})
        self.assertEqual(res.json()["user"]["full_name"], "Lee One")
        self.assertIsNotNone(User.objects.get(email="l1@test.ke").last_login)


class AdminRoleStabilityTests(TestCase):
    """Using the analyst workspace must never change an admin's role."""

    def test_admin_role_unchanged_after_analyst_endpoints(self):
        from scoring.models import CreditAssessment, CreditRequest

        admin = User.objects.create_user(username="ad", email="ad@test.ke", password="x", role="admin")
        owner = User.objects.create_user(username="ow", email="ow@test.ke", password="x", role="owner")
        req = CreditRequest.objects.create(user=owner, business_name="Biz", monthly_profit_kes=1000)
        a = CreditAssessment.objects.create(
            request=req, probability_of_default=0.5, credit_score=575,
            risk_category="Moderate Risk", model_version="xgb_msme_v2",
        )
        client = APIClient(HTTP_HOST="localhost")
        client.force_authenticate(admin)
        for res in (
            client.get("/api/scoring/assessments/all/"),
            client.get(f"/api/scoring/assessments/{a.pk}/"),
            client.post(f"/api/scoring/assessments/{a.pk}/review/", {"decision": "approved"}, format="json"),
            client.get(ME),
        ):
            self.assertEqual(res.status_code, 200, res.content)
        admin.refresh_from_db()
        self.assertEqual(admin.role, "admin")
        self.assertEqual(client.get(ME).json()["role"], "admin")


class ContactMigrationTests(TestCase):
    def test_data_migration_normalises_contact_fields(self):
        mig = importlib.import_module("accounts.migrations.0002_normalise_contact_fields")
        planted = [("", "0712 345 678", ""), ("111", "garbage", "Nairobi"), ("222", "+254112345678", "Mombasa")]
        pks = []
        for i, (nid, phone, county) in enumerate(planted):
            u = User.objects.create_user(username=f"m{i}", email=f"m{i}@test.ke", password="x")
            # .update() bypasses User.save(), planting the raw legacy values.
            User.objects.filter(pk=u.pk).update(national_id=nid, phone=phone, county=county)
            pks.append(u.pk)
        changed = mig.normalise_contact_fields(apps, None)
        row = lambda i: User.objects.values_list("national_id", "phone", "county").get(pk=pks[i])
        self.assertEqual(row(0), (None, "+254712345678", None))  # blanks -> NULL, phone normalised
        self.assertEqual(row(1), ("111", None, "Nairobi"))         # invalid phone -> NULL
        self.assertEqual(row(2), ("222", "+254112345678", "Mombasa"))  # already valid, untouched
        self.assertEqual(changed, 2)
