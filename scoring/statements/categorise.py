"""What each till row is, from the start of its Details text. First match wins; case is ignored.

RULES is the one place to adjust when real statements word things differently.
    sale       a customer paying the till: counted as revenue
    sweep      the owner moving the till balance to their own M-Pesa: not revenue, not an expense
    other_in   any other money in: excluded from revenue, reported in flags
    other_out  any other money out: excluded, reported in flags
"""
import re

SALE, SWEEP, OTHER_IN, OTHER_OUT = "sale", "sweep", "other_in", "other_out"

RULES = [
    ("Merchant Payment from", SALE),
    ("Merchant Payment Online from", SALE),
    ("Merchant Account to Customer Account Transfer", SWEEP),
]

_RULES_LOWER = [(prefix.lower(), category) for prefix, category in RULES]


def categorise(row):
    details = " ".join(row.details.split()).lower()
    for prefix, category in _RULES_LOWER:
        if details.startswith(prefix):
            return category
    return OTHER_IN if row.paid_in > 0 else OTHER_OUT


# A masked number: 2547******123 (app) or 07******123 (online). The customer's name follows it.
_MASKED_NUMBER = re.compile(r"\d+\*+\d+\s+")


def customer_name(row):
    """The payer's name in upper case, e.g. "MARY MWANGI". Matched by name, not number, because the same
    customer's number is masked differently for app and online payments. '' when there is no name."""
    match = _MASKED_NUMBER.search(row.details)
    if match:
        name = row.details[match.end():]
    else:
        # No masked number: whatever follows the first " - ".
        _, _, name = row.details.partition(" - ")
    return " ".join(name.split()).upper()
