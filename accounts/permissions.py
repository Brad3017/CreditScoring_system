from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from .consent import has_consent, missing_required

CONSENT_MESSAGES = {
    "privacy_notice": "Please read and accept the privacy notice to continue.",
    "staff_confidentiality": "Please accept the staff confidentiality agreement to continue.",
    "credit_scoring": "Please agree to credit scoring before requesting an assessment.",
}


class ConsentRequired(BasePermission):
    """403 {code: "consent_required", purposes: [...], detail} until the signed-in user has the consents their
    role needs: privacy_notice for owners, staff_confidentiality for analysts and admins. A view can ask for
    more with `extra_consents`, e.g. ("credit_scoring",) on assessment creation.

    List it AFTER the authentication/role permission, so anonymous users still get 401 and the wrong role
    still gets that role check's own 403."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return True  # authentication is another class's job
        missing = missing_required(user)
        missing += [p for p in getattr(view, "extra_consents", ()) if not has_consent(user, p)]
        if missing:
            raise PermissionDenied({
                "code": "consent_required",
                "purposes": missing,
                "detail": CONSENT_MESSAGES.get(missing[0], "Consent is required to continue."),
            })
        return True
