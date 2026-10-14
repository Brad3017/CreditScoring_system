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
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="credit_requests")
    business = models.ForeignKey("businesses.Business", on_delete=models.CASCADE, null=True, blank=True)
    
    # Facility specifics
    loan_amount = models.DecimalField(max_digits=15, decimal_places=2, default=500000.00)
    tenure_months = models.IntegerField(default=12)
    
    # Financial performance (Model features)
    monthly_revenue_kes = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    monthly_profit_kes = models.DecimalField(max_digits=15, decimal_places=2)
    days_payable_outstanding = models.IntegerField(default=30)
    cashflow_stability = models.IntegerField(default=3) # 1 to 5
    
    # Borrowing track record & security (Model features)
    existing_loans = models.BooleanField(default=False)
    prior_loan_count = models.IntegerField(default=0)
    late_payment_history = models.CharField(max_length=20, default="Never") # Never, Rarely, Sometimes, Often
    collateral_level = models.CharField(max_length=20, default="Moderate") # Low, Moderate, High
    repayment_confidence = models.IntegerField(default=4) # 1 to 5
    owner_education = models.CharField(max_length=50, default="Secondary")
    
    # Business demographics (Can be captured here or read from linked Business model)
    business_name = models.CharField(max_length=255, blank=True)
    county = models.CharField(max_length=100, default="Nairobi")
    sector = models.CharField(max_length=50, default="Retail")
    legal_status = models.CharField(max_length=50, default="Sole")
    location_type = models.CharField(max_length=50, default="Urban")
    business_age_years = models.IntegerField(default=3)
    employees_count = models.IntegerField(default=3)
    
    # Scoring & Explainability outputs (Saved after XGBoost + SHAP run)
    credit_score = models.IntegerField(null=True, blank=True)
    probability_of_default = models.FloatField(null=True, blank=True)
    risk_tier = models.CharField(max_length=30, blank=True) # Low, Moderate, High
    recommended_limit = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    shap_explanations = models.JSONField(default=list, blank=True) # Stores top SHAP explanation strings
    
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "scoring_creditrequest"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.business_name or 'Request'} - Score: {self.credit_score} ({self.risk_tier})"


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