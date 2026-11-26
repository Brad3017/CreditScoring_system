from django.urls import path

from .views import MarkAllReadView, MarkReadView, NotificationListView, UnreadCountView

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications"),
    path("unread-count/", UnreadCountView.as_view(), name="notifications_unread_count"),
    path("read-all/", MarkAllReadView.as_view(), name="notifications_read_all"),
    path("<int:pk>/read/", MarkReadView.as_view(), name="notification_read"),
]
