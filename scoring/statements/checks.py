"""Checks on a parsed till statement. Each returns {code, status, message}; status is pass, warn or fail.
Any fail rejects the statement.

    balance_chain       fail  previous balance + paid in - withdrawn = balance (within 0.01) on every row
    duplicate_receipts  fail  a receipt number appears more than once
    min_period          fail  shorter than STATEMENT_MIN_DAYS days
    no_sales            fail  no sale rows at all
    recency             warn  ended more than STATEMENT_MAX_AGE_DAYS days ago
    name_match          warn  Organisation Name shares no word with the owner's or the business's name
    till_number_match   warn  the business has a saved till number and it is not this Shortcode
With STATEMENT_STRICT_IDENTITY = True, name_match and till_number_match fail instead of warn.
"""
import re
from collections import Counter
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

PASS, WARN, FAIL = "pass", "warn", "fail"
BALANCE_TOLERANCE = Decimal("0.01")

# Words that say nothing about who someone is, so they never count as a name match.
_NAME_NOISE = {
    "ltd", "limited", "company", "enterprise", "enterprises", "the", "and", "shop", "store", "stores",
    "services", "general", "traders", "trading", "agency", "business",
}


def _result(code, status, message):
    return {"code": code, "status": status, "message": message}


def _tokens(*names):
    out = set()
    for name in names:
        out.update(w for w in re.findall(r"[a-z]+", (name or "").lower()) if len(w) >= 3 and w not in _NAME_NOISE)
    return out


def balance_chain(parsed):
    rows = parsed.rows
    for prev, row in zip(rows, rows[1:]):
        expected = prev.balance + row.paid_in - row.withdrawn
        if abs(expected - row.balance) > BALANCE_TOLERANCE:
            return _result("balance_chain", FAIL,
                           f"The balance does not add up at receipt {row.receipt}: expected {expected:,.2f}, "
                           f"the statement shows {row.balance:,.2f}.")
    return _result("balance_chain", PASS, "Every balance follows from the row before it.")


def duplicate_receipts(parsed):
    repeated = sorted(r for r, n in Counter(row.receipt for row in parsed.rows).items() if n > 1)
    if repeated:
        listed = ", ".join(repeated[:5]) + (" …" if len(repeated) > 5 else "")
        return _result("duplicate_receipts", FAIL, f"Receipt numbers appear more than once: {listed}.")
    return _result("duplicate_receipts", PASS, "Every receipt number is unique.")


def min_period(parsed):
    need = settings.STATEMENT_MIN_DAYS
    if parsed.days < need:
        return _result("min_period", FAIL,
                       f"The statement covers {parsed.days} days. It must cover at least {need} days (about 3 months).")
    return _result("min_period", PASS, f"The statement covers {parsed.days} days.")


def no_sales(summary):
    if summary["till_payments"] == 0:
        return _result("no_sales", FAIL, "The statement has no customer payments to the till.")
    return _result("no_sales", PASS, f"{summary['till_payments']} customer payments to the till.")


def recency(parsed, today):
    limit = settings.STATEMENT_MAX_AGE_DAYS
    age = (today - parsed.period_end).days
    if age > limit:
        return _result("recency", WARN,
                       f"The statement ended {age} days ago. A statement that ends within the last {limit} days is better.")
    return _result("recency", PASS, "The statement is recent.")


def _identity_status():
    return FAIL if settings.STATEMENT_STRICT_IDENTITY else WARN


def name_match(parsed, owner_name, business_name):
    if _tokens(parsed.organisation_name) & _tokens(owner_name, business_name):
        return _result("name_match", PASS, "The organisation name matches the owner or the business.")
    return _result("name_match", _identity_status(),
                   f"The organisation name on the statement ({parsed.organisation_name}) does not match "
                   "the owner's name or the business name.")


def till_number_match(parsed, saved_till):
    saved = (saved_till or "").strip()
    if saved and saved != parsed.shortcode:
        return _result("till_number_match", _identity_status(),
                       f"The till number on the statement ({parsed.shortcode}) is not the till number saved "
                       f"for this business ({saved}).")
    return _result("till_number_match", PASS,
                   "The till number matches the business." if saved else "No till number saved for this business yet.")


def run_checks(parsed, summary, *, owner_name="", business_name="", saved_till="", today=None):
    today = today or timezone.localdate()
    return [
        balance_chain(parsed),
        duplicate_receipts(parsed),
        min_period(parsed),
        no_sales(summary),
        recency(parsed, today),
        name_match(parsed, owner_name, business_name),
        till_number_match(parsed, saved_till),
    ]


def has_failures(checks):
    return any(c["status"] == FAIL for c in checks)
