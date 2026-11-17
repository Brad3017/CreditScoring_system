"""
Backfill valid_until on assessments created before the field existed: created_at + 30 days.

A fixed 30 days (the default validity at the time this was introduced), not settings.SCORE_VALIDITY_DAYS,
so the result does not depend on how the setting happens to be configured when the migration runs.
Older records (e.g. model v1/v2) become Expired by this, which is intended. Nothing else is changed.
"""
from datetime import timedelta

from django.db import migrations
from django.db.models import F

BACKFILL_DAYS = 30


def backfill(apps, schema_editor):
    CreditAssessment = apps.get_model("scoring", "CreditAssessment")
    CreditAssessment.objects.filter(valid_until__isnull=True).update(
        valid_until=F("created_at") + timedelta(days=BACKFILL_DAYS)
    )


class Migration(migrations.Migration):

    dependencies = [
        ("scoring", "0013_creditassessment_valid_until"),
    ]

    operations = [
        # Reverse is a no-op: the column itself is dropped by reversing 0013.
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
