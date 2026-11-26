"""
In-app notifications: event hooks, dedupe, lazy reminder checks, the /api/notifications/ endpoints and the
management commands.

    python manage.py test notifications --keepdb

Notifications are created in transaction.on_commit callbacks. TestCase never commits, so every test that
expects one runs the action inside self.captureOnCommitCallbacks(execute=True).
"""
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.testing import consenting_user
from scoring import services as scoring_services
from scoring.models import BusinessProfile, CreditAssessment, CreditRequest
from scoring.validity import short_date

from notifications import checks, services
from notifications.checks import check_analyst_reminders, check_owner_reminders
from notifications.models import Notification
from notifications.views import check_key

# A middling applicant, written the way the form sends it.
APPLICATION = {
    "business_name": "Mama Njeri Groceries",
    "county": "Nairobi",
    "sector": "Retail",
    "legal_status": "Sole",
    "location_type": "Urban",
    "loan_purpose": "Working capital",
    "business_age_years": 4,
    "employees_count": 3,
    "monthly_revenue_kes": 120_000,
    "monthly_profit_kes": 30_000,
    "loan_amount": 100_000,
    "tenure_months": 12,
    "existing_loans": False,
    "prior_loan_count": 0,
    "late_payment_history": "Never",
    "collateral_level": "Moderate",
    "cashflow_stability": 3,
    "owner_education": "Secondary",
    "days_payable_outstanding": 30,
}


class Base(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.owner = consenting_user(username="o1", email="o1@test.ke", password="x", role="owner")
        self.other_owner = consenting_user(username="o2", email="o2@test.ke", password="x", role="owner")
        self.analyst = consenting_user(username="a1", email="a1@test.ke", password="x", role="analyst",
                                       full_name="Ann Analyst")
        self.analyst2 = consenting_user(username="a2", email="a2@test.ke", password="x", role="analyst")
        self.inactive_analyst = consenting_user(username="a3", email="a3@test.ke", password="x", role="analyst",
                                                is_active=False)
        self.admin = consenting_user(username="ad", email="ad@test.ke", password="x", role="admin")

    def submit(self, user=None):
        self.client.force_authenticate(user or self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/scoring/assess/", APPLICATION, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return CreditAssessment.objects.get(pk=res.json()["pk"])

    def business(self, user=None, name="Duka Moja"):
        return BusinessProfile.objects.create(user=user or self.owner, business_name=name, sector="Retail",
                                              business_age_years=3, legal_status="Sole", location_type="Urban",
                                              employees_count=2, county="Nairobi")

    def make(self, business=None, created_days_ago=0, valid_for_days=30, owner=None, **fields):
        """An assessment created directly (no scoring): created N days ago, valid_until = now + valid_for_days."""
        owner = owner or self.owner
        req = CreditRequest.objects.create(user=owner, business=business,
                                           business_name=business.business_name if business else "Kibanda",
                                           monthly_profit_kes=1000)
        a = CreditAssessment.objects.create(request=req, probability_of_default=0.3, credit_score=640,
                                            risk_category="Moderate Risk",
                                            model_version=scoring_services.MODEL_VERSION)
        now = timezone.now()
        CreditAssessment.objects.filter(pk=a.pk).update(
            created_at=now - timedelta(days=created_days_ago), valid_until=now + timedelta(days=valid_for_days),
            **fields)
        a.refresh_from_db()
        return a

    def of(self, user, type=None):
        qs = Notification.objects.filter(recipient=user)
        return qs.filter(type=type) if type else qs


# ---- 1–4: event hooks and dedupe ---------------------------------------------------------------------------

class EventHookTests(Base):
    def test_submission_notifies_each_active_analyst_only(self):
        a = self.submit()
        for analyst in (self.analyst, self.analyst2):
            notes = self.of(analyst, Notification.ASSESSMENT_SUBMITTED)
            self.assertEqual(notes.count(), 1)
            n = notes.get()
            self.assertEqual(n.title, "New application")
            self.assertEqual(n.message, "Mama Njeri Groceries submitted an application for review.")
            self.assertEqual(n.link, f"/analyst/requests/{a.pk}")
            self.assertEqual(n.assessment_id, a.pk)
        for user in (self.inactive_analyst, self.owner, self.other_owner, self.admin):
            self.assertFalse(self.of(user).exists(), user)

    def test_decision_notifies_the_owner_without_score_band_or_amounts(self):
        a = self.submit()
        self.client.force_authenticate(self.analyst)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"/api/scoring/assessments/{a.pk}/review/",
                                   {"decision": "declined", "note": "Cash flow too uneven for now."}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        n = self.of(self.owner, Notification.DECISION_MADE).get()
        self.assertEqual(n.title, "Decision on your application")
        self.assertEqual(n.message, "A credit analyst has reviewed your assessment for Mama Njeri Groceries. "
                                    "Open it to see the outcome.")
        self.assertEqual(n.link, f"/assessments/{a.pk}")
        a.refresh_from_db()
        text = f"{n.title} {n.message}"
        self.assertNotIn(str(a.credit_score), text)
        self.assertNotIn(a.risk_category, text)
        for word in ("Low", "Moderate", "High", "Risk", "KES", "declined", "approved"):
            self.assertNotIn(word, text)
        self.assertNotIn(f"{int(a.recommended_limit):,}", text)
        # Nobody else hears about it.
        self.assertFalse(self.of(self.other_owner).exists())

    def test_a_second_decision_is_a_new_notification(self):
        a = self.submit()
        self.client.force_authenticate(self.analyst)
        for decision, note in (("referred", "Please send six months of statements."), ("declined", "Still short.")):
            with self.captureOnCommitCallbacks(execute=True):
                self.client.post(f"/api/scoring/assessments/{a.pk}/review/", {"decision": decision, "note": note},
                                 format="json")
        self.assertEqual(self.of(self.owner, Notification.DECISION_MADE).count(), 2)

    def test_review_request_notifies_analysts(self):
        a = self.submit()
        self.client.force_authenticate(self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"/api/scoring/assessments/{a.pk}/request-review/",
                                   {"reason": "My sales rose after the rains."}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        for analyst in (self.analyst, self.analyst2):
            n = self.of(analyst, Notification.REVIEW_REQUESTED).get()
            self.assertEqual(n.title, "Review requested")
            self.assertEqual(n.message, "The owner of Mama Njeri Groceries has asked for a review of their assessment.")
            self.assertEqual(n.link, f"/analyst/requests/{a.pk}")
        self.assertFalse(self.of(self.admin).exists())
        self.assertFalse(self.of(self.inactive_analyst).exists())

    def test_same_event_twice_is_one_notification_per_recipient(self):
        a = self.submit()
        with self.captureOnCommitCallbacks(execute=True):
            services.assessment_submitted(a)
            services.assessment_submitted(a)
            services.notify(self.owner, Notification.DECISION_MADE, "t", "m", dedupe_key="decision:x")
            services.notify(self.owner, Notification.DECISION_MADE, "t", "m", dedupe_key="decision:x")
        self.assertEqual(self.of(self.analyst, Notification.ASSESSMENT_SUBMITTED).count(), 1)
        self.assertEqual(self.of(self.analyst2, Notification.ASSESSMENT_SUBMITTED).count(), 1)
        self.assertEqual(self.of(self.owner, Notification.DECISION_MADE).count(), 1)

    def test_nothing_is_created_when_the_transaction_rolls_back(self):
        a = self.make()
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            services.assessment_submitted(a)
        self.assertEqual(len(callbacks), 1)       # waiting for the commit
        self.assertFalse(Notification.objects.exists())

    def test_a_failing_notification_does_not_break_assessment_creation(self):
        with mock.patch.object(Notification.objects, "get_or_create", side_effect=RuntimeError("db down")), \
                mock.patch.object(Notification.objects, "create", side_effect=RuntimeError("db down")), \
                self.assertLogs("notifications.services", level="ERROR"):
            a = self.submit()
        self.assertTrue(CreditAssessment.objects.filter(pk=a.pk).exists())
        self.assertFalse(Notification.objects.exists())

    def test_a_failing_schedule_does_not_break_the_decision(self):
        a = self.submit()
        self.client.force_authenticate(self.analyst)
        with mock.patch("django.db.transaction.on_commit", side_effect=RuntimeError("no transaction")),                 self.assertLogs("notifications.services", level="ERROR"):
            res = self.client.post(f"/api/scoring/assessments/{a.pk}/review/",
                                   {"decision": "referred", "note": "Need statements."}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        a.refresh_from_db()
        self.assertEqual(a.review_status, "referred")


# ---- 5–6: lazy reminder checks -----------------------------------------------------------------------------

class OwnerReminderTests(Base):
    def run_check(self, user=None):
        check_owner_reminders(user or self.owner)

    def test_score_expiring_within_seven_days(self):
        a = self.make(business=self.business(), valid_for_days=5)
        self.run_check()
        self.run_check()
        n = self.of(self.owner, Notification.SCORE_EXPIRING).get()
        self.assertEqual(n.title, "Your score expires soon")
        self.assertEqual(n.message, f"Your score for Duka Moja expires on {short_date(a.valid_until)}. "
                                    "Re-assess to keep it valid.")
        self.assertEqual(n.link, f"/assessments/{a.pk}")
        self.assertEqual(n.dedupe_key, f"expiring:{a.pk}")

    def test_no_reminder_with_more_than_seven_days_left(self):
        self.make(business=self.business(), valid_for_days=20)
        self.run_check()
        self.assertFalse(self.of(self.owner).exists())

    def test_score_expired(self):
        a = self.make(business=self.business(), created_days_ago=40, valid_for_days=-10)
        self.run_check()
        self.run_check()
        n = self.of(self.owner, Notification.SCORE_EXPIRED).get()
        self.assertEqual(n.title, "Your score has expired")
        self.assertIn("Start a new assessment when you're ready.", n.message)
        self.assertEqual(n.dedupe_key, f"expired:{a.pk}")
        self.assertFalse(self.of(self.owner, Notification.SCORE_EXPIRING).exists())

    def test_superseded_assessment_gets_no_reminder(self):
        biz = self.business()
        old = self.make(business=biz, created_days_ago=26, valid_for_days=4)
        new = self.make(business=biz, created_days_ago=1, valid_for_days=29)
        self.run_check()
        self.assertFalse(self.of(self.owner).filter(assessment=old).exists())
        self.assertFalse(self.of(self.owner).exists())  # the newer one is not expiring either
        self.assertTrue(CreditAssessment.objects.filter(pk=new.pk).exists())

    def test_only_the_owners_own_assessments(self):
        self.make(business=self.business(user=self.other_owner, name="Other"), owner=self.other_owner,
                  valid_for_days=3)
        self.run_check(self.owner)
        self.assertFalse(Notification.objects.exists())


class AnalystReminderTests(Base):
    def run_check(self):
        check_analyst_reminders(self.analyst)

    def test_pending_for_more_than_48_hours_once_a_day(self):
        self.make(created_days_ago=3)
        self.make(created_days_ago=4)
        self.make(created_days_ago=0)                     # not overdue
        self.make(created_days_ago=5, review_status="approved", reviewed_at=timezone.now())  # decided
        self.run_check()
        self.run_check()
        n = self.of(self.analyst, Notification.QUEUE_OVERDUE).get()
        self.assertEqual(n.title, "Applications waiting")
        self.assertEqual(n.message, "2 applications have been waiting more than 2 days.")
        self.assertEqual(n.link, "/analyst/requests")
        self.assertEqual(n.dedupe_key, f"overdue:{self.analyst.pk}:{timezone.localdate().isoformat()}")

    def test_open_review_request_older_than_48_hours_counts(self):
        decided = timezone.now() - timedelta(days=4)
        self.make(created_days_ago=5, review_status="declined", reviewed_at=decided,
                  review_requested_at=timezone.now() - timedelta(days=3), review_request_reason="Please look again")
        self.run_check()
        self.assertEqual(self.of(self.analyst, Notification.QUEUE_OVERDUE).get().message,
                         "1 application has been waiting more than 2 days.")

    def test_nothing_overdue_nothing_created(self):
        self.make(created_days_ago=1)
        self.run_check()
        self.assertFalse(Notification.objects.exists())


# ---- 7: endpoints ------------------------------------------------------------------------------------------

class EndpointTests(Base):
    def add(self, user, n=1, read=False, **kw):
        made = []
        for i in range(n):
            made.append(Notification.objects.create(
                recipient=user, type=Notification.DECISION_MADE, title=f"T{i}", message="M", link="/x",
                read_at=timezone.now() if read else None, **kw))
        return made

    def test_unread_count(self):
        self.add(self.owner, 3)
        self.add(self.owner, 2, read=True)
        self.add(self.other_owner, 4)
        self.client.force_authenticate(self.owner)
        res = self.client.get("/api/notifications/unread-count/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"unread": 3})

    def test_unread_count_runs_the_checks_at_most_every_ten_minutes(self):
        a = self.make(business=self.business(), valid_for_days=5)
        self.client.force_authenticate(self.owner)
        with mock.patch("notifications.views.run_checks_for", wraps=checks.run_checks_for) as run:
            self.assertEqual(self.client.get("/api/notifications/unread-count/").json(), {"unread": 1})
            self.client.get("/api/notifications/unread-count/")
            self.assertEqual(run.call_count, 1)
            cache.delete(check_key(self.owner.pk))          # ten minutes later
            self.client.get("/api/notifications/unread-count/")
            self.assertEqual(run.call_count, 2)
        self.assertEqual(self.of(self.owner, Notification.SCORE_EXPIRING).get().assessment_id, a.pk)

    def test_list_returns_only_own_notifications_paginated(self):
        self.add(self.owner, 22)
        self.add(self.owner, 1, read=True)
        self.add(self.other_owner, 5)
        self.client.force_authenticate(self.owner)
        body = self.client.get("/api/notifications/").json()
        self.assertEqual(body["count"], 23)
        self.assertEqual(len(body["results"]), 20)
        self.assertIsNotNone(body["next"])
        self.assertEqual(set(body["results"][0]), {"id", "type", "title", "message", "link", "created_at", "read_at"})
        own = set(self.of(self.owner).values_list("id", flat=True))
        page2 = self.client.get("/api/notifications/?page=2").json()["results"]
        self.assertEqual(len(page2), 3)
        self.assertTrue({r["id"] for r in body["results"] + page2} <= own)
        unread = self.client.get("/api/notifications/?unread=true").json()
        self.assertEqual(unread["count"], 22)
        self.assertTrue(all(r["read_at"] is None for r in unread["results"]))

    def test_list_is_newest_first(self):
        old, new = self.add(self.owner, 2)
        Notification.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=2))
        self.client.force_authenticate(self.owner)
        ids = [r["id"] for r in self.client.get("/api/notifications/").json()["results"]]
        self.assertEqual(ids, [new.pk, old.pk])

    def test_mark_read(self):
        (mine,) = self.add(self.owner)
        self.client.force_authenticate(self.owner)
        res = self.client.post(f"/api/notifications/{mine.pk}/read/")
        self.assertEqual(res.status_code, 200)
        mine.refresh_from_db()
        first = mine.read_at
        self.assertIsNotNone(first)
        self.client.post(f"/api/notifications/{mine.pk}/read/")   # already read: unchanged
        mine.refresh_from_db()
        self.assertEqual(mine.read_at, first)

    def test_marking_someone_elses_notification_is_404(self):
        (theirs,) = self.add(self.other_owner)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(f"/api/notifications/{theirs.pk}/read/").status_code, 404)
        theirs.refresh_from_db()
        self.assertIsNone(theirs.read_at)

    def test_read_all(self):
        self.add(self.owner, 4)
        self.add(self.owner, 1, read=True)
        self.add(self.other_owner, 2)
        self.client.force_authenticate(self.owner)
        res = self.client.post("/api/notifications/read-all/")
        self.assertEqual(res.json(), {"marked": 4})
        self.assertFalse(self.of(self.owner).filter(read_at__isnull=True).exists())
        self.assertEqual(self.of(self.other_owner).filter(read_at__isnull=True).count(), 2)

    def test_unauthenticated_is_401(self):
        (n,) = self.add(self.owner)
        for method, url in (("get", "/api/notifications/unread-count/"), ("get", "/api/notifications/"),
                            ("post", f"/api/notifications/{n.pk}/read/"), ("post", "/api/notifications/read-all/")):
            self.assertEqual(getattr(self.client, method)(url).status_code, 401, url)

    def test_consent_is_required(self):
        # A user who has not accepted the privacy notice yet.
        fresh = get_user_model().objects.create_user(username="nc", email="nc@test.ke", password="x", role="owner")
        self.client.force_authenticate(fresh)
        res = self.client.get("/api/notifications/unread-count/")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["code"], "consent_required")

    def test_staff_see_their_own_too(self):
        self.add(self.analyst, 2)
        self.client.force_authenticate(self.analyst)
        self.assertEqual(self.client.get("/api/notifications/unread-count/").json(), {"unread": 2})


# ---- 9: purge command, and the reminder command ------------------------------------------------------------

class CommandTests(Base):
    def test_purge_deletes_only_read_notifications_older_than_n_days(self):
        def make(days_old, read):
            n = Notification.objects.create(recipient=self.owner, type=Notification.DECISION_MADE, title="t",
                                            message="m", read_at=timezone.now() if read else None)
            Notification.objects.filter(pk=n.pk).update(created_at=timezone.now() - timedelta(days=days_old))
            return n.pk
        old_read = make(100, True)
        old_unread = make(100, False)
        new_read = make(10, True)
        out = StringIO()
        call_command("purge_notifications", "--days", "90", stdout=out)
        self.assertIn("Deleted 1 read notification(s)", out.getvalue())
        remaining = set(Notification.objects.values_list("id", flat=True))
        self.assertNotIn(old_read, remaining)
        self.assertEqual(remaining, {old_unread, new_read})

    def test_send_expiry_reminders(self):
        self.make(business=self.business(), valid_for_days=5)
        self.make(business=self.business(user=self.other_owner, name="Other"), owner=self.other_owner,
                  created_days_ago=40, valid_for_days=-10)
        out = StringIO()
        call_command("send_expiry_reminders", stdout=out)
        self.assertIn("2 reminder(s) created", out.getvalue())
        out = StringIO()
        call_command("send_expiry_reminders", stdout=out)
        self.assertIn("0 reminder(s) created", out.getvalue())
        self.assertEqual(Notification.objects.count(), 2)
