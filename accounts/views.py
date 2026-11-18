from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from . import consent_texts as texts
from .consent import grant, missing_required
from .models import NATIONAL_ID_DUPLICATE_MESSAGE
from .serializers import SignupSerializer, UserSerializer, CustomTokenObtainPairSerializer


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = serializer.save()
            grant(user, texts.PRIVACY_NOTICE, request)
            if serializer.validated_data.get("communications_opt_in"):
                grant(user, texts.COMMUNICATIONS, request)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "missing_consents": missing_required(user),
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


def _me(user, data):
    # The required consents this user still has to give (privacy_notice or staff_confidentiality).
    return {**data, "missing_consents": missing_required(user)}


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_me(request.user, UserSerializer(request.user).data))

    def patch(self, request):
        # email, role and status are read-only in UserSerializer and silently ignored here.
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            # Same national ID saved by another account between validation and this write.
            return Response({"national_id": [NATIONAL_ID_DUPLICATE_MESSAGE]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_me(request.user, serializer.data))



class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer        