
from django.urls import path
from .views import SubmitCreditAssessmentView, AssessmentListView, AssessmentDetailView, MyAssessmentsView

urlpatterns = [
    
    path("assess/", SubmitCreditAssessmentView.as_view(), name="submit_assessment"),
    
    
    path("assessments/", AssessmentListView.as_view(), name="assessment_list"),
        path("assessments/my/", MyAssessmentsView.as_view(), name="my-assessments"), # 

    path("assessments/<int:pk>/", AssessmentDetailView.as_view(), name="assessment_detail"),
]