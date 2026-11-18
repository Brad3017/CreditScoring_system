"""Consent helpers. Texts and the current version live in accounts/consent_texts.py."""
import ipaddress

from django.utils import timezone

from . import consent_texts as texts
from .models import ConsentRecord

OWNER_PURPOSES = (texts.PRIVACY_NOTICE, texts.CREDIT_SCORING, texts.STATEMENT_PROCESSING, texts.COMMUNICATIONS)
STAFF_PURPOSES = (texts.STAFF_CONFIDENTIALITY,)
WITHDRAWABLE = frozenset({texts.CREDIT_SCORING, texts.COMMUNICATIONS})


def is_staff_role(user):
    return getattr(user, "role", "owner") in ("analyst", "admin")


def purposes_for(user):
    """Every purpose relevant to this user's role."""
    return STAFF_PURPOSES if is_staff_role(user) else OWNER_PURPOSES


def required_purposes(user):
    return [texts.STAFF_CONFIDENTIALITY] if is_staff_role(user) else [texts.PRIVACY_NOTICE]


def latest(user, purpose):
    return ConsentRecord.objects.filter(user=user, purpose=purpose).order_by("-granted_at", "-id").first()


def _active(record):
    return record is not None and record.withdrawn_at is None and record.version == texts.CONSENT_VERSION


def has_consent(user, purpose):
    """True if the latest record for this purpose is for the current text and not withdrawn.
    (statement_processing is checked per upload in the upload view, not here.)"""
    return _active(latest(user, purpose))


def missing_required(user):
    return [p for p in required_purposes(user) if not has_consent(user, p)]


def client_ip(request):
    """The client address. Behind the nginx proxy the last X-Forwarded-For entry is the one nginx added
    (earlier entries are whatever the client sent). None when it is not a valid IP address."""
    if request is None:
        return None
    meta = request.META
    forwarded = [p.strip() for p in meta.get("HTTP_X_FORWARDED_FOR", "").split(",") if p.strip()]
    candidate = forwarded[-1] if forwarded else meta.get("REMOTE_ADDR")
    try:
        return str(ipaddress.ip_address(candidate)) if candidate else None
    except ValueError:
        return None


def grant(user, purpose, request=None, reference=""):
    """Records consent. Granting again after a withdrawal (or a version change) adds a NEW row. If the
    same consent is already active (and no reference is given), the existing row is returned unchanged."""
    if not reference:
        current = latest(user, purpose)
        if _active(current):
            return current
    ua = request.META.get("HTTP_USER_AGENT", "")[:255] if request is not None else ""
    return ConsentRecord.objects.create(
        user=user, purpose=purpose, version=texts.CONSENT_VERSION, granted_at=timezone.now(),
        ip_address=client_ip(request), user_agent=ua, reference=str(reference)[:64],
    )


class NotWithdrawable(ValueError):
    pass


def withdraw(user, purpose):
    """Sets withdrawn_at on the latest active record and returns it; None if nothing was active.
    Only credit_scoring and communications can be withdrawn (NotWithdrawable otherwise)."""
    if purpose not in WITHDRAWABLE:
        raise NotWithdrawable(purpose)
    record = latest(user, purpose)
    if record is None or record.withdrawn_at is not None:
        return None
    record.withdrawn_at = timezone.now()
    record.save(update_fields=["withdrawn_at"])
    return record


def status_row(user, purpose):
    record = latest(user, purpose)
    return {
        "purpose": purpose,
        "label": texts.PURPOSE_LABELS[purpose],
        "active": _active(record),
        "version": record.version if record else None,
        "granted_at": record.granted_at.isoformat() if record else None,
        "withdrawn_at": record.withdrawn_at.isoformat() if record and record.withdrawn_at else None,
        "withdrawable": purpose in WITHDRAWABLE,
    }


def history_row(record):
    return {
        "id": record.id,
        "purpose": record.purpose,
        "version": record.version,
        "granted_at": record.granted_at.isoformat(),
        "withdrawn_at": record.withdrawn_at.isoformat() if record.withdrawn_at else None,
        "ip_address": record.ip_address,
        "user_agent": record.user_agent,
        "reference": record.reference,
    }


def credit_scoring_block(owner):
    """None when the owner's credit_scoring consent is active; otherwise (code, message) explaining why an
    application of theirs can't be approved."""
    record = latest(owner, texts.CREDIT_SCORING)
    if _active(record):
        return None
    if record is not None and record.withdrawn_at is not None:
        from scoring.validity import short_date
        return ("consent_withdrawn",
                f"The owner withdrew consent for credit scoring on {short_date(record.withdrawn_at)}. "
                "This application can't be approved.")
    return ("consent_missing",
            "The owner hasn't given current consent for credit scoring. This application can't be approved.")
