from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "password", "full_name"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        
        # Populate username with email if model requires username
        if hasattr(User, "username"):
            validated_data["username"] = validated_data.get("email")

        user = User(**validated_data)
        if hasattr(user, "role"):
            user.role = "owner"
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "national_id", "phone",
            "county", "role", "status",
        ]
        read_only_fields = ["id", "email", "role", "status"]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allows login using either email or username and embeds the role."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "email" not in self.fields:
            self.fields["email"] = serializers.EmailField(required=False)
        self.fields["username"] = serializers.CharField(required=False)

    def validate(self, attrs):
        email = attrs.get("email") or attrs.get("username")
        password = attrs.get("password")

        if not email or not password:
            raise serializers.ValidationError({"detail": "Must include email and password."})

        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if not user:
            try:
                user_obj = User.objects.get(email=email)
                if user_obj.check_password(password):
                    user = user_obj
            except User.DoesNotExist:
                pass

        if not user or not user.is_active:
            raise serializers.ValidationError({"detail": "Invalid credentials or account inactive."})

        refresh = self.get_token(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "role": getattr(user, "role", "owner"),
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": getattr(user, "full_name", ""),
                "role": getattr(user, "role", "owner"),
            },
        }