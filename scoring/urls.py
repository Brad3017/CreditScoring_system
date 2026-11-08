from django.urls import path
from .views import (
    SubmitCreditAssessmentView,
    AssessmentListView,
    AllAssessmentsAnalystView,
    AssessmentDetailView,
    ReviewAssessmentView,
    BusinessProfileView,
)

urlpatterns = [
    path("assess/", SubmitCreditAssessmentView.as_view(), name="submit_assessment"),
    path("assessments/", AssessmentListView.as_view(), name="assessment_list"),
    path("assessments/all/", AllAssessmentsAnalystView.as_view(), name="analyst_assessment_list"),
    path("assessments/<int:pk>/", AssessmentDetailView.as_view(), name="assessment_detail"),
    path("assessments/<int:pk>/review/", ReviewAssessmentView.as_view(), name="assessment_review"),
    path("business-profile/", BusinessProfileView.as_view(), name="business_profile"),
]
