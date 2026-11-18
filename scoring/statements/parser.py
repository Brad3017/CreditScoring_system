"""Reads a Lipa na M-Pesa till (merchant) statement PDF into rows.

parse_till_pdf(fileobj, password=None, max_pages=None) -> ParsedTillStatement, or raises StatementError(code):
    password_required                 encrypted and no password given
    wrong_password                    encrypted and the password did not open it
    unreadable                        not a PDF, damaged, or no transaction rows could be read
    personal_statement_not_supported  a personal M-Pesa statement (Customer Name / Mobile Number)
    unknown_format                    a PDF, but not a till statement this parser knows
    too_many_pages                    more than max_pages pages (checked before any text is read)

The file is read from the file object only; nothing is written to disk and the password is not kept.
Rows come back oldest first, completed rows only (the others are counted in skipped_rows).
"""
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import pdfplumber
from pdfminer.pdfdocument import PDFPasswordIncorrect
from pdfplumber.utils.exceptions import PdfminerException


class StatementError(Exception):
    """A statement that cannot be used. `code` is stable and is what the API returns."""

    def __init__(self, code, detail=""):
        super().__init__(detail or code)
        self.code = code


@dataclass
class TillRow:
    receipt: str
    completed_at: datetime
    details: str
    status: str
    paid_in: Decimal       # always >= 0
    withdrawn: Decimal     # always >= 0 (the statement prints it negative)
    balance: Decimal
    transaction_type: str = ""
    other_party: str = ""


@dataclass
class ParsedTillStatement:
    organisation_name: str
    shortcode: str
    period_start: date
    period_end: date
    request_date: date | None
    rows: list = field(default_factory=list)   # TillRow, oldest first, status "Completed" only
    skipped_rows: int = 0                      # transaction rows with any other status
    page_count: int = 0

    @property
    def days(self):
        return (self.period_end - self.period_start).days + 1


# ---------------------------------------------------------------------------
# Table columns, matched on the normalised header text (lowercase, newlines -> spaces, no trailing dot)
# ---------------------------------------------------------------------------
COLUMNS = {
    "receipt": ("receipt no", "receipt"),
    "completed_at": ("completion time",),
    "details": ("details",),
    "status": ("transaction status", "status"),
    "paid_in": ("paid in",),
    "withdrawn": ("withdrawn", "withdraw"),
    "balance": ("balance",),
    "transaction_type": ("transaction type",),
    "other_party": ("other party",),
}
_HEADER_LOOKUP = {alias: key for key, aliases in COLUMNS.items() for alias in aliases}
REQUIRED_COLUMNS = ("receipt", "completed_at", "details", "status", "paid_in", "withdrawn", "balance")

RECEIPT_RE = re.compile(r"^[A-Z0-9]{10}$")
TIME_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M:%S")

# ---------------------------------------------------------------------------
# Header fields on page 1
# ---------------------------------------------------------------------------
_DATE = r"\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}"
_NEXT_LABEL = r"(?=\s+(?:Shortcode|Statement Period|Request Date|Business|Opening Balance)\b|\s*$)"
ORG_RE = re.compile(r"Organisation Name\s*:?\s*(.+?)" + _NEXT_LABEL, re.IGNORECASE | re.MULTILINE)
SHORTCODE_RE = re.compile(r"Shortcode\s*:?\s*(\d{4,10})\b", re.IGNORECASE)
PERIOD_RE = re.compile(rf"Statement Period\s*:?\s*({_DATE})\s*[-–]\s*({_DATE})", re.IGNORECASE)
REQUEST_DATE_RE = re.compile(rf"Request Date\s*:?\s*({_DATE})", re.IGNORECASE)


def _clean(cell):
    """Cell text on one line: newlines become spaces, repeated spaces collapse."""
    return " ".join(str(cell or "").split())


def _header_key(cell):
    return _HEADER_LOOKUP.get(_clean(cell).lower().rstrip(".:").strip())


def _amount(cell):
    """'1,340.00' -> 1340.00; '-3,770.00' -> 3770.00 (withdrawn is printed negative); '' -> 0."""
    text = _clean(cell).replace(",", "").replace(" ", "")
    if text in ("", "-", "--"):
        return Decimal("0")
    try:
        return abs(Decimal(text))
    except InvalidOperation:
        raise ValueError(f"not an amount: {cell!r}") from None


def _balance(cell):
    """Balance keeps its sign (a till can, in principle, show a negative balance)."""
    text = _clean(cell).replace(",", "").replace(" ", "")
    try:
        return Decimal(text or "0")
    except InvalidOperation:
        raise ValueError(f"not a balance: {cell!r}") from None


def _timestamp(cell):
    # The time wraps under the date ("2026-11-16\n19:13:40"); _clean joins it with a space.
    text = _clean(cell)
    for fmt in TIME_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise ValueError(f"not a completion time: {cell!r}")


def _date(text):
    text = " ".join(text.replace(".", "").split())
    for fmt in ("%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    # "Sept" is the one month some systems abbreviate to four letters.
    return datetime.strptime(text.replace("Sept", "Sep"), "%d %b %Y").date()


def _open(fileobj, password):
    try:
        return pdfplumber.open(fileobj, password=password or "")
    except PdfminerException as exc:
        inner = exc.args[0] if exc.args else None
        if isinstance(inner, PDFPasswordIncorrect):
            raise StatementError("wrong_password" if password else "password_required") from None
        raise StatementError("unreadable") from None
    except Exception:  # anything pdfminer cannot make sense of
        raise StatementError("unreadable") from None


def _check_type(text):
    low = text.lower()
    if "organisation name" in low and ("shortcode" in low or "merchant account" in low):
        return
    if "customer name" in low and "mobile number" in low:
        raise StatementError("personal_statement_not_supported")
    raise StatementError("unknown_format")


def _header(text):
    org = ORG_RE.search(text)
    shortcode = SHORTCODE_RE.search(text)
    period = PERIOD_RE.search(text)
    if not (org and shortcode and period):
        raise StatementError("unknown_format", "Organisation Name, Shortcode or Statement Period not found.")
    try:
        start, end = _date(period.group(1)), _date(period.group(2))
        request = REQUEST_DATE_RE.search(text)
        request_date = _date(request.group(1)) if request else None
    except ValueError:
        raise StatementError("unknown_format", "Statement dates could not be read.") from None
    if end < start:
        raise StatementError("unknown_format", "Statement Period ends before it starts.")
    return {
        "organisation_name": " ".join(org.group(1).split()),
        "shortcode": shortcode.group(1),
        "period_start": start,
        "period_end": end,
        "request_date": request_date,
    }


def _column_map(row):
    """{column key: index} when this table row is the header row, else None."""
    found = {}
    for i, cell in enumerate(row):
        key = _header_key(cell)
        if key and key not in found:
            found[key] = i
    return found if all(k in found for k in REQUIRED_COLUMNS) else None


def _rows(pdf):
    """(completed rows in document order, skipped count). The header is looked up on every table, because
    it repeats on each page; a table without one reuses the last header seen."""
    columns = None
    rows, skipped = [], 0
    for page in pdf.pages:
        for table in page.extract_tables():
            for raw in table:
                header = _column_map(raw)
                if header:
                    columns = header
                    continue
                if columns is None or len(raw) <= max(columns.values()):
                    continue
                cell = lambda key: raw[columns[key]] if key in columns else ""  # noqa: E731
                receipt = _clean(cell("receipt"))
                if not RECEIPT_RE.match(receipt):
                    continue
                if _clean(cell("status")).lower() != "completed":
                    skipped += 1
                    continue
                try:
                    rows.append(TillRow(
                        receipt=receipt,
                        completed_at=_timestamp(cell("completed_at")),
                        details=_clean(cell("details")),
                        status=_clean(cell("status")),
                        paid_in=_amount(cell("paid_in")),
                        withdrawn=_amount(cell("withdrawn")),
                        balance=_balance(cell("balance")),
                        transaction_type=_clean(cell("transaction_type")),
                        other_party=_clean(cell("other_party")),
                    ))
                except ValueError:
                    raise StatementError("unreadable", f"Row {receipt} could not be read.") from None
        page.flush_cache()  # keeps memory flat on long statements
    return rows, skipped


def parse_till_pdf(fileobj, password=None, max_pages=None) -> ParsedTillStatement:
    pdf = _open(fileobj, password)
    try:
        if not pdf.pages:
            raise StatementError("unreadable")
        if max_pages is not None and len(pdf.pages) > max_pages:
            raise StatementError("too_many_pages")
        first_text = pdf.pages[0].extract_text() or ""
        _check_type(first_text)
        header = _header(first_text)
        rows, skipped = _rows(pdf)
        if not rows and not skipped:
            raise StatementError("unreadable", "No transaction rows were found.")
        # Statements list the newest transaction first. Reverse (not sort) so rows that share a second
        # keep their relative order; then the balance of each row follows from the one before it.
        if rows and rows[0].completed_at > rows[-1].completed_at:
            rows.reverse()
        return ParsedTillStatement(**header, rows=rows, skipped_rows=skipped, page_count=len(pdf.pages))
    except StatementError:
        raise
    except Exception:
        raise StatementError("unreadable") from None
    finally:
        pdf.close()

