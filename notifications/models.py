from django.conf import settings
from django.db import models
from django.db.models import Q


class Notification(models.Model):
    """One in-app notification for one user (the bell in the top bar).

    Content rule: title and message never include the score, risk band, loan limit or any amount. They say
    THAT something happened and link to the page where the signed-in user can see the details."""

    ASSESSMENT_SUBMITTED = "assessment_submitted"
    DECISION_MADE = "decision_made"
    REVIEW_REQUESTED = "review_requested"
    SCORE_EXPIRING = "score_expiring"
    SCORE_EXPIRED = "score_expired"
    QUEUE_OVERDUE = "queue_overdue"
    STAFF_ACTIVATED = "staff_activated"
    TYPE_CHOICES = [
        (ASSESSMENT_SUBMITTED, "Assessment submitted"),
        (DECISION_MADE, "Decision made"),
        (REVIEW_REQUESTED, "Review requested"),
        (SCORE_EXPIRING, "Score expiring"),
        (SCORE_EXPIRED, "Score expired"),
        (QUEUE_OVERDUE, "Queue overdue"),
        (STAFF_ACTIVATED, "Staff account activated"),
    ]

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title = models.CharField(max_length=120)
    message = models.CharField(max_length=300)
    # A path inside the app, e.g. /assessments/42 (owner) or /analyst/requests/42 (staff).
    link = models.CharField(max_length=200, blank=True, default="")
    assessment = models.ForeignKey(
        "scoring.CreditAssessment", on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications",
    )
    # Same key for the same recipient = the same event: never created twice (see services.notify).
    dedupe_key = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "dedupe_key"], condition=Q(dedupe_key__isnull=False),
                name="notification_recipient_dedupe_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["recipient", "read_at"], name="notif_recipient_read_idx"),
            models.Index(fields=["recipient", "-created_at"], name="notif_recipient_created_idx"),
        ]

    def __str__(self):
        return f"{self.recipient} · {self.type} · {self.title}"
