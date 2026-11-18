"""Turns parsed till rows into the figures BiasharaScore uses. Definitions match ground_truth.json in
scoring/tests/fixtures/statements/ (see its README):

    days                   period end - period start + 1
    avg_monthly_revenue    sum of sales / days x 30.4
    till_payments          number of sales
    avg_ticket             revenue / payments
    unique_customers       distinct payer names (the masked number changes between app and online payments)
    repeat_customer_share  customers with 2+ payments / unique customers (3 decimals)
    monthly_breakdown      [{month "YYYY-MM", sales, payments, unique_customers}], calendar months in the period
    flags                  revenue_trend_pct, zero_sale_days, sweeps_total, other_in_total, other_out_total

Money is rounded to whole shillings (half up).
"""
from collections import Counter, defaultdict
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from .categorise import OTHER_IN, OTHER_OUT, SALE, SWEEP, categorise, customer_name

DAYS_PER_MONTH = Decimal("30.4")
TREND_WINDOW_DAYS = 30


def shillings(value):
    return int(Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def profit_from(revenue, expenses):
    """Monthly profit for the model when revenue comes from a till statement and expenses are self-reported.
    Never below 0: the form and the model only know profitable businesses, and a tree model treats every
    margin below its training range alike, so 0 scores the same as a loss. The loss itself stays visible
    as revenue and expenses on the request."""
    return max(Decimal("0"), Decimal(str(revenue)) - Decimal(str(expenses)))


def summarise(parsed):
    categories = [(row, categorise(row)) for row in parsed.rows]
    sales = [row for row, cat in categories if cat == SALE]

    revenue = sum((r.paid_in for r in sales), Decimal("0"))
    payments = len(sales)
    days = parsed.days

    per_customer = Counter(customer_name(r) for r in sales)
    unique = len(per_customer)
    repeat = sum(1 for n in per_customer.values() if n >= 2)

    # Calendar months inside the period, in order, including months with no sales.
    by_month = defaultdict(lambda: {"sales": Decimal("0"), "payments": 0, "customers": set()})
    day = parsed.period_start
    while day <= parsed.period_end:
        by_month[day.strftime("%Y-%m")]
        day = (day.replace(day=1) + timedelta(days=32)).replace(day=1)
    for r in sales:
        m = by_month[r.completed_at.strftime("%Y-%m")]
        m["sales"] += r.paid_in
        m["payments"] += 1
        m["customers"].add(customer_name(r))
    monthly = [
        {"month": month, "sales": shillings(m["sales"]), "payments": m["payments"], "unique_customers": len(m["customers"])}
        for month, m in sorted(by_month.items())
    ]

    # Trend: last 30 days of the period against the first 30.
    first_end = parsed.period_start + timedelta(days=TREND_WINDOW_DAYS - 1)
    last_start = parsed.period_end - timedelta(days=TREND_WINDOW_DAYS - 1)
    first = sum((r.paid_in for r in sales if r.completed_at.date() <= first_end), Decimal("0"))
    last = sum((r.paid_in for r in sales if r.completed_at.date() >= last_start), Decimal("0"))
    trend = float(((last - first) / first * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)) if first else None

    sale_days = {r.completed_at.date() for r in sales}
    zero_days = sum(
        1 for i in range(days) if parsed.period_start + timedelta(days=i) not in sale_days
    )

    def total(cat, attr):
        return shillings(sum((getattr(r, attr) for r, c in categories if c == cat), Decimal("0")))

    return {
        "days": days,
        "transactions_count": len(parsed.rows),
        "revenue_total": shillings(revenue),
        "avg_monthly_revenue": shillings(revenue / days * DAYS_PER_MONTH) if days > 0 else 0,
        "till_payments": payments,
        "avg_ticket": shillings(revenue / payments) if payments else 0,
        "unique_customers": unique,
        "repeat_customer_share": round(repeat / unique, 3) if unique else 0.0,
        "monthly_breakdown": monthly,
        "flags": {
            "revenue_trend_pct": trend,
            "zero_sale_days": zero_days,
            "sweeps_total": total(SWEEP, "withdrawn"),
            "other_in_total": total(OTHER_IN, "paid_in"),
            "other_out_total": total(OTHER_OUT, "withdrawn"),
        },
    }
