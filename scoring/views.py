from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import CreditAssessment
from .serializers import CreditAssessmentSerializer


class IsAnalystOrAdmin(IsAuthenticated):
    """Only analysts and admins can access the review queue."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in ("analyst", "admin")


class AssessmentListView(APIView):
    """List all assessments for analyst review."""
    permission_classes = [IsAnalystOrAdmin]

    def get(self, request):
        qs = CreditAssessment.objects.select_related(
            "request", "request__business", "request__user"
        ).order_by("-created_at")
        serializer = CreditAssessmentSerializer(qs, many=True)
        return Response(serializer.data)


class AssessmentDetailView(APIView):
    """View a single assessment in full detail."""
    permission_classes = [IsAnalystOrAdmin]

    def get(self, request, pk):
        try:
            assessment = CreditAssessment.objects.select_related(
                "request", "request__business", "request__user"
            ).get(pk=pk)
        except CreditAssessment.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(CreditAssessmentSerializer(assessment).data)


class SubmitCreditAssessmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreditRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # 1. Save CreditRequest linked to logged-in user
        credit_req = serializer.save(user=request.user)

        # 2. Maintain or link a BusinessProfile record
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
            }
        )
        credit_req.business = business_profile
        credit_req.save()

        # 3. Trigger model scoring & SHAP
        try:
            results = evaluate_credit_request(credit_req)
        except Exception as e:
            return Response(
                {"error": f"Scoring engine error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )        

# 4. Save assessment record in PostgreSQL
        assessment = CreditAssessment.objects.create(
            request=credit_req,
            credit_score=results["credit_score"],
            probability_of_default=results["probability_of_default"],
            risk_category=results["risk_category"],
            recommended_limit=results["recommended_limit"],
            shap_explanation=results["shap_explanation"],
            model_version="xgb_msme_v1"
        )            