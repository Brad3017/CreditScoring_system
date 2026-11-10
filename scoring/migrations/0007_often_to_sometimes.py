"""
Data migration: the v2 model has no "Often" category for late_payment_history.
Existing requests that say "Often" become "Sometimes", the highest category v2 knows.

Not reversible: once converted, there is no record of which rows were "Often".
Assessments already stored for these rows are NOT rescored.
"""
from django.db import migrations


def often_to_sometimes(apps, schema_editor):
    CreditRequest = apps.get_model("scoring", "CreditRequest")
    changed = CreditRequest.objects.filter(late_payment_history__iexact="often").update(
        late_payment_history="Sometimes"
    )
    print(f"\n  late_payment_history: {changed} row(s) changed from 'Often' to 'Sometimes'.")


class Migration(migrations.Migration):

    dependencies = [
        ("scoring", "0006_creditassessment_monthly_repayment_estimate_and_more"),
    ]

    operations = [
        migrations.RunPython(often_to_sometimes, migrations.RunPython.noop),
    ]
