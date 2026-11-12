"""
Read-only report on how credit requests are linked to businesses. Changes nothing.

    python manage.py check_business_links

Lists:
  1. requests whose snapshot business_name differs from the linked BusinessProfile's business_name
     (e.g. an assessment for a different business that was attached to the owner's existing profile);
  2. requests whose user is not the owner of the linked business;
  3. a count of requests with no linked business at all (information only).
Exit status is 0 either way; fixing any row is a manual decision.
"""
from django.core.management.base import BaseCommand
from django.db.models import F

from scoring.models import CreditRequest


def _norm(name):
    return " ".join((name or "").split()).casefold()


class Command(BaseCommand):
    help = "Read-only: list credit requests whose business link looks wrong. Changes nothing."

    def handle(self, *args, **options):
        linked = (
            CreditRequest.objects.filter(business__isnull=False)
            .select_related("user", "business", "business__user", "assessment")
            .order_by("id")
        )
        name_rows, user_rows = [], []
        for r in linked:
            if r.business_name != r.business.business_name:
                name_rows.append(r)
        for r in linked.exclude(user_id=F("business__user_id")):
            user_rows.append(r)
        unlinked = CreditRequest.objects.filter(business__isnull=True).count()
        total = CreditRequest.objects.count()

        out = self.stdout
        out.write(f"Credit requests checked: {total} ({total - unlinked} linked to a business, {unlinked} not linked)\n")

        out.write(self.style.MIGRATE_HEADING(f"\n1. Snapshot name differs from the linked business: {len(name_rows)}"))
        for r in name_rows:
            only_case = _norm(r.business_name) == _norm(r.business.business_name)
            out.write(
                f"  request {r.id} (assessment {self._assessment_id(r)}, {r.submitted_at:%Y-%m-%d}, user {r.user.email}): "
                f"snapshot '{r.business_name}' -> business {r.business_id} '{r.business.business_name}'"
                f" PIN {r.business.kra_pin or 'none'}"
                + ("  [case or spacing only]" if only_case else "")
            )

        out.write(self.style.MIGRATE_HEADING(f"\n2. Request user is not the business owner: {len(user_rows)}"))
        for r in user_rows:
            out.write(
                f"  request {r.id} (assessment {self._assessment_id(r)}): user {r.user.email} "
                f"-> business {r.business_id} '{r.business.business_name}' owned by {r.business.user.email}"
            )

        out.write("\nNothing was changed.")

    @staticmethod
    def _assessment_id(r):
        try:
            return r.assessment.id
        except CreditRequest.assessment.RelatedObjectDoesNotExist:
            return "none"
