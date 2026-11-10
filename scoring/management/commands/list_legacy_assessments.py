"""
List assessments scored by a model other than the current one in model_metadata.json.
Read-only: prints the records and changes nothing.

    python manage.py list_legacy_assessments
"""
from django.core.management.base import BaseCommand

from scoring.models import CreditAssessment
from scoring.services import MODEL_VERSION


class Command(BaseCommand):
    help = "List assessments made with an earlier model version. Does not modify or delete anything."

    def handle(self, *args, **options):
        legacy = (
            CreditAssessment.objects.exclude(model_version=MODEL_VERSION)
            .select_related("request")
            .order_by("id")
        )
        count = legacy.count()
        self.stdout.write(f"Current model: {MODEL_VERSION}. Legacy assessments: {count}.")
        if not count:
            return

        header = f"{'ID':>6}  {'Business':<32}  {'Score':>5}  {'Stored category':<15}  Model version"
        self.stdout.write(header)
        self.stdout.write("-" * len(header))
        for a in legacy:
            name = (a.request.business_name or "Business not named")[:32]
            self.stdout.write(
                f"{a.id:>6}  {name:<32}  {a.credit_score:>5}  {a.risk_category:<15}  {a.model_version}"
            )
        self.stdout.write("Nothing was changed. Remove test records in Django admin if needed.")
