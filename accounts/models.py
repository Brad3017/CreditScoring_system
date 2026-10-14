from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user with role-based access."""

    ROLE_CHOICES = [
        ("owner",   "MSME Owner"),
        ("analyst", "Credit Analyst"),
        ("admin",   "Administrator"),
    ]

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    national_id = models.CharField(max_length=20, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
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

    def __str__(self):
        return f"{self.email} ({self.role})"