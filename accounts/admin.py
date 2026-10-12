from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


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