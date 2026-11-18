# BiasharaScore — test Lipa na M-Pesa till statements

There are 10 **test samples** in the Lipa na M-Pesa merchant (till) statement layout, one per test owner. They are not Safaricom documents: there is no branding, stamp or QR code, every page carries a "TEST SAMPLE" banner, and every receipt starts with `TST`. All names, shortcodes (990xxxx) and receipts are fictional.

- **Period:** 17 Aug 2026 – 16 Nov 2026 (3 months). **No password.** Set `PASSWORD` in `gen_statements.py` to regenerate protected copies.
- **Header:** Organisation Name, Shortcode, Statement Period, Request Date, then "ACCOUNT TYPE - MERCHANT ACCOUNT". There is no summary table.
- **9 columns, newest first:** Receipt No. · Completion Time · Details · Transaction Status · Paid In · Withdrawn · Balance · Transaction Type · Other Party. Completion Time wraps onto two lines (date, then time). Withdrawn amounts are negative.

## Row types
- **Sale:** `Merchant Payment from - 2547******123 NAME` (type "Pay Merchant") or `Merchant Payment Online from - 07******123 NAME` (type "Pay Merchant Online")
- **Sweep:** each evening the balance moves to the owner's own M-Pesa: `Merchant Account to Customer Account Transfer to - 2547******101 OWNER` (type "Merchant to Customer Transfer"). This is **not** an expense; the owner is moving their own money. (The wording is a best guess; check it against a real till statement that has a withdrawal.)

## Test owners

| # | Organisation name | Business | Shortcode | Band | Till sales / mo | Unique customers | Repeat customers | Avg sale | Expenses to self-report / mo |
|---|---|---|---|---|---|---|---|---|---|
| 01 | Grace Wanjiru Mwangi | Mama Grace Groceries | 9900101 | Low | ~203k | 98 | 78% | 1,498 | ~181k |
| 02 | Daniel Kiprotich Rotich | Eldoret Agrovet Supplies | 9900102 | Low | ~324k | 99 | 57% | 2,661 | ~282k |
| 03 | Aisha Mohamed Hassan | Pwani Tailoring House | 9900103 | Low | ~150k | 102 | 64% | 1,085 | ~132k |
| 04 | Peter Otieno Ochieng | Lakeside Fish Traders | 9900104 | Moderate | ~108k | 111 | 60% | 1,201 | ~96k |
| 05 | Faith Njeri Kamau | Njeri Beauty Parlour | 9900105 | Moderate | ~78k | 103 | 58% | 921 | ~69k |
| 06 | Brian Mutua Musyoka | Mutua Hardware | 9900106 | Moderate | ~121k | 107 | 59% | 1,446 | ~102k |
| 07 | Esther Chebet Langat | Kericho Dairy Collection | 9900107 | Moderate | ~85k | 102 | 48% | 1,142 | ~83k |
| 08 | Kevin Omondi Were | Omosh Mitumba Stall | 9900108 | High | ~30k | 96 | 34% | 594 | ~36k |
| 09 | Lucy Akinyi Odhiambo | Akinyi Cereals | 9900109 | High | ~19k | 80 | 45% | 432 | ~27k |
| 10 | Samuel Kariuki Ndungu | Kariuki Boda Spares | 9900110 | High | ~28k | 94 | 33% | 552 | ~37k |

What separates the bands:
- **Low risk:** high, steady or growing sales; a loyal customer base (57–78% repeat customers).
- **Moderate risk:** mid-level, flat sales.
- **High risk:** low sales, falling 12–18% a month, mostly one-off customers (33–45% repeat), and some days with no sales.

## ground_truth.json
- `till_transactions`, `till_payments`, `till_revenue_total`, `avg_monthly_till_revenue` (= till revenue ÷ days × 30.4)
- `unique_customers` and `repeat_customer_share`, both counted **by name**, because the masked number switches between the `2547…` and `07…` formats
- `avg_ticket`, `till_sweeps_total`, `till_closing_balance`
- `suggested_monthly_expenses`: what the owner should type into the expenses field (a till statement shows no costs)
- `all_customer_revenue_monthly`: sales including the ~15% of customers who paid outside the till (by send-money or cash). The till statement can't see these, so till revenue is a slight under-estimate, which is the cautious side.

## Regenerating
`python3 gen_statements.py` (deterministic). Edit `OWNERS` at the top to match your seeded test owners.
