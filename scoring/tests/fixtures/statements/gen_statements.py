"""Generate TEST-SAMPLE mobile-money statements (M-Pesa column format) for BiasharaScore testing.
Not Safaricom documents: no branding, every receipt starts with TST, banner on every page."""
import json, random, string, os, math
from datetime import datetime, timedelta
from collections import defaultdict
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from pypdf import PdfReader, PdfWriter

OUT = "/home/claude/statements/out"
PASSWORD = None  # set e.g. "202611" to produce password-protected PDFs like real statements
START = datetime(2026, 8, 17)
END = datetime(2026, 11, 16, 23, 59)

OWNERS = [
    # band, name, phone, business, county, monthly_inflow, trend (per month), overdraft
    ("low", "Grace Wanjiru Mwangi", "0712000101", "Mama Grace Groceries", "Nairobi", 240000, 0.03, False),
    ("low", "Daniel Kiprotich Rotich", "0712000102", "Eldoret Agrovet Supplies", "Uasin Gishu", 380000, 0.02, False),
    ("low", "Aisha Mohamed Hassan", "0712000103", "Pwani Tailoring House", "Mombasa", 160000, 0.04, False),
    ("moderate", "Peter Otieno Ochieng", "0712000104", "Lakeside Fish Traders", "Kisumu", 130000, 0.0, True),
    ("moderate", "Faith Njeri Kamau", "0712000105", "Njeri Beauty Parlour", "Kiambu", 90000, 0.01, True),
    ("moderate", "Brian Mutua Musyoka", "0712000106", "Mutua Hardware", "Machakos", 150000, -0.02, True),
    ("moderate", "Esther Chebet Langat", "0712000107", "Kericho Dairy Collection", "Kericho", 110000, 0.0, True),
    ("high", "Kevin Omondi Were", "0712000108", "Omosh Mitumba Stall", "Nairobi", 55000, -0.15, True),
    ("high", "Lucy Akinyi Odhiambo", "0712000109", "Akinyi Cereals", "Busia", 40000, -0.12, True),
    ("high", "Samuel Kariuki Ndungu", "0712000110", "Kariuki Boda Spares", "Nyeri", 60000, -0.18, True),
]

FIRST = ["John", "Mary", "James", "Ann", "Joseph", "Jane", "David", "Mercy", "Paul", "Sarah", "Moses", "Ruth",
         "Collins", "Beatrice", "Dennis", "Caroline", "Victor", "Eunice", "Kelvin", "Joyce", "Felix", "Purity"]
LAST = ["Kamau", "Otieno", "Wanjiku", "Mutiso", "Cheruiyot", "Achieng", "Njoroge", "Wekesa", "Muthoni", "Kiprono",
        "Odhiambo", "Barasa", "Chepkoech", "Mwangi", "Nyambura", "Omondi", "Kilonzo", "Auma", "Korir", "Waweru"]
SUPPLIERS = {
    "Mama Grace Groceries": ["Unga Wholesalers Ltd", "Makini Fresh Supplies", "Baraka Distributors"],
    "Eldoret Agrovet Supplies": ["Rift Agro Chemicals Ltd", "Highland Seeds Co", "Farmcare Feeds Ltd"],
    "Pwani Tailoring House": ["Coast Fabrics Ltd", "Biashara Street Textiles", "Mji Wa Kale Threads"],
    "Lakeside Fish Traders": ["Dunga Beach Fishers Coop", "Ziwa Ice Supplies", "Lake Basin Packaging"],
    "Njeri Beauty Parlour": ["Glow Cosmetics Distributors", "Thika Salon Supplies", "Urembo Wholesalers"],
    "Mutua Hardware": ["Mlolongo Steel Ltd", "Athi Cement Depot", "Ukambani Paints Ltd"],
    "Kericho Dairy Collection": ["Highland Milk Coolers", "Chai Valley Packaging", "Kericho Vet Services"],
    "Omosh Mitumba Stall": ["Gikomba Bales Importers", "Kamukunji Bales Ltd"],
    "Akinyi Cereals": ["Malaba Grain Traders", "Busia Sacks and Packaging"],
    "Kariuki Boda Spares": ["Karatina Moto Parts Ltd", "Nyeri Lubricants Depot"],
}

def send_charge(a):
    for lim, c in [(100, 0), (500, 7), (1000, 13), (1500, 23), (2500, 33), (3500, 53), (5000, 57),
                   (7500, 78), (10000, 90), (15000, 100), (20000, 105)]:
        if a <= lim: return c
    return 108

def withdraw_charge(a):
    for lim, c in [(100, 11), (2500, 29), (3500, 52), (5000, 69), (7500, 87), (10000, 115),
                   (15000, 167), (20000, 185)]:
        if a <= lim: return c
    return 197

def rid(rng, used):
    while True:
        r = "TST" + "".join(rng.choice(string.ascii_uppercase + string.digits) for _ in range(7))
        if r not in used:
            used.add(r); return r

def person(rng):
    return f"{rng.choice(FIRST)} {rng.choice(LAST)}"

def masked(rng):
    return f"2547******{rng.randint(100,999)}"

TILLS = {o[3]: f"99001{n:02d}" for n, o in enumerate(OWNERS, 1)}  # every test owner has a till (fictional 990xxxx)
TILL_SHARE = 0.85  # share of customer payments that go to the till when the owner has one

def simulate(o, seed):
    band, name, phone, biz, county, base, trend, od_allowed = o
    rng = random.Random(seed)
    used = set()
    shortcode = TILLS.get(biz)
    till_rows = []   # [dt, receipt, details, status, paid_in, withdrawn, balance, txn_type, other_party, cat, payer]
    till = {"bal": 0.0}
    pool_size = {"low": 150, "moderate": 220, "high": 320}[band]
    pool = [(f"2547******{rng.randint(100,999)}", f"07******{rng.randint(100,999)}", person(rng).upper()) for _ in range(pool_size)]
    regulars = pool[: {"low": 40, "moderate": 45, "high": 30}[band]]

    def till_pay(dt, amt, online):
        if till_rows and dt <= till_rows[-1][0]:
            dt = till_rows[-1][0] + timedelta(seconds=1)
        p = rng.choice(regulars) if rng.random() < {"low": 0.65, "moderate": 0.5, "high": 0.35}[band] else rng.choice(pool)
        till["bal"] = round(till["bal"] + amt, 2)
        if online:
            d, t = f"Merchant Payment Online from - {p[1]} {p[2]}", "Pay Merchant Online"
        else:
            d, t = f"Merchant Payment from - {p[0]} {p[2]}", "Pay Merchant"
        till_rows.append([dt, rid(rng, used), d, "Completed", amt, 0, till["bal"], t,
                          f"{shortcode} - {biz}", "till_revenue", p[2]])

    def sweep(dt):
        amt = till["bal"]
        if amt < 100: return
        if till_rows and dt <= till_rows[-1][0]:
            dt = till_rows[-1][0] + timedelta(seconds=1)
        till["bal"] = 0.0
        r = rid(rng, used)
        till_rows.append([dt, r, f"Merchant Account to Customer Account Transfer to - 2547******{phone[-3:]} {name.upper()}",
                          "Completed", 0, amt, 0.0, "Merchant to Customer Transfer", f"2547******{phone[-3:]} - {name}", "till_sweep", None])
        add(dt + timedelta(seconds=1), f"Merchant Account to Customer Account Transfer from {shortcode} - {biz.upper()}",
            amt, 0, "own_till_transfer", receipt=r)
        repay(dt + timedelta(seconds=3))
    bal = {"low": 25000, "moderate": 18000, "high": 3000}[band] * 1.0
    opening = bal
    rows = []          # (dt, receipt, details, status, paid_in, withdrawn, category)
    od_owed = 0.0
    od_count = 0
    sup = SUPPLIERS[biz]
    stock_ratio = {"low": 0.60, "moderate": 0.52, "high": 0.66}[band]
    vol = {"low": 0.25, "moderate": 0.45, "high": 0.7}[band]

    def add(dt, details, pin, pout, cat, receipt=None):
        nonlocal bal
        r = receipt or rid(rng, used)
        if rows and dt <= rows[-1][0]:
            dt = rows[-1][0] + timedelta(seconds=1)
        bal = round(bal + pin - pout, 2)
        rows.append([dt, r, details, "Completed", pin, pout, round(bal, 2), cat])
        return r

    def ensure(dt, need):
        nonlocal od_owed, od_count
        if bal >= need: return True
        if not od_allowed: return False
        short = math.ceil((need - bal) / 100) * 100
        add(dt, "OverDraft of Credit Party", short, 0, "overdraft_in")
        od_owed += short * 1.01
        od_count += 1
        return True

    def repay(dt):
        nonlocal od_owed
        if od_owed > 0 and bal > 0:
            amt = round(min(bal, od_owed), 2)
            add(dt, "OD Loan Repayment to 232323 - Overdraft Facility", 0, amt, "overdraft_repay")
            od_owed = round(od_owed - amt, 2)

    day = START
    while day <= END:
        months = (day - START).days / 30.4
        level = base * (1 + trend) ** months
        daily = level / 30.4
        weekday = day.weekday()
        ev = []  # (dt, callable) executed in time order so balances are chronological

        n = max(0, int(rng.gauss({"low": 6, "moderate": 4, "high": 3}[band], 1.5)))
        if weekday == 6: n = n // 2
        if band == "high" and rng.random() < 0.18: n = 0
        amounts = [rng.lognormvariate(0, vol) for _ in range(n)]
        tot = sum(amounts) or 1
        scale = daily * rng.uniform(0.75, 1.25) / tot if amounts else 0
        for a in amounts:
            dt = day + timedelta(minutes=rng.randint(7 * 60, 20 * 60), seconds=rng.randint(0, 59))
            amt = round(a * scale / 10) * 10 or 50
            if shortcode and rng.random() < TILL_SHARE:
                online = rng.random() < 0.3
                ev.append((dt, lambda dt=dt, amt=amt, online=online: till_pay(dt, amt, online)))
                continue
            if band != "high" and rng.random() < 0.08:
                d = f"Business Payment from {rng.randint(100000,999999)} - {rng.choice(['Jamii', 'Upendo', 'Neema', 'Tumaini'])} Enterprises via API"
            else:
                d = f"Funds received from - {masked(rng)} {person(rng)}"
            ev.append((dt, lambda dt=dt, d=d, amt=amt: (add(dt, d, amt, 0, "revenue"), repay(dt + timedelta(seconds=2)))))
        if weekday in (0, 3) or (band == "low" and weekday == 5):
            dt = day + timedelta(hours=rng.randint(16, 19), minutes=rng.randint(0, 59))
            per = {"low": 3, "moderate": 2, "high": 2}[band]
            amt = round(level * stock_ratio / (4.33 * per) * rng.uniform(0.8, 1.2) / 50) * 50
            s = rng.choice(sup)
            if rng.random() < 0.5:
                d = f"Pay Bill Online to {rng.randint(200000,999999)} - {s.upper()} Acc. INV{rng.randint(1000,9999)}"; cat = "supplier_paybill"
            else:
                d = f"Merchant Payment to {rng.randint(100000,999999)} - {s.upper()}"; cat = "supplier_merchant"
            ev.append((dt, lambda dt=dt, d=d, amt=amt, cat=cat: ensure(dt - timedelta(seconds=30), amt) and add(dt, d, 0, amt, cat)))
        if weekday == 5 and band in ("low", "moderate"):
            dt = day + timedelta(hours=18, minutes=rng.randint(0, 50))
            amt = rng.choice([1500, 2000, 2500, 3000])
            d = f"Customer Transfer to - {masked(rng)} {person(rng)}"
            def wages(dt=dt, d=d, amt=amt):
                if ensure(dt - timedelta(seconds=30), amt + send_charge(amt)):
                    r = add(dt, d, 0, amt, "wages")
                    add(dt + timedelta(seconds=1), "Customer Transfer of Funds Charge", 0, send_charge(amt), "charge_send", receipt=r)
            ev.append((dt, wages))
        if day.day == 5:
            dt = day + timedelta(hours=10, minutes=rng.randint(0, 50))
            rent = round(level * 0.08 / 500) * 500
            d = f"Pay Bill Online to {rng.randint(200000,999999)} - SHOP RENT COLLECTIONS Acc. {biz.split()[0].upper()}"
            ev.append((dt, lambda dt=dt, d=d, amt=rent: ensure(dt - timedelta(seconds=30), amt) and add(dt, d, 0, amt, "rent")))
        if day.day in (9, 23):
            dt = day + timedelta(hours=9, minutes=rng.randint(0, 50))
            amt = rng.choice([500, 700, 1000])
            d = f"Pay Bill Online to 888001 - POWER PREPAID TOKENS Acc. {rng.randint(10000000,99999999)}"
            ev.append((dt, lambda dt=dt, d=d, amt=amt: ensure(dt - timedelta(seconds=30), amt) and add(dt, d, 0, amt, "utilities")))
        if rng.random() < 0.35:
            dt = day + timedelta(hours=rng.randint(7, 21), minutes=rng.randint(0, 59))
            amt = rng.choice([50, 100, 200])
            ev.append((dt, lambda dt=dt, amt=amt: ensure(dt - timedelta(seconds=30), amt) and add(dt, "Airtime Purchase", 0, amt, "airtime")))
        if rng.random() < {"low": 0.18, "moderate": 0.25, "high": 0.3}[band]:
            dt = day + timedelta(hours=rng.randint(12, 20), minutes=rng.randint(0, 59))
            frac = rng.uniform(0.2, 0.5)
            d = f"Customer Withdrawal At Agent Till {rng.randint(100000,999999)} - {rng.choice(['Mpesa Shop', 'Quick Cash Agency', 'Wakala Point', 'Baraka Agency'])}"
            def wd(dt=dt, d=d, frac=frac):
                amt = round(min(max(bal * frac, 500), 20000) / 100) * 100
                if od_owed == 0 and amt >= 500 and bal >= amt + withdraw_charge(amt):
                    r = add(dt, d, 0, amt, "withdrawal")
                    add(dt + timedelta(seconds=1), "Customer Withdrawal Charge", 0, withdraw_charge(amt), "charge_withdraw", receipt=r)
            ev.append((dt, wd))
        if band == "low" and rng.random() < 0.03:
            dt = day + timedelta(hours=rng.randint(9, 15), minutes=rng.randint(0, 59))
            amt = rng.choice([1000, 2000, 5000])
            ev.append((dt, lambda dt=dt, amt=amt: add(dt, "Unit Trust Withdraw From 4100001 - TEST MONEY MARKET FUND", amt, 0, "mmf_withdraw")))
        if band == "low" and rng.random() < 0.08:
            dt = day + timedelta(hours=rng.randint(17, 20), minutes=rng.randint(0, 59))
            amt = rng.choice([2000, 3000, 5000])
            d = f"Deposit of Funds at Agent Till {rng.randint(100000,999999)} - Wakala Point"
            ev.append((dt, lambda dt=dt, d=d, amt=amt: (add(dt, d, amt, 0, "cash_deposit"), repay(dt + timedelta(seconds=2)))))
        if shortcode:
            dt = day + timedelta(hours=20, minutes=rng.randint(40, 58))
            ev.append((dt, lambda dt=dt: sweep(dt)))
        for _, fn in sorted(ev, key=lambda e: e[0]):
            fn()
        day += timedelta(days=1)

    return {"band": band, "name": name, "phone": phone, "business": biz, "county": county,
            "opening": round(opening, 2), "rows": rows, "closing": round(bal, 2),
            "od_count": od_count, "od_outstanding": round(od_owed, 2),
            "shortcode": shortcode, "till_rows": till_rows, "till_closing": till["bal"]}

def fmt(x):
    return f"{x:,.2f}"

SUMMARY_TYPES = [
    ("SEND MONEY", ["wages", "charge_send"]),
    ("RECEIVED MONEY", ["revenue"]),
    ("AGENT DEPOSIT", ["cash_deposit"]),
    ("AGENT WITHDRAWAL", ["withdrawal", "charge_withdraw"]),
    ("LIPA NA M-PESA (PAY BILL)", ["supplier_paybill", "rent", "utilities"]),
    ("LIPA NA M-PESA (BUY GOODS)", ["supplier_merchant"]),
    ("OTHERS", ["overdraft_in", "overdraft_repay", "airtime", "mmf_withdraw", "own_till_transfer"]),
]

def build_pdf(s, path):
    st = getSampleStyleSheet()
    small = ParagraphStyle("s", parent=st["Normal"], fontSize=7, leading=8.5)
    hdr = ParagraphStyle("h", parent=st["Normal"], fontSize=12, leading=14, fontName="Helvetica-Bold")
    norm = ParagraphStyle("n", parent=st["Normal"], fontSize=8.5, leading=11)

    def banner(c, d):
        c.saveState()
        c.setFillColor(colors.HexColor("#FCEBEB")); c.rect(12*mm, A4[1]-14*mm, A4[0]-24*mm, 8*mm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#A32D2D")); c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(A4[0]/2, A4[1]-11.2*mm, "TEST SAMPLE - NOT A SAFARICOM DOCUMENT - GENERATED FOR BIASHARASCORE TESTING ONLY")
        c.setFont("Helvetica", 7); c.setFillColor(colors.grey)
        c.drawRightString(A4[0]-12*mm, 8*mm, f"Page {d.page}")
        c.drawString(12*mm, 8*mm, "Test data. All names, numbers and receipts are fictional.")
        c.restoreState()

    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=18*mm, bottomMargin=14*mm,
                            title=f"Test statement - {s['name']}", author="BiasharaScore test generator")
    el = [Paragraph("MOBILE MONEY STATEMENT (TEST FORMAT)", hdr), Spacer(1, 3*mm)]
    info = [["Customer Name:", s["name"], "Statement Period:", f"{START:%d %b %Y} - {END:%d %b %Y}"],
            ["Mobile Number:", s["phone"], "Request Date:", "17 Nov 2026"],
            ["Business (test label):", s["business"], "Opening Balance:", fmt(s["opening"])]]
    t = Table(info, colWidths=[32*mm, 60*mm, 30*mm, 64*mm])
    t.setStyle(TableStyle([("FONTSIZE", (0,0), (-1,-1), 8.5), ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
                           ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"), ("BOTTOMPADDING", (0,0), (-1,-1), 2)]))
    el += [t, Spacer(1, 4*mm), Paragraph("<b>SUMMARY</b>", norm), Spacer(1, 1*mm)]
    agg = defaultdict(lambda: [0.0, 0.0])
    for r in s["rows"]:
        for label, cats in SUMMARY_TYPES:
            if r[7] in cats:
                agg[label][0] += r[4]; agg[label][1] += r[5]
    srows = [["TRANSACTION TYPE", "PAID IN", "PAID OUT"]]
    tin = tout = 0
    for label, _ in SUMMARY_TYPES:
        a = agg[label]; tin += a[0]; tout += a[1]
        srows.append([label, fmt(a[0]), fmt(a[1])])
    srows.append(["TOTAL:", fmt(tin), fmt(tout)])
    t = Table(srows, colWidths=[90*mm, 40*mm, 40*mm])
    t.setStyle(TableStyle([("FONTSIZE", (0,0), (-1,-1), 8), ("GRID", (0,0), (-1,-1), 0.4, colors.grey),
                           ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#E8E8E8")), ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                           ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"), ("ALIGN", (1,0), (-1,-1), "RIGHT")]))
    el += [t, Spacer(1, 5*mm), Paragraph("<b>DETAILED STATEMENT</b>", norm), Spacer(1, 1*mm)]
    head = ["Receipt", "Completion Time", "Details", "Status", "Paid In", "Withdrawn", "Balance"]
    hs = ParagraphStyle("hs", parent=small, fontName="Helvetica-Bold")
    data = [[Paragraph(h, hs) for h in head]]
    for r in reversed(s["rows"]):
        data.append([r[1], r[0].strftime("%Y-%m-%d %H:%M:%S"), Paragraph(r[2], small), r[3],
                     fmt(r[4]) if r[4] else "", "-" + fmt(r[5]) if r[5] else "", fmt(r[6])])
    t = Table(data, colWidths=[20*mm, 27*mm, 58*mm, 23*mm, 18*mm, 18*mm, 22*mm], repeatRows=1)
    t.setStyle(TableStyle([("FONTSIZE", (0,0), (-1,-1), 7), ("GRID", (0,0), (-1,-1), 0.3, colors.grey),
                           ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#E8E8E8")), ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                           ("ALIGN", (4,1), (-1,-1), "RIGHT"), ("VALIGN", (0,0), (-1,-1), "MIDDLE")]))
    el += [t, Spacer(1, 3*mm), Paragraph(f"Closing balance: {fmt(s['closing'])}", norm)]
    doc.build(el, onFirstPage=banner, onLaterPages=banner)

def build_till_pdf(s, path):
    st = getSampleStyleSheet()
    small = ParagraphStyle("s", parent=st["Normal"], fontSize=6.5, leading=8)
    hs = ParagraphStyle("hs", parent=small, fontName="Helvetica-Bold")
    hdr = ParagraphStyle("h", parent=st["Normal"], fontSize=12, leading=14, fontName="Helvetica-Bold")
    norm = ParagraphStyle("n", parent=st["Normal"], fontSize=8.5, leading=11)

    def banner(c, d):
        c.saveState()
        c.setFillColor(colors.HexColor("#FCEBEB")); c.rect(12*mm, A4[1]-14*mm, A4[0]-24*mm, 8*mm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#A32D2D")); c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(A4[0]/2, A4[1]-11.2*mm, "TEST SAMPLE - NOT A SAFARICOM DOCUMENT - GENERATED FOR BIASHARASCORE TESTING ONLY")
        c.setFont("Helvetica", 7); c.setFillColor(colors.grey)
        c.drawRightString(A4[0]-12*mm, 8*mm, f"Page {d.page}")
        c.drawString(12*mm, 8*mm, "Test data. All names, numbers and receipts are fictional.")
        c.restoreState()

    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=18*mm, bottomMargin=14*mm,
                            title=f"Test till statement - {s['business']}", author="BiasharaScore test generator")
    el = [Paragraph("MOBILE MONEY MERCHANT STATEMENT (TEST FORMAT)", hdr), Spacer(1, 3*mm)]
    info = [["Organisation Name:", s["name"], "Statement Period:", f"{START:%d %b %Y} - {END:%d %b %Y}"],
            ["Shortcode:", s["shortcode"], "Request Date:", "17 Nov 2026"],
            ["Business (test label):", s["business"], "", ""]]
    t = Table(info, colWidths=[32*mm, 60*mm, 30*mm, 64*mm])
    t.setStyle(TableStyle([("FONTSIZE", (0,0), (-1,-1), 8.5), ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
                           ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"), ("BOTTOMPADDING", (0,0), (-1,-1), 2)]))
    el += [t, Spacer(1, 5*mm), Paragraph("<b>ACCOUNT TYPE - MERCHANT ACCOUNT</b>", norm), Spacer(1, 1*mm)]
    head = ["Receipt No.", "Completion Time", "Details", "Transaction Status", "Paid In", "Withdrawn", "Balance",
            "Transaction Type", "Other Party"]
    data = [[Paragraph(h, hs) for h in head]]
    for r in reversed(s["till_rows"]):
        data.append([r[1], Paragraph(r[0].strftime("%Y-%m-%d<br/>%H:%M:%S"), small), Paragraph(r[2], small), r[3],
                     fmt(r[4]) if r[4] else "", "-" + fmt(r[5]) if r[5] else "", fmt(r[6]),
                     Paragraph(r[7], small), Paragraph(r[8], small)])
    t = Table(data, colWidths=[19*mm, 19*mm, 40*mm, 19*mm, 15*mm, 16*mm, 15*mm, 21*mm, 22*mm], repeatRows=1)
    t.setStyle(TableStyle([("FONTSIZE", (0,0), (-1,-1), 6.5), ("GRID", (0,0), (-1,-1), 0.3, colors.grey),
                           ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#E8E8E8")),
                           ("ALIGN", (4,1), (6,-1), "RIGHT"), ("VALIGN", (0,0), (-1,-1), "MIDDLE")]))
    el += [t]
    doc.build(el, onFirstPage=banner, onLaterPages=banner)

def till_truth(s):
    rows = s["till_rows"]
    days = (END - START).days + 1
    rev = [r for r in rows if r[9] == "till_revenue"]
    total = sum(r[4] for r in rev)
    counts = defaultdict(int)
    for r in rev: counts[r[10]] += 1
    uniq = len(counts)
    return {
        "till_transactions": len(rows),
        "till_revenue_total": round(total, 2),
        "avg_monthly_till_revenue": round(total / days * 30.4, 0),
        "till_payments": len(rev),
        "unique_customers": uniq,
        "repeat_customer_share": round(sum(1 for c in counts.values() if c >= 2) / uniq, 3) if uniq else 0,
        "avg_ticket": round(total / len(rev), 0) if rev else 0,
        "till_sweeps_total": round(sum(r[5] for r in rows if r[9] == "till_sweep"), 2),
        "till_closing_balance": round(s["till_closing"], 2),
    }

def encrypt(src, dst, pw):
    w = PdfWriter(clone_from=PdfReader(src))
    w.encrypt(user_password=pw, owner_password=None, algorithm="AES-128")
    with open(dst, "wb") as f: w.write(f)

def ground_truth(s):
    by = defaultdict(lambda: [0.0, 0.0])
    for r in s["rows"]:
        m = r[0].strftime("%Y-%m")
        if r[7] == "revenue": by[m][0] += r[4]
        if r[7] in ("supplier_paybill", "supplier_merchant", "rent", "utilities", "wages", "charge_send", "charge_withdraw", "airtime"): by[m][1] += r[5]
    days = (END - START).days + 1
    rev = sum(r[4] for r in s["rows"] if r[7] == "revenue")
    exp = sum(r[5] for r in s["rows"] if r[7] in ("supplier_paybill", "supplier_merchant", "rent", "utilities", "wages", "charge_send", "charge_withdraw", "airtime"))
    return {
        "expected_band": s["band"], "name": s["name"], "phone": s["phone"], "business": s["business"], "county": s["county"],
        "period": [START.strftime("%Y-%m-%d"), END.strftime("%Y-%m-%d")], "days": days,
        "transactions": len(s["rows"]), "opening_balance": s["opening"], "closing_balance": s["closing"],
        "total_paid_in": round(sum(r[4] for r in s["rows"]), 2), "total_withdrawn": round(sum(r[5] for r in s["rows"]), 2),
        "business_inflows_total": round(rev, 2), "avg_monthly_business_inflows": round(rev / days * 30.4, 0),
        "business_expenses_total": round(exp, 2), "avg_monthly_business_expenses": round(exp / days * 30.4, 0),
        "overdraft_draws": s["od_count"],
        "overdraft_drawn_total": round(sum(r[4] for r in s["rows"] if r[7] == "overdraft_in"), 2),
        "agent_withdrawals_total": round(sum(r[5] for r in s["rows"] if r[7] == "withdrawal"), 2),
        "cash_deposits_total": round(sum(r[4] for r in s["rows"] if r[7] == "cash_deposit"), 2),
        "unit_trust_withdrawals_total": round(sum(r[4] for r in s["rows"] if r[7] == "mmf_withdraw"), 2),
        "notes": "Business inflows = funds received + business payments (excludes overdraft, agent cash deposits and unit-trust withdrawals). "
                 "Expenses = pay bill/merchant/rent/utilities/wages/airtime/charges (excludes overdraft repayments and agent withdrawals).",
    }

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    truth = []
    for i, o in enumerate(OWNERS, 1):
        s = simulate(o, seed=1000 + i)
        slug = f"{i:02d}_{o[3].lower().replace(' ', '_')}"
        g = ground_truth(s)
        tp = f"/tmp/{slug}_till_statement.pdf"
        build_till_pdf(s, tp)
        out = f"{OUT}/{slug}_till_statement.pdf"
        if PASSWORD: encrypt(tp, out, PASSWORD)
        else: os.replace(tp, out)
        t = till_truth(s)
        b = 0.0
        for r in s["till_rows"]:
            b = round(b + r[4] - r[5], 2); assert abs(b - r[6]) < 0.01 and b >= -0.01, (slug, r)
        days = g["days"]
        truth.append({
            "file": os.path.basename(out), "expected_band": s["band"], "organisation_name": s["name"],
            "business": s["business"], "county": s["county"], "shortcode": s["shortcode"],
            "period": g["period"], "days": days, **t,
            "suggested_monthly_expenses": g["avg_monthly_business_expenses"],
            "all_customer_revenue_monthly": round(t["avg_monthly_till_revenue"] + g["avg_monthly_business_inflows"], 0),
            "notes": "Till revenue = Merchant Payment (Online) from rows. Sweeps are excluded. "
                     "suggested_monthly_expenses is what the owner would self-report as expenses (the till statement has no costs). "
                     "all_customer_revenue_monthly includes customers who paid outside the till (not visible on this statement).",
        })
    with open(f"{OUT}/ground_truth.json", "w") as f: json.dump(truth, f, indent=2)
    for t in truth:
        print(f"{t['file']:<46} {t['expected_band']:<9} tx={t['till_transactions']:<4} till/mo={t['avg_monthly_till_revenue']:>9,.0f} "
              f"cust={t['unique_customers']:<4} repeat={t['repeat_customer_share']:<6} ticket={t['avg_ticket']:>6,.0f} exp/mo={t['suggested_monthly_expenses']:>9,.0f}")
