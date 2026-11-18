from django.contrib import admin
from .models import BusinessProfile, CreditRequest, CreditAssessment, StatementUpload


@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = ["business_name", "sector", "county", "till_number", "user", "created_at"]
    list_filter = ["sector", "county", "location_type"]
    search_fields = ["business_name", "user__email"]


@admin.register(CreditRequest)
class CreditRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "business_name", "business", "user", "monthly_revenue_kes", "revenue_source", "submitted_at"]
    list_filter = ["revenue_source", "late_payment_history", "collateral_level", "existing_loans", "county"]
    search_fields = ["business_name", "user__email"]


@admin.register(CreditAssessment)
class CreditAssessmentAdmin(admin.ModelAdmin):
    list_display = ["id", "request", "credit_score", "probability_of_default", "risk_category", "sales_source", "created_at"]
    list_filter = ["risk_category", "model_version", "request__revenue_source"]
    list_select_related = ["request"]

    @admin.display(description="Sales source", ordering="request__revenue_source")
    def sales_source(self, obj):
        return obj.request.get_revenue_source_display()


@admin.register(StatementUpload)
class StatementUploadAdmin(admin.ModelAdmin):
    """Read-only: what was read from each till statement. The PDF itself is never stored."""
    list_display = ["id", "business", "shortcode", "period_start", "period_end", "avg_monthly_revenue",
                    "unique_customers", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["business__business_name", "shortcode", "organisation_name", "user__email"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False