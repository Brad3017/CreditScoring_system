from django.urls import path
from .views import (
    SubmitCreditAssessmentView,
    AssessmentListView,
    AllAssessmentsAnalystView,
    AssessmentDetailView,
    ReviewAssessmentView,
    BusinessListView,
    BusinessDetailView,
    SimulateAssessmentView,
    AssessmentInputsView,
    DecisionLetterView,
)
from .admin_views import (
    AdminOverviewView, AdminFairnessView, AdminModelView, AdminExportView,
)

urlpatterns = [
    path("assess/", SubmitCreditAssessmentView.as_view(), name="submit_assessment"),
    path("assessments/", AssessmentListView.as_view(), name="assessment_list"),
    path("assessments/all/", AllAssessmentsAnalystView.as_view(), name="analyst_assessment_list"),
    path("assessments/<int:pk>/", AssessmentDetailView.as_view(), name="assessment_detail"),
    path("simulate/", SimulateAssessmentView.as_view(), name="simulate_assessment"),
    path("assessments/<int:pk>/inputs/", AssessmentInputsView.as_view(), name="assessment_inputs"),
    path("assessments/<int:pk>/letter/", DecisionLetterView.as_view(), name="assessment_letter"),
    path("assessments/<int:pk>/review/", ReviewAssessmentView.as_view(), name="assessment_review"),
    path("businesses/", BusinessListView.as_view(), name="business_list"),
    path("businesses/<int:pk>/", BusinessDetailView.as_view(), name="business_detail"),
    path("admin/overview/", AdminOverviewView.as_view(), name="admin_overview"),
    path("admin/fairness/", AdminFairnessView.as_view(), name="admin_fairness"),
    path("admin/model/", AdminModelView.as_view(), name="admin_model"),
    path("admin/export/", AdminExportView.as_view(), name="admin_export"),

]
