r"""
Data migration: prepare User contact fields for the new rules in 0003.

- Blank national_id, phone and county become NULL.
- Phone numbers are normalised to +254XXXXXXXXX (spaces/dashes removed; 07.., 01.. and 254..
  rewritten). A phone that still does not match ^\+254[17]\d{8}$ becomes NULL, so the column
  can shrink to 15 characters.
- If two users share a national ID, the lowest id keeps it and the others become NULL, so the
  unique index added in 0003 can be created.

Not reversible: the original values are not kept.
"""
import re

from django.db import migrations

PHONE = re.compile(r"^\+254[17]\d{8}$")


def _phone(value):
    v = re.sub(r"[\s\-()]", "", value or "")
    if re.fullmatch(r"0[17]\d{8}", v):
        v = "+254" + v[1:]
    elif re.fullmatch(r"254[17]\d{8}", v):
        v = "+" + v
    return v if PHONE.match(v) else None


def normalise_contact_fields(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    seen_ids = set()
    changed = 0
    for pk, nid, phone, county in User.objects.order_by("id").values_list("id", "national_id", "phone", "county"):
        new_nid = (nid or "").strip() or None
        if new_nid is not None and new_nid in seen_ids:
            new_nid = None
        if new_nid is not None:
            seen_ids.add(new_nid)
        new_phone = _phone(phone) if phone is not None else None
        new_county = (county or "").strip() or None
        if (new_nid, new_phone, new_county) != (nid, phone, county):
            User.objects.filter(pk=pk).update(national_id=new_nid, phone=new_phone, county=new_county)
            changed += 1
    print(f"\n  users: {changed} row(s) changed (national_id / phone / county normalised).")
    return changed


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(normalise_contact_fields, migrations.RunPython.noop),
    ]
