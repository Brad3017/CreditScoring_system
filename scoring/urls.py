from django.urls import path
from .views import AssessmentListView, AssessmentDetailView, SubmitCreditAssessmentView

urlpatterns = [
    path("assessments/", AssessmentListView.as_view(), name="assessment-list"),
    path("assessments/<int:pk>/", AssessmentDetailView.as_view(),
         name="assessment-detail"),
    path("assess/", SubmitCreditAssessmentView.as_view(), name="submit_assessment"),     
]