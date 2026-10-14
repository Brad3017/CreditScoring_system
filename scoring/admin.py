from django.contrib import admin
from .models import BusinessProfile, CreditRequest, CreditAssessment


@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = ["business_name", "sector", "county", "user", "created_at"]
    list_filter = ["sector", "county", "location_type"]
    search_fields = ["business_name", "user__email"]


@admin.register(CreditRequest)
class CreditRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "business_name", "business", "user", "monthly_revenue_kes", "submitted_at"]
    list_filter = ["late_payment_history", "collateral_level", "existing_loans", "county"]
    search_fields = ["business_name", "user__email"]


@admin.register(CreditAssessment)
class CreditAssessmentAdmin(admin.ModelAdmin):
    list_display = ["id", "request", "credit_score", "probability_of_default", "risk_category", "created_at"]
    list_filter = ["risk_category", "model_version"]