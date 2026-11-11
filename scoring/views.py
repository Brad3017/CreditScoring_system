from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle

from .models import CreditRequest, CreditAssessment, BusinessProfile, KRA_PIN_DUPLICATE_MESSAGE
from .serializers import (
    CreditRequestSerializer,
    CreditAssessmentSerializer,
    BusinessProfileSerializer,
    KraPinSerializer,
    MODEL_INPUT_FIELDS,
)
from .services import evaluate_credit_request, MODEL_VERSION


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


def _current_profile(user):
    """The business profile shown on the profile page: the user's most recent one."""
    return BusinessProfile.objects.filter(user=user).order_by("-created_at").first()


def _pin_taken(pin, exclude_pk=None):
    qs = BusinessProfile.objects.filter(kra_pin=pin)
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    return qs.exists()


DUPLICATE_PIN_ERROR = {"kra_pin": [KRA_PIN_DUPLICATE_MESSAGE]}

# Profile fields an assessment may fill in. It only ever fills EMPTY ones; saved values are kept.
PROFILE_FIELDS_FROM_REQUEST = (
    "business_name", "sector", "county", "location_type", "legal_status",
    "business_age_years", "employees_count",
)


def _fill_empty_profile_fields(profile, credit_req, pin):
    filled = []
    for field in PROFILE_FIELDS_FROM_REQUEST:
        new = getattr(credit_req, field)
        if getattr(profile, field) in (None, "") and new not in (None, ""):
            setattr(profile, field, new)
            filled.append(field)
    if pin and not profile.kra_pin:
        profile.kra_pin = pin
        filled.append("kra_pin")
    return filled


def _reviewer_name(a):
    if not a.reviewed_by:
        return None
    return a.reviewed_by.full_name or a.reviewed_by.email


def _payload(a, detailed=False):
    """One consistent JSON shape for an assessment, used by every endpoint."""
    r = a.request
    data = {
        "pk": a.id,
        "id": f"ASSESS-{a.id}",
        "business_name": r.business_name,
        "sector": r.sector,
        "county": r.county,
        "monthly_revenue": float(r.monthly_revenue_kes),
        "credit_score": a.credit_score,
        "probability_of_default": float(a.probability_of_default),
        "risk_category": a.risk_category,
        "recommended_limit": float(a.recommended_limit),
        "explanation": a.shap_explanation,
        "shap_values": a.shap_values or [],
        "requested_amount": float(r.loan_amount),
        # 0 only on rows created before this field existed; a real estimate is never 0.
        "monthly_repayment_estimate": float(a.monthly_repayment_estimate) or None,
        "loan_purpose": r.loan_purpose,
        "model_version": a.model_version,
        # Scored by an earlier model whose risk bands differ from the current score scale.
        "is_legacy": a.model_version != MODEL_VERSION,
        "created_at": a.created_at.strftime("%b %d, %Y"),
        "created_at_iso": a.created_at.isoformat(),
        "review_status": a.review_status,
        "review_note": a.review_note,
        "reviewed_by": _reviewer_name(a),
        "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
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
    return data


class AssessmentListView(APIView):
    """The logged-in borrower's own assessments (now including review status)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            CreditAssessment.objects.filter(request__user=request.user)
            .select_related("request", "reviewed_by")
            .order_by("-created_at")
        )
        return Response([_payload(a) for a in qs], status=status.HTTP_200_OK)


class AssessmentDetailView(APIView):
    """Full detail of one assessment, for analysts and admins."""
    permission_classes = [IsAnalystOrAdmin]

    def get(self, request, pk):
        try:
            a = CreditAssessment.objects.select_related(
                "request", "request__user", "request__business", "reviewed_by"
            ).get(pk=pk)
        except CreditAssessment.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(_payload(a, detailed=True))


class ReviewAssessmentView(APIView):
    """Analyst records a decision: approved, declined or referred."""
    permission_classes = [IsAnalystOrAdmin]

    ALLOWED = {"approved", "declined", "referred"}

    def post(self, request, pk):
        try:
            a = CreditAssessment.objects.select_related("request", "request__user").get(pk=pk)
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

        a.review_status = decision
        a.review_note = note
        a.reviewed_by = request.user
        a.reviewed_at = timezone.now()
        a.save(update_fields=["review_status", "review_note", "reviewed_by", "reviewed_at"])
        return Response(_payload(a, detailed=True))


class SubmitCreditAssessmentView(APIView):
    permission_classes = [IsOwner]

    def post(self, request):
        serializer = CreditRequestSerializer(data=request.data)
        # The PIN belongs to the business profile, not the credit request, so it is checked separately.
        pin_serializer = KraPinSerializer(data={"kra_pin": request.data.get("kra_pin")})
        request_ok, pin_ok = serializer.is_valid(), pin_serializer.is_valid()
        if not (request_ok and pin_ok):
            errors = {**(serializer.errors if not request_ok else {}), **(pin_serializer.errors if not pin_ok else {})}
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        pin = pin_serializer.validated_data.get("kra_pin")

        # The form's PIN is only used when the profile has none yet; an existing PIN is never overwritten.
        # The same goes for every other profile field (see _fill_empty_profile_fields).
        profile = _current_profile(request.user)
        set_pin = pin is not None and (profile is None or not profile.kra_pin)
        if set_pin and _pin_taken(pin, exclude_pk=profile.pk if profile else None):
            return Response(DUPLICATE_PIN_ERROR, status=status.HTTP_400_BAD_REQUEST)

        # Score first, so a rejected input leaves nothing half-saved.
        try:
            results = evaluate_credit_request(CreditRequest(**serializer.validated_data))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Scoring engine error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            with transaction.atomic():
                credit_req = serializer.save(user=request.user)
                business_profile = profile
                if business_profile is None:
                    business_profile = BusinessProfile.objects.create(
                        user=request.user,
                        business_name=credit_req.business_name or "My Business",
                        kra_pin=pin,
                        sector=credit_req.sector,
                        county=credit_req.county,
                        location_type=credit_req.location_type,
                        legal_status=credit_req.legal_status,
                        business_age_years=credit_req.business_age_years,
                        employees_count=credit_req.employees_count,
                    )
                else:
                    filled = _fill_empty_profile_fields(business_profile, credit_req, pin if set_pin else None)
                    if filled:
                        business_profile.save(update_fields=filled)
                credit_req.business = business_profile
                credit_req.save(update_fields=["business"])

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
        except IntegrityError:
            # Another business registered the same PIN between the check above and this save.
            return Response(DUPLICATE_PIN_ERROR, status=status.HTTP_400_BAD_REQUEST)

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
    "out_of_range", "recommended_limit", "monthly_repayment_estimate",
)


class SimulateAssessmentView(APIView):
    """Scores a what-if payload. Validates exactly like assess/, but writes nothing to the database."""
    permission_classes = [IsOwnerOrStaff]
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
    permission_classes = [IsAuthenticated]

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
        body["county"] = r.county
        return Response(body)


class AllAssessmentsAnalystView(APIView):
    permission_classes = [IsAnalystOrAdmin]

    def get(self, request):
        qs = CreditAssessment.objects.select_related(
            "request", "reviewed_by"
        ).order_by("-created_at")
        return Response([_payload(a) for a in qs], status=status.HTTP_200_OK)


# ---- BusinessProfileView here unchanged ----

class BusinessProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = _current_profile(request.user)
        return Response(BusinessProfileSerializer(profile).data if profile else {})

    def put(self, request):
        profile = _current_profile(request.user)
        serializer = BusinessProfileSerializer(profile, data=request.data, partial=True) if profile \
            else BusinessProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save(user=request.user)
        except IntegrityError:
            # Same PIN saved by another business between validation and this write.
            return Response(DUPLICATE_PIN_ERROR, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data)
