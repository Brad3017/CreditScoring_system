from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from accounts.consent import credit_scoring_block
from accounts.permissions import ConsentRequired

from .models import (
    CreditRequest, CreditAssessment, BusinessProfile, LessonView, LetterDownload, StatementUpload,
)
from .letters import build_decision_letter, letter_reference, DECIDED
from .serializers import (
    CreditRequestSerializer,
    CreditAssessmentSerializer,
    BusinessProfileSerializer,
    AssessmentBusinessSerializer,
    MODEL_INPUT_FIELDS,
    pin_taken_message,
    statement_payload,
)
from .statements import profit_from
from .validity import VALID, approval_block_message, get_validity, validity_fields, with_superseded
from .services import (
    evaluate_credit_request, label_matches_score, limit_explanation, MODEL_VERSION, FEATURES, LIMIT_INPUTS,
)


class IsAnalystOrAdmin(IsAuthenticated):
    """Only analysts and admins can access the review queue."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in ("analyst", "admin")


class IsOwner(IsAuthenticated):
    """Only business owners apply for credit; staff accounts cannot submit applications."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role == "owner"


# Business fields copied from the request when an assessment creates a NEW business.
NEW_BUSINESS_FIELDS = ("sector", "county", "location_type", "legal_status", "business_age_years", "employees_count")

BUSINESS_NOT_FOUND = {"detail": "Business not found."}


class _Reject(Exception):
    """Ends the submit transaction with an error response; nothing is saved."""

    def __init__(self, body, code):
        super().__init__(body)
        self.response = Response(body, status=code)


def _same_name(a, b):
    return " ".join((a or "").split()).casefold() == " ".join((b or "").split()).casefold()


def _business_for_submit(user, chosen, validated_request):
    """The BusinessProfile an assessment is linked to. Runs inside the submit transaction.
    chosen: AssessmentBusinessSerializer.validated_data. Never falls back to any "latest" profile."""
    pin = chosen.get("kra_pin")
    name = (chosen.get("business_name") or "").strip()

    if chosen.get("business_id") is not None:
        # An existing business: it must be one of THIS owner's (404 otherwise, so other IDs stay hidden).
        profile = BusinessProfile.objects.select_for_update().filter(pk=chosen["business_id"], user=user).first()
        if profile is None:
            raise _Reject(BUSINESS_NOT_FOUND, status.HTTP_404_NOT_FOUND)
        # Its saved name and PIN are what the assessment is for; a different one in the payload is refused.
        if pin and pin != profile.kra_pin:
            raise _Reject({"kra_pin": [
                f"This KRA PIN does not belong to '{profile.business_name}'. "
                "To assess a different business, choose Add a new business."
            ]}, status.HTTP_400_BAD_REQUEST)
        if name and not _same_name(name, profile.business_name):
            raise _Reject({"business_name": [
                f"This assessment is for '{profile.business_name}'. "
                "To assess a different business, choose Add a new business."
            ]}, status.HTTP_400_BAD_REQUEST)
        return profile

    # A new business: its PIN must not be registered to ANY business yet.
    message = pin_taken_message(pin, user)
    if message:
        raise _Reject({"kra_pin": [message]}, status.HTTP_400_BAD_REQUEST)
    return BusinessProfile.objects.create(
        user=user, business_name=name, kra_pin=pin,
        **{f: validated_request[f] for f in NEW_BUSINESS_FIELDS},
    )


def _reviewer_name(a):
    if not a.reviewed_by:
        return None
    return a.reviewed_by.full_name or a.reviewed_by.email


def _limit_explanation(a, r):
    """How the current limit policy set this record's limit. None for records scored by an
    earlier model: their limit came from the rule in use at the time, which this does not describe."""
    if a.model_version != MODEL_VERSION:
        return None
    try:
        return limit_explanation(a.risk_category, r.collateral_level, r.tenure_months)
    except (ValueError, RuntimeError):
        return None


def _payload(a, detailed=False):
    """One consistent JSON shape for an assessment, used by every endpoint."""
    r = a.request
    data = {
        "pk": a.id,
        "id": f"ASSESS-{a.id}",
        "business_name": r.business_name,
        # The business this assessment is linked to (null only on old, unlinked rows).
        "business_id": r.business_id,
        "sector": r.sector,
        "county": r.county,
        "monthly_revenue": float(r.monthly_revenue_kes),
        # self_reported | till_statement. With a till statement, revenue is the statement's monthly average
        # and expenses are the owner's own figure (a till statement shows sales only).
        "revenue_source": r.revenue_source,
        "monthly_expenses": float(r.monthly_expenses_kes) if r.monthly_expenses_kes is not None else None,
        "till_statement": statement_payload(r.till_statement) if r.till_statement_id else None,
        "credit_score": a.credit_score,
        "probability_of_default": float(a.probability_of_default),
        "risk_category": a.risk_category,
        "recommended_limit": float(a.recommended_limit),
        "limit_explanation": _limit_explanation(a, r),
        "explanation": a.shap_explanation,
        "shap_values": a.shap_values or [],
        "requested_amount": float(r.loan_amount),
        # 0 only on rows created before this field existed; a real estimate is never 0.
        "monthly_repayment_estimate": float(a.monthly_repayment_estimate) or None,
        "loan_purpose": r.loan_purpose,
        "model_version": a.model_version,
        # Only when the stored label disagrees with the band of its score (v1 used other cut-offs).
        # Earlier models with the same bands (v2) are shown normally, tagged via is_current_model.
        "is_legacy": not label_matches_score(a.risk_category, a.credit_score),
        "is_current_model": a.model_version == MODEL_VERSION,
        "created_at": a.created_at.strftime("%b %d, %Y"),
        "created_at_iso": a.created_at.isoformat(),
        "review_status": a.review_status,
        "review_note": a.review_note,
        "reviewed_by": _reviewer_name(a),
        "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
        # The owner's request for human review (Data Protection Act s.35). Kept after the decision;
        # review_resolved = an analyst decided after the request.
        "review_requested_at": a.review_requested_at.isoformat() if a.review_requested_at else None,
        "review_request_reason": a.review_request_reason,
        "review_resolved": a.review_resolved,
        # valid_until (ISO), validity_status (valid | expired | superseded), days_remaining (int or null).
        # Lists pass querysets through with_superseded(), so this adds no query per row there.
        **validity_fields(a),
    }
    if detailed:
        data["applicant"] = {
            "name": r.user.full_name or r.user.email,
            "email": r.user.email,
            "phone": getattr(r.user, "phone", ""),
        }
        # Staff-only (detail endpoint). Owners see their own PIN on the business profile only.
        data["business"] = {"kra_pin": r.business.kra_pin if r.business else None}
        data["request"] = {
            "loan_amount": float(r.loan_amount),
            "tenure_months": r.tenure_months,
            "monthly_profit_kes": float(r.monthly_profit_kes),
            "monthly_expenses_kes": float(r.monthly_expenses_kes) if r.monthly_expenses_kes is not None else None,
            "days_payable_outstanding": r.days_payable_outstanding,
            "cashflow_stability": r.cashflow_stability,
            "existing_loans": r.existing_loans,
            "prior_loan_count": r.prior_loan_count,
            "late_payment_history": r.late_payment_history,
            "collateral_level": r.collateral_level,
            "repayment_confidence": r.repayment_confidence,
            "owner_education": r.owner_education,
            "legal_status": r.legal_status,
            "location_type": r.location_type,
            "business_age_years": r.business_age_years,
            "employees_count": r.employees_count,
        }
        # Staff only: why this application can't be approved because of the owner's credit-scoring
        # consent (withdrawn, or never given for the current text). Null when approval is allowed.
        block = credit_scoring_block(r.user)
        data["consent_block"] = {"code": block[0], "detail": block[1]} if block else None
        # Downloads of the decision letter (inline previews are not counted).
        data["letter_downloads"] = a.letter_downloads.count()
    return data


class AssessmentListView(APIView):
    """The logged-in borrower's own assessments (now including review status)."""
    permission_classes = [IsAuthenticated, ConsentRequired]

    def get(self, request):
        qs = with_superseded(
            CreditAssessment.objects.filter(request__user=request.user)
            .select_related("request", "request__till_statement", "reviewed_by")
            .order_by("-created_at")
        )
        return Response([_payload(a) for a in qs], status=status.HTTP_200_OK)


class AssessmentDetailView(APIView):
    """Full detail of one assessment, for analysts and admins."""
    permission_classes = [IsAnalystOrAdmin, ConsentRequired]

    def get(self, request, pk):
        try:
            a = with_superseded(CreditAssessment.objects.select_related(
                "request", "request__user", "request__business", "request__till_statement", "reviewed_by"
            )).get(pk=pk)
        except CreditAssessment.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(_payload(a, detailed=True))


class ReviewAssessmentView(APIView):
    """Analyst records a decision: approved, declined or referred."""
    permission_classes = [IsAnalystOrAdmin, ConsentRequired]

    ALLOWED = {"approved", "declined", "referred"}

    def post(self, request, pk):
        try:
            a = CreditAssessment.objects.select_related(
                "request", "request__user", "request__till_statement"
            ).get(pk=pk)
        except CreditAssessment.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)

        decision = request.data.get("decision")
        note = (request.data.get("note") or "").strip()

        if decision not in self.ALLOWED:
            return Response(
                {"detail": "decision must be approved, declined or referred."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if decision in ("declined", "referred") and len(note) < 5:
            return Response(
                {"detail": "Please add a short note explaining a decline or referral."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # An expired or superseded score cannot be approved. Declining or referring it is still allowed.
        if decision == "approved":
            # Nor can the application of an owner without active credit-scoring consent.
            block = credit_scoring_block(a.request.user)
            if block:
                return Response({"code": block[0], "detail": block[1]}, status=status.HTTP_400_BAD_REQUEST)
            validity = get_validity(a)
            if validity["status"] != VALID:
                return Response({
                    "detail": approval_block_message(a, validity),
                    "validity_status": validity["status"],
                    "valid_until": validity["valid_until"].isoformat() if validity["valid_until"] else None,
                }, status=status.HTTP_400_BAD_REQUEST)

        a.review_status = decision
        a.review_note = note
        a.reviewed_by = request.user
        a.reviewed_at = timezone.now()
        a.save(update_fields=["review_status", "review_note", "reviewed_by", "reviewed_at"])
        return Response(_payload(a, detailed=True))


STATEMENT_NOT_USABLE = "This till statement cannot be used for this assessment. Upload it again for this business."
EXPENSES_REQUIRED = "Enter your monthly business costs in KES, 0 or more."


def _till_inputs(user, payload):
    """Applies an attached till statement to the submitted answers, in place. Returns the StatementUpload,
    None when there is none, or raises _Reject. With a statement, revenue is ALWAYS the statement's monthly
    average (any revenue the client sent is ignored) and profit = revenue - the owner's monthly expenses."""
    raw_id = payload.pop("till_statement_id", None)
    if raw_id in (None, ""):
        # Self-reported: unchanged. Expenses are only asked for alongside a till statement.
        payload.pop("monthly_expenses_kes", None)
        return None

    try:
        statement_id, business_id = int(raw_id), int(payload.get("business_id"))
    except (TypeError, ValueError):
        raise _Reject({"till_statement_id": [STATEMENT_NOT_USABLE]}, status.HTTP_400_BAD_REQUEST) from None
    statement = StatementUpload.objects.filter(
        pk=statement_id, user=user, business_id=business_id, status=StatementUpload.ACCEPTED,
    ).first()
    if statement is None:
        raise _Reject({"till_statement_id": [STATEMENT_NOT_USABLE]}, status.HTTP_400_BAD_REQUEST)

    try:
        expenses = Decimal(str(payload.get("monthly_expenses_kes")).strip())
        if not expenses.is_finite() or expenses < 0:
            raise InvalidOperation
    except (InvalidOperation, ValueError):
        raise _Reject({"monthly_expenses_kes": [EXPENSES_REQUIRED]}, status.HTTP_400_BAD_REQUEST) from None

    payload["monthly_expenses_kes"] = str(expenses)
    payload["monthly_revenue_kes"] = str(statement.avg_monthly_revenue)
    payload["monthly_profit_kes"] = str(profit_from(statement.avg_monthly_revenue, expenses))
    return statement


class SubmitCreditAssessmentView(APIView):
    permission_classes = [IsOwner, ConsentRequired]
    extra_consents = ("credit_scoring",)   # on top of the privacy notice

    def post(self, request):
        payload = {k: request.data.get(k) for k in request.data.keys()}
        try:
            statement = _till_inputs(request.user, payload)
        except _Reject as rejected:
            return rejected.response

        serializer = CreditRequestSerializer(data=payload)
        # Which business: the PIN and the business choice belong to the BusinessProfile, not the request.
        business_serializer = AssessmentBusinessSerializer(data={
            k: payload.get(k) for k in ("business_id", "business_name", "kra_pin")
        })
        request_ok, business_ok = serializer.is_valid(), business_serializer.is_valid()
        if not (request_ok and business_ok):
            errors = {**(serializer.errors if not request_ok else {}), **(business_serializer.errors if not business_ok else {})}
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # Score first (no database writes), so a rejected input leaves nothing half-saved.
        try:
            results = evaluate_credit_request(CreditRequest(**serializer.validated_data))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Scoring engine error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        chosen = business_serializer.validated_data
        try:
            with transaction.atomic():
                business = _business_for_submit(request.user, chosen, serializer.validated_data)
                # Linked to the chosen (or just created) business, and named exactly as it is.
                credit_req = serializer.save(
                    user=request.user, business=business, business_name=business.business_name,
                    revenue_source=(CreditRequest.REVENUE_TILL_STATEMENT if statement else CreditRequest.REVENUE_SELF_REPORTED),
                    till_statement=statement,
                )

                assessment = CreditAssessment.objects.create(
                    request=credit_req,
                    credit_score=results["credit_score"],
                    probability_of_default=results["probability_of_default"],
                    risk_category=results["risk_category"],
                    recommended_limit=results["recommended_limit"],
                    monthly_repayment_estimate=results["monthly_repayment_estimate"],
                    shap_explanation=results["shap_explanation"],
                    shap_values=results["shap_values"],
                    model_version=results["model_version"],
                )
        except _Reject as rejected:
            return rejected.response
        except IntegrityError:
            # Another business registered the same PIN between the check above and this save.
            message = pin_taken_message(chosen.get("kra_pin"), request.user)
            return Response({"kra_pin": [message or "This KRA PIN is already registered to another business."]},
                            status=status.HTTP_400_BAD_REQUEST)

        body = _payload(assessment)
        # Not stored: only meaningful at the moment of scoring.
        body["out_of_range"] = results["out_of_range"]
        return Response(body, status=status.HTTP_201_CREATED)


class IsOwnerOrStaff(IsAuthenticated):
    """Any signed-in owner, analyst or admin."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in ("owner", "analyst", "admin")


class SimulateRateThrottle(UserRateThrottle):
    # Rate is set in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["simulate"].
    scope = "simulate"


# Fields returned by a simulation. Nothing else from the scoring result is exposed.
SIMULATION_FIELDS = (
    "credit_score", "risk_category", "probability_of_default", "shap_values",
    "out_of_range", "recommended_limit", "monthly_repayment_estimate", "limit_explanation",
    "model_version",
)


class SimulateAssessmentView(APIView):
    """Scores a what-if payload. Validates exactly like assess/, but writes nothing to the database."""
    permission_classes = [IsOwnerOrStaff, ConsentRequired]
    throttle_classes = [SimulateRateThrottle]

    def post(self, request):
        serializer = CreditRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            # An unsaved instance: only used to build the model inputs, never saved.
            results = evaluate_credit_request(CreditRequest(**serializer.validated_data))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Scoring engine error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({k: results[k] for k in SIMULATION_FIELDS}, status=status.HTTP_200_OK)


class AssessmentInputsView(APIView):
    """The stored answers behind one of the signed-in user's OWN assessments (404 for anyone else's)."""
    permission_classes = [IsAuthenticated, ConsentRequired]

    def get(self, request, pk):
        a = (
            CreditAssessment.objects.select_related("request")
            .filter(pk=pk, request__user=request.user)
            .first()
        )
        if a is None:
            return Response({"detail": "Not found"}, status=404)
        r = a.request
        body = {}
        for field in MODEL_INPUT_FIELDS:
            value = getattr(r, field)
            # Decimals as plain numbers, so the payload can be posted straight back to simulate/.
            body[field] = float(value) if field in ("loan_amount", "monthly_revenue_kes", "monthly_profit_kes") else value
        body["business_name"] = r.business_name
        body["business_id"] = r.business_id
        body["county"] = r.county
        return Response(body)


class AllAssessmentsAnalystView(APIView):
    permission_classes = [IsAnalystOrAdmin, ConsentRequired]

    def get(self, request):
        qs = with_superseded(CreditAssessment.objects.select_related(
            "request", "request__till_statement", "reviewed_by"
        ).order_by("-created_at"))
        return Response([_payload(a) for a in qs], status=status.HTTP_200_OK)


LETTER_PENDING_MESSAGE = "A decision letter is available once a credit analyst has reviewed this application."


class DecisionLetterView(APIView):
    """GET /api/scoring/assessments/<pk>/letter/: the one-page PDF decision letter.
    Owners: their own assessments only (anyone else's is 404, so IDs are not revealed).
    Analysts and admins: any assessment; ?inline=1 opens it in the browser instead of downloading.
    Always built from the latest stored decision. Each download (not an inline preview) is logged."""
    permission_classes = [IsOwnerOrStaff, ConsentRequired]

    def get(self, request, pk):
        qs = CreditAssessment.objects.select_related("request", "request__user", "request__business", "reviewed_by")
        if request.user.role == "owner":
            qs = qs.filter(request__user=request.user)
        a = qs.filter(pk=pk).first()
        if a is None:
            return Response({"detail": "Not found"}, status=404)
        if a.review_status not in DECIDED or a.reviewed_at is None:
            return Response({"detail": LETTER_PENDING_MESSAGE}, status=status.HTTP_409_CONFLICT)

        pdf = build_decision_letter(a)
        inline = request.query_params.get("inline") == "1" and request.user.role in ("analyst", "admin")
        if not inline:
            LetterDownload.objects.create(assessment=a, user=request.user)
        response = HttpResponse(pdf, content_type="application/pdf")
        filename = f"BiasharaScore_decision_{letter_reference(a)}.pdf"
        response["Content-Disposition"] = f'{"inline" if inline else "attachment"}; filename="{filename}"'
        response["Cache-Control"] = "no-store"  # a later decision must never be served from a cache
        return response


class BusinessListView(APIView):
    """GET: the signed-in owner's businesses, oldest first. POST: add a business."""
    permission_classes = [IsAuthenticated, ConsentRequired]

    def get(self, request):
        qs = BusinessProfile.objects.filter(user=request.user).order_by("created_at", "id")
        return Response(BusinessProfileSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = BusinessProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save(user=request.user)
        except IntegrityError:
            # Same PIN saved by another business between validation and this write.
            return Response({"kra_pin": ["This KRA PIN is already registered to another business."]},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BusinessDetailView(APIView):
    """GET / PATCH / PUT one of the signed-in owner's businesses (404 for anyone else's).
    The KRA PIN can be changed only while the business has no assessments."""
    permission_classes = [IsAuthenticated, ConsentRequired]

    def _get(self, request, pk):
        return BusinessProfile.objects.filter(pk=pk, user=request.user).first()

    def get(self, request, pk):
        profile = self._get(request, pk)
        if profile is None:
            return Response(BUSINESS_NOT_FOUND, status=404)
        return Response(BusinessProfileSerializer(profile, context={"request": request}).data)

    def patch(self, request, pk):
        profile = self._get(request, pk)
        if profile is None:
            return Response(BUSINESS_NOT_FOUND, status=404)
        serializer = BusinessProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            return Response({"kra_pin": ["This KRA PIN is already registered to another business."]},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data)

    put = patch



class LessonViewedView(APIView):
    """POST /api/learn/viewed/ {feature_key}: records that an owner opened a lesson.
    At most one row per user, lesson and day: 201 when recorded, 200 when already recorded today."""
    permission_classes = [IsOwner, ConsentRequired]

    def post(self, request):
        key = str(request.data.get("feature_key") or "").strip()
        # Lessons cover model features and the answers the limit policy uses (collateral).
        if key not in FEATURES and key not in LIMIT_INPUTS:
            return Response({"feature_key": ["Unknown lesson."]}, status=status.HTTP_400_BAD_REQUEST)
        today = timezone.localdate()
        try:
            with transaction.atomic():
                _, created = LessonView.objects.get_or_create(user=request.user, feature_key=key, viewed_on=today)
        except IntegrityError:
            created = False  # a parallel request recorded it first
        return Response({"recorded": created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


REVIEW_REASON_MAX = 500


class RequestReviewView(APIView):
    """POST /api/scoring/assessments/<pk>/request-review/ {reason}: the owner asks for a credit analyst to
    review this result (Data Protection Act s.35). Own assessments only (404 otherwise). 400 while an
    earlier request is still unresolved. Allowed even after withdrawing credit-scoring consent."""
    permission_classes = [IsOwner, ConsentRequired]

    def post(self, request, pk):
        a = CreditAssessment.objects.select_related("request", "request__till_statement", "reviewed_by").filter(
            pk=pk, request__user=request.user).first()
        if a is None:
            return Response({"detail": "Not found"}, status=404)
        reason = str(request.data.get("reason") or "").strip()
        if not reason:
            return Response({"reason": ["Tell us briefly why you would like a review."]},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(reason) > REVIEW_REASON_MAX:
            return Response({"reason": [f"Keep the reason to {REVIEW_REASON_MAX} characters or fewer."]},
                            status=status.HTTP_400_BAD_REQUEST)
        if a.review_requested_at and not a.review_resolved:
            return Response({"code": "review_already_requested",
                             "detail": "You have already asked for a review of this assessment."},
                            status=status.HTTP_400_BAD_REQUEST)
        a.review_requested_at = timezone.now()
        a.review_request_reason = reason
        a.save(update_fields=["review_requested_at", "review_request_reason"])
        return Response(_payload(with_superseded(CreditAssessment.objects.filter(pk=a.pk)).select_related(
            "request", "request__till_statement", "reviewed_by").get()))

