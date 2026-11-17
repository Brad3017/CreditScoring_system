"""
Demo helper: move one assessment's valid_until, to show expiry in a presentation.

    python manage.py set_validity <assessment_id> --days -1     # expire now (valid_until = now - 1 day)
    python manage.py set_validity <assessment_id> --days 30     # renew (valid_until = now + 30 days)

Changes only valid_until on that one assessment. Its score, decision and everything else stay as stored.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from scoring.models import CreditAssessment
from scoring.validity import get_validity, short_date


class Command(BaseCommand):
    help = "Set an assessment's valid_until to now + N days (negative N expires it). Demo use only."

    def add_arguments(self, parser):
        parser.add_argument("assessment_id", type=int)
        parser.add_argument("--days", type=int, required=True,
                            help="Days from now; -1 expires the score, 30 renews it.")

    def handle(self, *args, assessment_id, days, **options):
        a = CreditAssessment.objects.select_related("request").filter(pk=assessment_id).first()
        if a is None:
            raise CommandError(f"Assessment {assessment_id} does not exist.")
        a.valid_until = timezone.now() + timedelta(days=days)
        a.save(update_fields=["valid_until"])
        v = get_validity(a)
        local = timezone.localtime(a.valid_until)
        self.stdout.write(
            f"Assessment {a.pk} · {a.request.business_name or 'Business not named'}\n"
            f"valid_until = {short_date(local)} {local:%H:%M} (Nairobi) · status now: {v['status']}"
        )
