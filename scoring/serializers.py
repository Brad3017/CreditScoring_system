from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import BusinessProfile, CreditRequest, CreditAssessment

User = get_user_model()


class BusinessProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessProfile
        fields = "__all__"


class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "national_id",
                  "phone", "county", "role"]


class CreditRequestSerializer(serializers.ModelSerializer):
    business = BusinessProfileSerializer(read_only=True)
    applicant = ApplicantSerializer(source="user", read_only=True)

    class Meta:
        model = CreditRequest
        fields = "__all__"


class CreditRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditRequest
        fields = "__all__"
        read_only_fields = ["id", "user", "submitted_at"]