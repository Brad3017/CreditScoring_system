"""
Deletes READ notifications older than N days (default 90). Unread ones are always kept.

    python manage.py purge_notifications --days 90
"""
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from notifications.models import Notification


class Command(BaseCommand):
    help = "Delete read notifications older than --days days (default 90)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=90)

    def handle(self, *args, days, **options):
        if days < 0:
            raise CommandError("--days must be 0 or more.")
        cutoff = timezone.now() - timedelta(days=days)
        deleted, _ = Notification.objects.filter(read_at__isnull=False, created_at__lt=cutoff).delete()
        self.stdout.write(f"Deleted {deleted} read notification(s) older than {days} days.")
