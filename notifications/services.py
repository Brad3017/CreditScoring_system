"""
Creating notifications. Call these explicitly where the event happens (views, checks, commands), never from
signals.

    notify(recipient, type, title, message, link="", assessment=None, dedupe_key=None)
    notify_role(role, type, ...)      every ACTIVE user with that role ("analyst" or "admin")

Both run after the surrounding transaction commits (transaction.on_commit), so a notification exists only if
the action it reports was actually saved. Outside a transaction they run straight away.

A notification must never break the action it reports: every failure here is logged and swallowed.
"""
import logging

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from .models import Notification

logger = logging.getLogger(__name__)


def _fit(text, limit):
    text = str(text or "")
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _create(recipient, type, title, message, link, assessment, dedupe_key):
    """Creates one notification now. With a dedupe_key, at most one per (recipient, dedupe_key)."""
    fields = {
        "type": type,
        "title": _fit(title, 120),
        "message": _fit(message, 300),
        "link": _fit(link, 200),
        "assessment": assessment,
    }
    try:
        # A savepoint, so a failure here can never spoil a transaction the caller is still in.
        with transaction.atomic():
            if dedupe_key:
                Notification.objects.get_or_create(recipient=recipient, dedupe_key=dedupe_key, defaults=fields)
            else:
                Notification.objects.create(recipient=recipient, **fields)
    except IntegrityError:
        # The same dedupe_key was created by a parallel request: that one stands.
        pass
    except Exception:
        logger.exception("Could not create a %s notification for user %s.", type, getattr(recipient, "pk", None))


def _after_commit(fn):
    try:
        transaction.on_commit(fn)
    except Exception:
        logger.exception("Could not schedule a notification.")


def notify(recipient, type, title, message, link="", assessment=None, dedupe_key=None):
    def run():
        _create(recipient, type, title, message, link, assessment, dedupe_key)

    _after_commit(run)


def notify_now(recipient, type, title, message, link="", assessment=None, dedupe_key=None):
    """For the reminder checks: they do not report another action, so there is no commit to wait for, and
    send_expiry_reminders can count what it created. Never raises either."""
    _create(recipient, type, title, message, link, assessment, dedupe_key)


def notify_role(role, type, title, message, link="", assessment=None, dedupe_key=None):
    def run():
        try:
            recipients = list(get_user_model().objects.filter(role=role, is_active=True))
        except Exception:
            logger.exception("Could not look up %s users to notify.", role)
            return
        for user in recipients:
            _create(user, type, title, message, link, assessment, dedupe_key)

    _after_commit(run)


# ---- Links: the page each kind of user opens for an assessment -------------------------------------------

def owner_assessment_link(assessment_id):
    return f"/assessments/{assessment_id}"


def staff_assessment_link(assessment_id):
    return f"/analyst/requests/{assessment_id}"


REVIEW_QUEUE_LINK = "/analyst/requests"


# ---- The events (one function each, so views stay short and the wording lives in one place) --------------

def assessment_submitted(assessment):
    name = assessment.request.business_name or "A business"
    notify_role(
        "analyst", Notification.ASSESSMENT_SUBMITTED, "New application",
        f"{name} submitted an application for review.",
        link=staff_assessment_link(assessment.pk), assessment=assessment,
        dedupe_key=f"submitted:{assessment.pk}",
    )


def decision_made(assessment):
    """No outcome, score, band or amount in the text: the owner opens the result to see it."""
    name = assessment.request.business_name or "your business"
    notify(
        assessment.request.user, Notification.DECISION_MADE, "Decision on your application",
        f"A credit analyst has reviewed your assessment for {name}. Open it to see the outcome.",
        link=owner_assessment_link(assessment.pk), assessment=assessment,
        dedupe_key=f"decision:{assessment.pk}:{assessment.reviewed_at.isoformat()}",
    )


def review_requested(assessment):
    name = assessment.request.business_name or "a business"
    notify_role(
        "analyst", Notification.REVIEW_REQUESTED, "Review requested",
        f"The owner of {name} has asked for a review of their assessment.",
        link=staff_assessment_link(assessment.pk), assessment=assessment,
        dedupe_key=f"review:{assessment.pk}:{assessment.review_requested_at.isoformat()}",
    )
