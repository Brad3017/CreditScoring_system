from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "password", "full_name"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data, role="owner")
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