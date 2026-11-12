from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.conf import settings

# KRA PIN: the letter P, exactly 9 digits, then one letter. Example: P051234567X.
KRA_PIN_PATTERN = r"^P\d{9}[A-Z]$"
KRA_PIN_MESSAGE = "Enter a KRA PIN in the format P051234567X: the letter P, 9 digits, then a letter."
KRA_PIN_DUPLICATE_MESSAGE = "This KRA PIN is already registered to another business."
# The same owner already registered this PIN for one of their own businesses (name shown: it is theirs).
KRA_PIN_OWN_BUSINESS_MESSAGE = (
    "This KRA PIN is already registered to your business '{name}'. "
    "Select that business instead, or enter the PIN of the new business."
)
KRA_PIN_LOCKED_MESSAGE = "Contact support to change a registered KRA PIN."


def normalise_kra_pin(value):
    """Trim and uppercase. Blank becomes None, so empty PINs never clash on the unique index."""
    if value is None:
        return None
    value = str(value).strip().upper()
    return value or None


class BusinessProfile(models.Model):
    """One business = one profile = one KRA PIN. An owner may have several businesses."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="businesses"
    )

    business_name = models.CharField(max_length=150)
    kra_pin = models.CharField(
        max_length=11, unique=True, null=True, blank=True,
        validators=[RegexValidator(KRA_PIN_PATTERN, KRA_PIN_MESSAGE)],
    )
    sector = models.CharField(max_length=50)
    business_age_years = models.IntegerField()
    legal_status = models.CharField(max_length=50)
    location_type = models.CharField(max_length=20)
    employees_count = models.IntegerField()
    county = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Every write path (API, admin, shell) stores the same normalised form, or NULL.
        self.kra_pin = normalise_kra_pin(self.kra_pin)
        super().save(*args, **kwargs)

    def has_assessments(self):
        """Once a business has been assessed, its KRA PIN is locked."""
        return CreditAssessment.objects.filter(request__business=self).exists()

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
    loan_purpose = models.CharField(max_length=30, default="Working capital")

    # Financial performance (Model features)
    monthly_revenue_kes = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    monthly_profit_kes = models.DecimalField(max_digits=15, decimal_places=2)
    days_payable_outstanding = models.IntegerField(default=30)
    cashflow_stability = models.IntegerField(default=3)  # 1 to 5 scale

    # Borrowing track record & security (Model features)
    existing_loans = models.BooleanField(default=False)
    prior_loan_count = models.IntegerField(default=0)
    late_payment_history = models.CharField(max_length=20, default="Never")
    # Not a model input since v3; still required, because the recommended loan limit uses it.
    collateral_level = models.CharField(max_length=20, default="Moderate")
    # 1 to 5 scale. Asked only up to model v2; kept for history. NULL = not asked.
    repayment_confidence = models.IntegerField(null=True, blank=True)
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

    def clean(self):
        super().clean()
        if self.business_id and self.user_id and self.business.user_id != self.user_id:
            raise ValidationError({"business": "A credit request can only be linked to a business owned by the same user."})

    def save(self, *args, **kwargs):
        # Checked on every save (API, admin, shell), not only in forms: a request must never be
        # linked to someone else's business.
        if self.business_id and self.user_id and self.business.user_id != self.user_id:
            raise ValidationError("A credit request can only be linked to a business owned by the same user.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.business_name or 'Request'} #{self.id}"


class CreditAssessment(models.Model):
    RISK_CHOICES = [
        ("Low Risk", "Low Risk"),
        ("Moderate Risk", "Moderate Risk"),
        ("High Risk", "High Risk"),
    ]
    REVIEW_STATUS_CHOICES = [
        ("pending", "Pending review"),
        ("approved", "Approved"),
        ("declined", "Declined"),
        ("referred", "Referred for more information"),
    ]

    request = models.OneToOneField(
        CreditRequest, on_delete=models.CASCADE, related_name="assessment"
    )
    probability_of_default = models.DecimalField(max_digits=5, decimal_places=4)
    credit_score = models.IntegerField()
    risk_category = models.CharField(max_length=20, choices=RISK_CHOICES)
    recommended_limit = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    shap_explanation = models.JSONField(default=list)
    # Per-feature SHAP contributions (log-odds of default). Empty for assessments made before v2.
    shap_values = models.JSONField(default=list, blank=True)
    # Flat estimate: loan amount / tenure, no interest.
    monthly_repayment_estimate = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    # No default: the view always sets this from model_metadata.json, so a missing value fails loudly.
    model_version = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    # ---- Analyst review (new) ----
    review_status = models.CharField(
        max_length=10, choices=REVIEW_STATUS_CHOICES, default="pending", db_index=True
    )
    review_note = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_assessments",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Assessment #{self.id} - Score: {self.credit_score} ({self.risk_category})"


class LessonView(models.Model):
    """An owner opened a "Learn" lesson. At most one row per user, lesson and day."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_views")
    feature_key = models.CharField(max_length=50)  # a model feature key, e.g. "late_payment_history"
    viewed_at = models.DateTimeField(auto_now_add=True)
    viewed_on = models.DateField()  # local date of viewed_at; carries the once-per-day rule

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "feature_key", "viewed_on"], name="one_lesson_view_per_user_per_day"),
        ]

    def __str__(self):
        return f"{self.user_id} read {self.feature_key} on {self.viewed_on}"


class LetterDownload(models.Model):
    """One download of a decision letter (GET .../letter/ as an attachment). Inline previews are not logged."""
    assessment = models.ForeignKey(CreditAssessment, on_delete=models.CASCADE, related_name="letter_downloads")
    # SET_NULL keeps the count if an account is later deleted.
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="letter_downloads")
    downloaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Letter for assessment {self.assessment_id} downloaded by {self.user_id} at {self.downloaded_at}"
