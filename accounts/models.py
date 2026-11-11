import re

from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models

# Kenyan mobile number, stored in international form: +2547XXXXXXXX or +2541XXXXXXXX.
PHONE_PATTERN = r"^\+254[17]\d{8}$"
PHONE_MESSAGE = "Enter a Kenyan mobile number in the format +254712345678."
NATIONAL_ID_DUPLICATE_MESSAGE = "This national ID number is already registered to another account."


def normalise_phone(value):
    """'0712 345 678', '254712345678' and '+254-712-345678' all become '+254712345678'.
    Blank becomes None. Anything else is returned cleaned but unchanged, for the validator to reject."""
    if value is None:
        return None
    v = re.sub(r"[\s\-()]", "", str(value))
    if not v:
        return None
    if re.fullmatch(r"0[17]\d{8}", v):
        return "+254" + v[1:]
    if re.fullmatch(r"254[17]\d{8}", v):
        return "+" + v
    return v


def blank_to_none(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


class User(AbstractUser):
    """Custom user with role-based access."""

    ROLE_CHOICES = [
        ("owner",   "MSME Owner"),
        ("analyst", "Credit Analyst"),
        ("admin",   "Administrator"),
    ]

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    # NULL (never "") when not given, so accounts without an ID never clash on the unique index.
    national_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    phone = models.CharField(
        max_length=15, blank=True, null=True,
        validators=[RegexValidator(PHONE_PATTERN, PHONE_MESSAGE)],
    )
    county = models.CharField(max_length=50, blank=True, null=True)
    #business = models.ForeignKey("businesses.BusinessProfile", on_delete=models.CASCADE, null=True, blank=True)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="owner")
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("active", "Active")],
        default="active",
    )

    invitation_token = models.CharField(max_length=255, blank=True, null=True)
    invited_by = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="invited_users",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def save(self, *args, **kwargs):
        # Same stored form from every write path (API, admin, shell).
        self.national_id = blank_to_none(self.national_id)
        self.phone = normalise_phone(self.phone)
        self.county = blank_to_none(self.county)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} ({self.role})"