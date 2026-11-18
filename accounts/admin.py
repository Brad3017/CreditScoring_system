from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import ConsentRecord, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "full_name", "role", "status", "is_staff"]
    list_filter = ["role", "status"]
    search_fields = ["email", "full_name", "national_id"]
    ordering = ["email"]

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Profile", {"fields": ("full_name", "national_id", "phone", "county")}),
        ("Role & Status", {"fields": ("role", "status", "invitation_token", "invited_by")}),
    )


@admin.register(ConsentRecord)
class ConsentRecordAdmin(admin.ModelAdmin):
    """Read-only: consent history is proof and is never edited here (withdrawals go through the app)."""
    list_display = ["user", "purpose", "version", "granted_at", "withdrawn_at", "ip_address", "reference"]
    list_filter = ["purpose", "version"]
    search_fields = ["user__email"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

