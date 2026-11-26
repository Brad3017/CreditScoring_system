from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "type", "title", "created_at", "read_at")
    list_filter = ("type",)
    search_fields = ("recipient__email", "title")
    readonly_fields = ("created_at",)
    raw_id_fields = ("recipient", "assessment")
