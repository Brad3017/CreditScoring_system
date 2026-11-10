from django.core.validators import RegexValidator
from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.validators import UniqueValidator
from django.contrib.auth import get_user_model
from .models import (
    BusinessProfile, CreditRequest, CreditAssessment,
    KRA_PIN_PATTERN, KRA_PIN_MESSAGE, KRA_PIN_DUPLICATE_MESSAGE, normalise_kra_pin,
)
from . import services

User = get_user_model()


class KraPinField(serializers.CharField):
    """Trims and uppercases BEFORE the format check, so "p051234567x " is stored as "P051234567X".
    Blank becomes None (NULL), so businesses without a PIN never clash on the unique index.
    No separate max_length check: the format check already fixes the length at 11."""

    def __init__(self, **kwargs):
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_null", True)
        validators = list(kwargs.pop("validators", []))
        super().__init__(validators=[RegexValidator(KRA_PIN_PATTERN, KRA_PIN_MESSAGE), *validators], **kwargs)

    def run_validation(self, data=empty):
        if data is not empty:
            data = normalise_kra_pin(data)
        return super().run_validation(data)


class KraPinSerializer(serializers.Serializer):
    """Format check only, for the PIN sent with an assessment (uniqueness is checked in the view)."""
    kra_pin = KraPinField()


class BusinessProfileSerializer(serializers.ModelSerializer):
    kra_pin = KraPinField(
        validators=[UniqueValidator(queryset=BusinessProfile.objects.all(), message=KRA_PIN_DUPLICATE_MESSAGE)],
    )

    class Meta:
        model = BusinessProfile
        fields = "__all__"
        read_only_fields = ["id", "user", "created_at"]


class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "national_id",
                  "phone", "county", "role"]


# Every model input must be sent explicitly; model-field defaults must not stand in for answers.
MODEL_INPUT_FIELDS = [
    "sector", "legal_status", "location_type", "loan_purpose", "business_age_years",
    "employees_count", "monthly_revenue_kes", "monthly_profit_kes", "loan_amount",
    "tenure_months", "existing_loans", "prior_loan_count", "late_payment_history",
    "collateral_level", "cashflow_stability", "repayment_confidence", "owner_education",
    "days_payable_outstanding",
]


class CreditRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditRequest
        fields = "__all__"
        read_only_fields = ["id", "user", "submitted_at", "business"]
        extra_kwargs = {f: {"required": True} for f in MODEL_INPUT_FIELDS}

    def validate(self, attrs):
        errors = {}
        revenue = attrs.get("monthly_revenue_kes")
        profit = attrs.get("monthly_profit_kes")

        if revenue is not None and revenue <= 0:
            errors["monthly_revenue_kes"] = "Monthly revenue must be greater than 0."
        if profit is not None:
            if profit < 0:
                errors["monthly_profit_kes"] = (
                    "Profit cannot be negative. The model was trained on profitable businesses only."
                )
            elif revenue is not None and revenue > 0 and profit > revenue:
                errors["monthly_profit_kes"] = "Profit cannot be greater than monthly revenue."

        loan = attrs.get("loan_amount")
        if loan is not None and loan <= 0:
            errors["loan_amount"] = "Loan amount must be greater than 0."

        tenure = attrs.get("tenure_months")
        if tenure is not None and not 3 <= tenure <= 60:
            errors["tenure_months"] = "Repayment period must be between 3 and 60 months."

        for field, label in (
            ("employees_count", "Employees"),
            ("business_age_years", "Business age"),
            ("prior_loan_count", "Number of previous loans"),
            ("days_payable_outstanding", "Days taken to pay suppliers"),
        ):
            if attrs.get(field) is not None and attrs[field] < 0:
                errors[field] = f"{label} cannot be negative."

        for field, label in (("cashflow_stability", "Cash-flow stability"), ("repayment_confidence", "Repayment confidence")):
            if attrs.get(field) is not None and not 1 <= attrs[field] <= 5:
                errors[field] = f"{label} must be between 1 and 5."

        allowed = dict(services.NOMINAL_CATEGORIES)
        allowed.update({k: list(v) for k, v in services.ORDINAL_MAPPINGS.items() if k != "existing_loans"})
        for field, values in allowed.items():
            if field in attrs and attrs[field] not in values:
                errors[field] = f"'{attrs[field]}' is not allowed. Use one of: {', '.join(values)}."

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

class CreditAssessmentSerializer(serializers.ModelSerializer):
    # Optionally embed the full request details when viewing an assessment
    request_details = CreditRequestSerializer(source="request", read_only=True)

    class Meta:
        model = CreditAssessment
        fields = "__all__"
        read_only_fields = ["id", "created_at"]        