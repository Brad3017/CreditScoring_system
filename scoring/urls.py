from django.urls import path
from .views import AssessmentListView, AssessmentDetailView

urlpatterns = [
    path("assessments/", AssessmentListView.as_view(), name="assessment-list"),
    path("assessments/<int:pk>/", AssessmentDetailView.as_view(),
         name="assessment-detail"),
]