from django.db import models
from django.conf import settings


class BusinessProfile(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="businesses"
    )
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
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="credit_requests"
    )
    # Links to BusinessProfile above and writes to business_id column in the database
    business = models.ForeignKey(
        BusinessProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_requests"
    )

    # Loan specifics
    loan_amount = models.DecimalField(max_digits=15, decimal_places=2, default=500000.00)
    tenure_months = models.IntegerField(default=12)

    # Financial performance (Model features)
    monthly_revenue_kes = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    monthly_profit_kes = models.DecimalField(max_digits=15, decimal_places=2)
    days_payable_outstanding = models.IntegerField(default=30)
    cashflow_stability = models.IntegerField(default=3)  # 1 to 5 scale

    # Borrowing track record & security (Model features)
    existing_loans = models.BooleanField(default=False)
    prior_loan_count = models.IntegerField(default=0)
    late_payment_history = models.CharField(max_length=20, default="Never")
    collateral_level = models.CharField(max_length=20, default="Moderate")
    repayment_confidence = models.IntegerField(default=4)  # 1 to 5 scale
    owner_education = models.CharField(max_length=50, default="Secondary")

    # Business demographics snapshot (captured at time of application)
    business_name = models.CharField(max_length=255, blank=True)
    county = models.CharField(max_length=100, default="Nairobi")
    sector = models.CharField(max_length=50, default="Retail")
    legal_status = models.CharField(max_length=50, default="Sole")
    location_type = models.CharField(max_length=50, default="Urban")
    business_age_years = models.IntegerField(default=3)
    employees_count = models.IntegerField(default=3)

    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "scoring_creditrequest"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.business_name or 'Request'} #{self.id}"


class CreditAssessment(models.Model):
    RISK_CHOICES = [
        ("Low Risk", "Low Risk"),
        ("Moderate Risk", "Moderate Risk"),
        ("High Risk", "High Risk")
    ]

    request = models.OneToOneField(
        CreditRequest,
        on_delete=models.CASCADE,
        related_name="assessment"
    )
    probability_of_default = models.DecimalField(max_digits=5, decimal_places=4)
    credit_score = models.IntegerField()
    risk_category = models.CharField(max_length=20, choices=RISK_CHOICES)
    recommended_limit = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    shap_explanation = models.JSONField(default=list)
    model_version = models.CharField(max_length=50, default="xgb_msme_v1")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Assessment #{self.id} - Score: {self.credit_score} ({self.risk_category})"