from django.urls import path
from .views import (
    SubmitCreditAssessmentView, 
    AssessmentListView, 
    AllAssessmentsAnalystView,
    # AssessmentDetailView # (If you have this)
)

urlpatterns = [
    # This matches the /api/scoring/assess/ POST request from React
    path("assess/", SubmitCreditAssessmentView.as_view(), name="submit_assessment"),
    
    # Other endpoints...
    path("assessments/", AssessmentListView.as_view(), name="assessment_list"),
    path("assessments/all/", AllAssessmentsAnalystView.as_view(), name="analyst_assessment_list"),
]