from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

User = get_user_model()
ROLES = {"owner", "analyst", "admin"}


class IsAdminRole(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == "admin"


def _row(u):
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "date_joined": u.date_joined.isoformat() if u.date_joined else None,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "assessments": getattr(u, "n_requests", 0),
        "is_you": False,
    }


class AdminUserListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        users = User.objects.annotate(n_requests=Count("credit_requests")).order_by("-date_joined")
        out = []
        for u in users:
            row = _row(u)
            row["is_you"] = u.id == request.user.id
            out.append(row)
        return Response(out)


class AdminUserUpdateView(APIView):
    """Change a user's role or switch the account on or off. Nothing else is editable here."""
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        try:
            u = User.objects.annotate(n_requests=Count("credit_requests")).get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)

        if u.id == request.user.id:
            return Response(
                {"detail": "You cannot change your own role or deactivate yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        changed = []
        if "role" in request.data:
            if request.data["role"] not in ROLES:
                return Response({"detail": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)
            u.role = request.data["role"]
            changed.append("role")
        if "is_active" in request.data:
            if not isinstance(request.data["is_active"], bool):
                return Response({"detail": "is_active must be true or false."}, status=status.HTTP_400_BAD_REQUEST)
            u.is_active = request.data["is_active"]
            changed.append("is_active")
        if not changed:
            return Response({"detail": "Nothing to update."}, status=status.HTTP_400_BAD_REQUEST)

        u.save(update_fields=changed)
        return Response(_row(u))
