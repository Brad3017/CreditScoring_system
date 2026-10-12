from django.contrib import admin
from .models import BusinessProfile, CreditRequest, CreditAssessment


@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = ["business_name", "sector", "county", "user"]
    list_filter = ["sector", "county", "location_type"]


@admin.register(CreditRequest)
class CreditRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "business", "user", "submitted_at"]
    list_filter = ["late_payment_history", "collateral_level"]


@admin.register(CreditAssessment)
class CreditAssessmentAdmin(admin.ModelAdmin):
    list_display = ["id", "request", "credit_score", "risk_category", "created_at"]
    list_filter = ["risk_category", "model_version"]