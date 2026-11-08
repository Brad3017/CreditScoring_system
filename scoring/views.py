from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import CreditRequest, CreditAssessment, BusinessProfile
from .serializers import (
    CreditRequestSerializer,
    CreditAssessmentSerializer,
    BusinessProfileSerializer,
)
from .services import evaluate_credit_request


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
                "request", "request__user", "reviewed_by"
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
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        credit_req = serializer.save(user=request.user)

        business_profile, _ = BusinessProfile.objects.get_or_create(
            user=request.user,
            defaults={
                "business_name": credit_req.business_name or "My Business",
                "sector": credit_req.sector,
                "county": credit_req.county,
                "location_type": credit_req.location_type,
                "legal_status": credit_req.legal_status,
                "business_age_years": credit_req.business_age_years,
                "employees_count": credit_req.employees_count,
            },
        )
        credit_req.business = business_profile
        credit_req.save()

        try:
            results = evaluate_credit_request(credit_req)
        except Exception as e:
            return Response(
                {"error": f"Scoring engine error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        assessment = CreditAssessment.objects.create(
            request=credit_req,
            credit_score=results["credit_score"],
            probability_of_default=results["probability_of_default"],
            risk_category=results["risk_category"],
            recommended_limit=results["recommended_limit"],
            shap_explanation=results["shap_explanation"],
            model_version="xgb_msme_v1",
        )
        return Response(_payload(assessment), status=status.HTTP_201_CREATED)


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

    def _current(self, request):
        return BusinessProfile.objects.filter(user=request.user).order_by("-created_at").first()

    def get(self, request):
        profile = self._current(request)
        return Response(BusinessProfileSerializer(profile).data if profile else {})

    def put(self, request):
        profile = self._current(request)
        serializer = BusinessProfileSerializer(profile, data=request.data, partial=True) if profile \
            else BusinessProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data)    
