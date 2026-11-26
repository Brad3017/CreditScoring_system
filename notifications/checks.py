"""
Reminders that depend on time passing, created lazily instead of by a scheduler: the unread-count endpoint
runs the check for the signed-in user (at most every 10 minutes, see views.UnreadCountView), and
`manage.py send_expiry_reminders` runs the owner check for everyone. The dedupe keys make running a check
again harmless.
"""
from datetime import timedelta

from django.db.models import F, Q
from django.utils import timezone

from scoring.models import CreditAssessment
from scoring.validity import EXPIRED, VALID, get_validity, short_date, with_superseded

from .models import Notification
from .services import REVIEW_QUEUE_LINK, notify_now, owner_assessment_link

EXPIRING_WITHIN_DAYS = 7
OVERDUE_AFTER = timedelta(hours=48)


def check_owner_reminders(user):
    """score_expiring (valid, 7 days or fewer left) and score_expired, for each of the owner's assessments
    that is the latest for its business. Superseded assessments never get a reminder."""
    soon = timezone.now() + timedelta(days=EXPIRING_WITHIN_DAYS)
    candidates = with_superseded(
        CreditAssessment.objects.filter(request__user=user, valid_until__isnull=False, valid_until__lte=soon)
        .select_related("request")
    ).filter(is_superseded=False)

    for a in candidates:
        v = get_validity(a)
        name = a.request.business_name or "your business"
        if v["status"] == VALID and v["days_remaining"] is not None and v["days_remaining"] <= EXPIRING_WITHIN_DAYS:
            notify_now(
                user, Notification.SCORE_EXPIRING, "Your score expires soon",
                f"Your score for {name} expires on {short_date(a.valid_until)}. Re-assess to keep it valid.",
                link=owner_assessment_link(a.pk), assessment=a, dedupe_key=f"expiring:{a.pk}",
            )
        elif v["status"] == EXPIRED:
            notify_now(
                user, Notification.SCORE_EXPIRED, "Your score has expired",
                f"Your score for {name} expired on {short_date(a.valid_until)}. "
                "Start a new assessment when you're ready.",
                link=owner_assessment_link(a.pk), assessment=a, dedupe_key=f"expired:{a.pk}",
            )


def overdue_queryset(now=None):
    """Applications waiting for an analyst for more than 48 hours: still pending since submission, or an
    owner's review request with no decision recorded since (both are in the queue's Pending tab)."""
    cutoff = (now or timezone.now()) - OVERDUE_AFTER
    open_request = Q(review_requested_at__isnull=False, review_requested_at__lt=cutoff) & (
        Q(reviewed_at__isnull=True) | Q(reviewed_at__lt=F("review_requested_at"))
    )
    return CreditAssessment.objects.filter(Q(review_status="pending", created_at__lt=cutoff) | open_request)


def check_analyst_reminders(user):
    """At most one queue_overdue per analyst per day (Nairobi date)."""
    n = overdue_queryset().count()
    if n <= 0:
        return
    today = timezone.localdate().isoformat()
    noun = "application has" if n == 1 else "applications have"
    notify_now(
        user, Notification.QUEUE_OVERDUE, "Applications waiting",
        f"{n} {noun} been waiting more than 2 days.",
        link=REVIEW_QUEUE_LINK, dedupe_key=f"overdue:{user.pk}:{today}",
    )


def run_checks_for(user):
    if user.role == "owner":
        check_owner_reminders(user)
    elif user.role == "analyst":
        check_analyst_reminders(user)
