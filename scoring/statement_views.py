"""Lipa na M-Pesa till statement upload (scoring/statements/ does the reading).

POST /api/statements/upload/   owner only, multipart: file, password (optional), business_id, consent (must be true)
    201  accepted: the summary, checks and flags
    200  this exact file was already accepted for this business: that record
    400  {code}: consent_required, file_required, file_too_large, unreadable, too_many_pages, password_required,
         wrong_password, personal_statement_not_supported, unknown_format;
         or {code: "statement_rejected", checks} when a check failed (the rejection is saved)
GET  /api/statements/<id>/     the owner (own statements only), analysts and admins

The PDF is held in memory only (never a temporary file) and is not stored; neither is the password.
"""
import hashlib
import io
import re

from django.conf import settings
from django.core.files.uploadhandler import MemoryFileUploadHandler, SkipFile
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.consent import grant
from accounts.consent_texts import STATEMENT_PROCESSING
from accounts.permissions import ConsentRequired

from .models import BusinessProfile, StatementUpload, TILL_NUMBER_PATTERN
from .serializers import statement_payload
from .statements import StatementError, has_failures, parse_till_pdf, run_checks, summarise
from .views import BUSINESS_NOT_FOUND, IsOwner, IsOwnerOrStaff

_TILL_NUMBER_RE = re.compile(TILL_NUMBER_PATTERN)
_TRUE = {"true", "1", "yes", "on"}


class _InMemoryStatementHandler(MemoryFileUploadHandler):
    """Keeps the upload in memory up to STATEMENT_MAX_BYTES, whatever Django's FILE_UPLOAD_MAX_MEMORY_SIZE,
    so it is never written to a temporary file. A larger file is dropped and flagged as too large."""

    too_large = False

    def handle_raw_input(self, input_data, META, content_length, boundary, encoding=None):
        self.activated = True

    def receive_data_chunk(self, raw_data, start):
        if start + len(raw_data) > settings.STATEMENT_MAX_BYTES:
            self.too_large = True
            raise SkipFile()
        return super().receive_data_chunk(raw_data, start)


def _error(code, **extra):
    return Response({"code": code, **extra}, status=status.HTTP_400_BAD_REQUEST)


class StatementUploadView(APIView):
    permission_classes = [IsOwner, ConsentRequired]
    parser_classes = [MultiPartParser]

    def post(self, request):
        handler = _InMemoryStatementHandler(request._request)
        request._request.upload_handlers = [handler]   # must happen before request.data is read

        data = request.data
        if str(data.get("consent", "")).strip().lower() not in _TRUE:
            return _error("consent_required")

        business = BusinessProfile.objects.filter(pk=_int(data.get("business_id")), user=request.user).first()
        if business is None:
            return Response(BUSINESS_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        upload = request.FILES.get("file")
        if handler.too_large:
            return _error("file_too_large")
        if upload is None:
            return _error("file_required")
        content = upload.read()
        if len(content) > settings.STATEMENT_MAX_BYTES:
            return _error("file_too_large")
        if not content.startswith(b"%PDF"):
            return _error("unreadable")

        sha = hashlib.sha256(content).hexdigest()
        existing = StatementUpload.objects.filter(
            business=business, file_sha256=sha, status=StatementUpload.ACCEPTED
        ).order_by("created_at").first()
        if existing is not None:
            grant(request.user, STATEMENT_PROCESSING, request, reference=existing.id)
            return Response(statement_payload(existing), status=status.HTTP_200_OK)

        try:
            parsed = parse_till_pdf(io.BytesIO(content), password=data.get("password") or None,
                                    max_pages=settings.STATEMENT_MAX_PAGES)
        except StatementError as exc:
            return _error(exc.code)

        summary = summarise(parsed)
        checks = run_checks(
            parsed, summary,
            owner_name=request.user.full_name, business_name=business.business_name, saved_till=business.till_number,
        )
        failed = [c for c in checks if c["status"] == "fail"]
        statement = StatementUpload.objects.create(
            user=request.user, business=business, file_sha256=sha,
            organisation_name=parsed.organisation_name[:255], shortcode=parsed.shortcode,
            period_start=parsed.period_start, period_end=parsed.period_end,
            transactions_count=summary["transactions_count"], skipped_rows=parsed.skipped_rows,
            avg_monthly_revenue=summary["avg_monthly_revenue"], till_payments=summary["till_payments"],
            unique_customers=summary["unique_customers"], repeat_customer_share=summary["repeat_customer_share"],
            avg_ticket=summary["avg_ticket"], monthly_breakdown=summary["monthly_breakdown"],
            flags=summary["flags"], checks=checks,
            status=StatementUpload.REJECTED if has_failures(checks) else StatementUpload.ACCEPTED,
            rejection_reason=" ".join(c["message"] for c in failed),
            consent_given_at=timezone.now(),
        )
        # Proof of the per-upload consent (the file was read with it, accepted or not).
        grant(request.user, STATEMENT_PROCESSING, request, reference=statement.id)
        if failed:
            return _error("statement_rejected", checks=checks, id=statement.id)

        # The first accepted statement fills in the business's till number when the owner has not set one.
        if not business.till_number and _TILL_NUMBER_RE.match(parsed.shortcode):
            business.till_number = parsed.shortcode
            business.save(update_fields=["till_number"])
        return Response(statement_payload(statement), status=status.HTTP_201_CREATED)


class StatementDetailView(APIView):
    permission_classes = [IsOwnerOrStaff, ConsentRequired]

    def get(self, request, pk):
        qs = StatementUpload.objects.all()
        if request.user.role == "owner":
            qs = qs.filter(user=request.user)
        statement = qs.filter(pk=pk).first()
        if statement is None:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(statement_payload(statement))


def _int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
