"""Lipa na M-Pesa till (merchant) statements: parse, categorise, summarise and check.

    parsed  = parse_till_pdf(fileobj, password)        # parser.py, raises StatementError(code)
    summary = summarise(parsed)                        # summarise.py
    results = run_checks(parsed, summary, ...)         # checks.py

Only till statements are supported; personal M-Pesa statements are refused by the parser.
Nothing here writes the file to disk or keeps the password.
"""
from .categorise import categorise, customer_name
from .checks import run_checks, has_failures
from .parser import ParsedTillStatement, StatementError, TillRow, parse_till_pdf
from .summarise import summarise, profit_from

__all__ = [
    "ParsedTillStatement", "StatementError", "TillRow", "parse_till_pdf",
    "categorise", "customer_name", "summarise", "profit_from", "run_checks", "has_failures",
]
