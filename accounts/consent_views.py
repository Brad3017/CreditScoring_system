"""Consent endpoints (Data Protection Act 2019 s.32; Data Protection (General) Regulations 2021 reg. 4).

GET  /api/consents/texts/               public: every consent text and CONSENT_VERSION
GET  /api/consents/                     the signed-in user's status for each purpose of their role, plus missing_required
POST /api/consents/ {purpose}           grant (not statement_processing: that is granted per upload)
POST /api/consents/<purpose>/withdraw/  withdraw credit_scoring or communications (400 for the others)

None of these need consent themselves, so a user who has not consented yet can always reach them.
"""
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import consent_texts as texts
from .consent import (
    NotWithdrawable, WITHDRAWABLE, grant, missing_required, purposes_for, status_row, withdraw,
)


class ConsentTextsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({
            "version": texts.CONSENT_VERSION,
            "texts": texts.CONSENT_TEXTS,
            "labels": texts.PURPOSE_LABELS,
        })


def _overview(user):
    return {
        "version": texts.CONSENT_VERSION,
        "consents": [status_row(user, p) for p in purposes_for(user)],
        "missing_required": missing_required(user),
    }


class ConsentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_overview(request.user))

    def post(self, request):
        purpose = str(request.data.get("purpose") or "")
        if purpose == texts.STATEMENT_PROCESSING:
            return Response({"purpose": ["Consent to read a statement is given with each upload."]},
                            status=status.HTTP_400_BAD_REQUEST)
        if purpose not in purposes_for(request.user):
            return Response({"purpose": ["This consent does not apply to your account."]},
                            status=status.HTTP_400_BAD_REQUEST)
        grant(request.user, purpose, request)
        return Response(_overview(request.user), status=status.HTTP_201_CREATED)


class ConsentWithdrawView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, purpose):
        if purpose not in purposes_for(request.user) or purpose not in WITHDRAWABLE:
            return Response({"code": "not_withdrawable", "detail": "This consent can't be withdrawn."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            record = withdraw(request.user, purpose)
        except NotWithdrawable:  # pragma: no cover - guarded above
            return Response({"code": "not_withdrawable", "detail": "This consent can't be withdrawn."},
                            status=status.HTTP_400_BAD_REQUEST)
        if record is None:
            return Response({"code": "not_active", "detail": "There is no active consent to withdraw."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(_overview(request.user))
