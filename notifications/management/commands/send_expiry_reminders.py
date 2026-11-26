"""
Runs the owner reminder check (score expiring within 7 days / expired) for every active owner, and prints
how many reminders were created. For demos now, and for a real cron job later:

    python manage.py send_expiry_reminders

Running it again creates nothing new for the same assessments (each reminder has a dedupe key).
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from notifications.checks import check_owner_reminders
from notifications.models import Notification

REMINDER_TYPES = (Notification.SCORE_EXPIRING, Notification.SCORE_EXPIRED)


class Command(BaseCommand):
    help = "Create score-expiring / score-expired notifications for all owners."

    def handle(self, *args, **options):
        reminders = Notification.objects.filter(type__in=REMINDER_TYPES)
        before = reminders.count()
        owners = get_user_model().objects.filter(role="owner", is_active=True)
        for owner in owners.iterator():
            check_owner_reminders(owner)
        created = reminders.count() - before
        self.stdout.write(f"Checked {owners.count()} owner(s): {created} reminder(s) created.")
