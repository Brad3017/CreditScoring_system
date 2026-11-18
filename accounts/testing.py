"""Test helper: users who have already given every consent, so tests about other behaviour are not
stopped by the consent checks (accounts/permissions.py ConsentRequired)."""
from django.contrib.auth import get_user_model

from .consent import grant
from .consent_texts import CREDIT_SCORING, PRIVACY_NOTICE, STAFF_CONFIDENTIALITY


def grant_all(user):
    for purpose in (PRIVACY_NOTICE, CREDIT_SCORING, STAFF_CONFIDENTIALITY):
        grant(user, purpose)
    return user


def consenting_user(**kwargs):
    return grant_all(get_user_model().objects.create_user(**kwargs))
