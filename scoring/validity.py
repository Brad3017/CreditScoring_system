"""
Score validity: the single source of truth for whether a credit score can still be relied on.

    valid       valid_until is in the future and no newer assessment exists for the same business
    expired     valid_until has passed
    superseded  a newer assessment exists for the same business (takes precedence over expired)

Nothing here changes a record: the status is always derived from the stored valid_until and from
which assessments exist. valid_until itself is set once, on creation (CreditAssessment.save()).
"""
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from .models import CreditAssessment

VALID, EXPIRED, SUPERSEDED = "valid", "expired", "superseded"

MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _newer_than(outer):
    """Assessments for the same business created after `outer` (an assessment, or OuterRef rows).
    Ties on created_at are broken by id, so of two assessments created in the same instant exactly one
    is the newest. Assessments with no business are never superseded (business_id NULL matches nothing)."""
    business, created, pk = outer
    return CreditAssessment.objects.filter(request__business_id=business).filter(
        Q(created_at__gt=created) | Q(created_at=created, id__gt=pk)
    )


def is_superseded(assessment):
    """True if another assessment exists for the same business with a later creation time."""
    business_id = assessment.request.business_id
    if business_id is None:
        return False
    return _newer_than((business_id, assessment.created_at, assessment.pk)).exists()


def with_superseded(queryset):
    """Annotate is_superseded with one Exists() subquery, so a list never runs a query per row."""
    newer = _newer_than((OuterRef("request__business_id"), OuterRef("created_at"), OuterRef("pk")))
    return queryset.annotate(is_superseded=Exists(newer))


def get_validity(assessment, superseded=None):
    """superseded may be passed in pre-computed (from with_superseded) to avoid extra queries.
    When it is not passed, the annotation is used if the assessment came from with_superseded()."""
    if superseded is None:
        superseded = getattr(assessment, "is_superseded", None)
    if superseded is None:
        superseded = is_superseded(assessment)
    now = timezone.now()
    if superseded:
        status = SUPERSEDED
    elif assessment.valid_until and now > assessment.valid_until:
        status = EXPIRED
    else:
        status = VALID
    days_remaining = None
    if status == VALID and assessment.valid_until:
        delta = assessment.valid_until - now
        days_remaining = max(0, delta.days + (1 if delta.seconds or delta.microseconds else 0))
    return {"status": status, "valid_until": assessment.valid_until, "days_remaining": days_remaining}


def validity_fields(assessment, superseded=None):
    """The three read-only API fields: valid_until (ISO), validity_status, days_remaining."""
    v = get_validity(assessment, superseded)
    return {
        "valid_until": v["valid_until"].isoformat() if v["valid_until"] else None,
        "validity_status": v["status"],
        "days_remaining": v["days_remaining"],
    }


def short_date(dt):
    """17 Dec 2026 in Nairobi time (the %d %b %Y format, with English month names on any server locale)."""
    d = timezone.localtime(dt)
    return f"{d.day:02d} {MONTHS[d.month - 1]} {d.year}"


def approval_block_message(assessment, validity=None):
    """The 400 detail for approving a score that is not valid, or None when approval is allowed."""
    v = validity or get_validity(assessment)
    if v["status"] == EXPIRED:
        return (f"This score expired on {short_date(v['valid_until'])}. "
                "Ask the owner to re-assess before approving.")
    if v["status"] == SUPERSEDED:
        return ("This score was superseded: a newer assessment exists for this business. "
                "Review the latest assessment instead.")
    return None
