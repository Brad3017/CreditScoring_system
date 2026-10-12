from django.db import models
from django.conf import settings


class BusinessProfile(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="businesses")
    business_name = models.CharField(max_length=150)
    sector = models.CharField(max_length=50)
    business_age_years = models.IntegerField()
    legal_status = models.CharField(max_length=50)
    location_type = models.CharField(max_length=20)
    employees_count = models.IntegerField()
    county = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.business_name


class CreditRequest(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE)

    monthly_profit_kes = models.DecimalField(max_digits=15, decimal_places=2)
    existing_loans = models.BooleanField(default=False)
    prior_loan_count = models.IntegerField(default=0)
    late_payment_history = models.CharField(max_length=20)
    cashflow_stability = models.IntegerField()
    repayment_confidence = models.IntegerField()
    days_payable_outstanding = models.IntegerField()

    collateral_level = models.CharField(max_length=20)
    owner_education = models.CharField(max_length=50)

    mobile_money_volume_kes = models.DecimalField(max_digits=15, decimal_places=2,
                                                  null=True, blank=True)
    utility_payment_consistency = models.CharField(max_length=20, null=True, blank=True)
    savings_rate_pct = models.DecimalField(max_digits=5, decimal_places=2,
                                           null=True, blank=True)
    psychometric_score = models.IntegerField(null=True, blank=True)
    has_formal_credit_history = models.BooleanField(default=False)
    digital_footprint_score = models.IntegerField(null=True, blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Request #{self.id} — {self.business.business_name}"


class CreditAssessment(models.Model):
    RISK_CHOICES = [("Low", "Low"), ("Medium", "Medium"), ("High", "High")]

    request = models.OneToOneField(CreditRequest, on_delete=models.CASCADE,
                                   related_name="assessment")
    probability_of_default = models.DecimalField(max_digits=5, decimal_places=4)
    credit_score = models.IntegerField()
    risk_category = models.CharField(max_length=10, choices=RISK_CHOICES)
    shap_explanation = models.JSONField(default=dict)
    model_version = models.CharField(max_length=20, default="xgb_v1")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Assessment for request #{self.request_id}"