"""
/api/notifications/ — the signed-in user's own notifications only. Login and the role's required consent
(accounts.permissions.ConsentRequired) are needed for every endpoint, as on the rest of the app.

    GET  unread-count/          {"unread": n}   also runs the lazy reminder checks (every 10 min per user)
    GET  ?unread=true&page=1    paginated, 20 per page
    POST <id>/read/             404 if it is not yours
    POST read-all/              {"marked": n}
"""
import logging

from django.core.cache import cache
from django.utils import timezone
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import ConsentRequired

from .checks import run_checks_for
from .models import Notification

logger = logging.getLogger(__name__)

CHECK_EVERY_SECONDS = 10 * 60
FIELDS = ("id", "type", "title", "message", "link", "created_at", "read_at")


def _row(n):
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "link": n.link,
        "created_at": n.created_at.isoformat(),
        "read_at": n.read_at.isoformat() if n.read_at else None,
    }


def check_key(user_id):
    return f"notif-check:{user_id}"


class NotificationPagination(PageNumberPagination):
    page_size = 20


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated, ConsentRequired]

    def get(self, request):
        # cache.add only succeeds when the key is absent: the checks run at most once per 10 minutes.
        if cache.add(check_key(request.user.pk), 1, CHECK_EVERY_SECONDS):
            try:
                run_checks_for(request.user)
            except Exception:
                logger.exception("Reminder checks failed for user %s.", request.user.pk)
        unread = Notification.objects.filter(recipient=request.user, read_at__isnull=True).count()
        return Response({"unread": unread})


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated, ConsentRequired]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user).only(*FIELDS)
        if str(request.query_params.get("unread", "")).lower() in ("true", "1"):
            qs = qs.filter(read_at__isnull=True)
        paginator = NotificationPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([_row(n) for n in page])


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated, ConsentRequired]

    def post(self, request, pk):
        n = Notification.objects.filter(pk=pk, recipient=request.user).first()
        if n is None:
            return Response({"detail": "Not found"}, status=404)
        if n.read_at is None:
            n.read_at = timezone.now()
            n.save(update_fields=["read_at"])
        return Response(_row(n))


class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated, ConsentRequired]

    def post(self, request):
        marked = Notification.objects.filter(recipient=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"marked": marked})
