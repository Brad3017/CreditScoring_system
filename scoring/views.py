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