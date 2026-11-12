from django.core.validators import RegexValidator
from rest_framework import serializers
from rest_framework.fields import empty
from django.contrib.auth import get_user_model
from .models import (
    BusinessProfile, CreditRequest, CreditAssessment,
    KRA_PIN_PATTERN, KRA_PIN_MESSAGE, KRA_PIN_DUPLICATE_MESSAGE, KRA_PIN_OWN_BUSINESS_MESSAGE,
    KRA_PIN_LOCKED_MESSAGE, normalise_kra_pin,
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


def pin_taken_message(pin, user, exclude_pk=None, own_message=KRA_PIN_OWN_BUSINESS_MESSAGE):
    """None when no OTHER business holds this PIN. Otherwise the message to show: the owner's own
    business is named; another owner's business is never named or hinted at."""
    if not pin:
        return None
    qs = BusinessProfile.objects.filter(kra_pin=pin)
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    holder = qs.only("user_id", "business_name").first()
    if holder is None:
        return None
    if holder.user_id == user.pk:
        return own_message.format(name=holder.business_name)
    return KRA_PIN_DUPLICATE_MESSAGE


class AssessmentBusinessSerializer(serializers.Serializer):
    """Which business an assessment is for. Either business_id (one of the owner's saved businesses)
    or, with no business_id, a NEW business described by business_name and kra_pin.
    Format checks only; ownership and PIN uniqueness are checked in the view, inside the transaction."""
    business_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    business_name = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=150)
    kra_pin = KraPinField()

    def validate(self, attrs):
        if attrs.get("business_id") is None and not (attrs.get("business_name") or "").strip():
            raise serializers.ValidationError({"business_name": "Enter the business name."})
        return attrs


# Fields an owner edits on a business. PIN rules are in validate_kra_pin.
BUSINESS_FIELDS = [
    "business_name", "kra_pin", "sector", "county", "location_type", "legal_status",
    "business_age_years", "employees_count",
]


class BusinessProfileSerializer(serializers.ModelSerializer):
    kra_pin = KraPinField()
    assessment_count = serializers.SerializerMethodField()
    pin_locked = serializers.SerializerMethodField()

    class Meta:
        model = BusinessProfile
        fields = ["id", *BUSINESS_FIELDS, "created_at", "assessment_count", "pin_locked"]
        read_only_fields = ["id", "created_at"]

    def get_assessment_count(self, obj):
        return CreditAssessment.objects.filter(request__business=obj).count()

    def get_pin_locked(self, obj):
        return self.get_assessment_count(obj) > 0

    def validate_business_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Enter the business name.")
        return value

    def validate_kra_pin(self, pin):
        instance = self.instance
        if instance is not None and pin != instance.kra_pin and instance.has_assessments():
            raise serializers.ValidationError(KRA_PIN_LOCKED_MESSAGE)
        message = pin_taken_message(
            pin, self.context["request"].user, exclude_pk=instance.pk if instance else None,
            own_message="This KRA PIN is already registered to your business '{name}'.",
        )
        if message:
            raise serializers.ValidationError(message)
        return pin


class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "national_id",
                  "phone", "county", "role"]


# Every answer scoring needs must be sent explicitly; model-field defaults must not stand in for
# answers. collateral_level is not a model input since v3 but is required for the loan limit.
# repayment_confidence is no longer asked (v3); it is accepted if sent, and stored as NULL if not.
MODEL_INPUT_FIELDS = [
    "sector", "legal_status", "location_type", "loan_purpose", "business_age_years",
    "employees_count", "monthly_revenue_kes", "monthly_profit_kes", "loan_amount",
    "tenure_months", "existing_loans", "prior_loan_count", "late_payment_history",
    "collateral_level", "cashflow_stability", "owner_education",
    "days_payable_outstanding",
]


class CreditRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditRequest
        fields = "__all__"
        # business and business_name are set by the view from the chosen BusinessProfile
        # (AssessmentBusinessSerializer reads the business choice), never from this payload.
        read_only_fields = ["id", "user", "submitted_at", "business", "business_name"]
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
        allowed["collateral_level"] = services.COLLATERAL_LEVELS
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