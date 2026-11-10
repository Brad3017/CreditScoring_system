r"""
Data migration: bring stored KRA PINs into the new format (P + 9 digits + letter).

- Trim and uppercase every stored PIN.
- Anything that still does not match ^P\d{9}[A-Z]$ (old A-format test PINs, blanks,
  values too long for the new 11-character column) becomes NULL.
- If two rows normalise to the same PIN, the lowest id keeps it and the others become NULL,
  so the unique index cannot fail.

Runs before 0009, which shrinks the column to 11 characters.
Not reversible: the original values are not kept.
"""
import re

from django.db import migrations

PATTERN = re.compile(r"^P\d{9}[A-Z]$")


def normalise_kra_pins(apps, schema_editor):
    BusinessProfile = apps.get_model("scoring", "BusinessProfile")

    # 1. Work out every final value in memory first (lowest id wins a clash).
    taken = set()
    changes = {}
    for pk, old in BusinessProfile.objects.exclude(kra_pin__isnull=True).order_by("id").values_list("id", "kra_pin"):
        new = old.strip().upper()
        if not PATTERN.match(new) or new in taken:
            new = None
        if new is not None:
            taken.add(new)
        if new != old:
            changes[pk] = new

    # 2. Clear the changed rows, then write the new values. Doing it in this order means a row
    #    never collides with an old value that a later row is about to give up.
    #    .update() skips model.save(), whose behaviour may change in later code.
    BusinessProfile.objects.filter(pk__in=changes).update(kra_pin=None)
    for pk, new in changes.items():
        if new is not None:
            BusinessProfile.objects.filter(pk=pk).update(kra_pin=new)

    normalised = sum(1 for v in changes.values() if v is not None)
    nulled = len(changes) - normalised
    print(f"\n  kra_pin: {len(changes)} row(s) changed ({normalised} normalised, {nulled} set to NULL).")
    return normalised, nulled


class Migration(migrations.Migration):

    dependencies = [
        ("scoring", "0007_often_to_sometimes"),
    ]

    operations = [
        migrations.RunPython(normalise_kra_pins, migrations.RunPython.noop),
    ]
