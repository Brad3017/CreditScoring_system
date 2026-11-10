"""
Scoring service for the xgb_msme_v2 model.

Everything model-specific (feature order, encodings, labels, score formula, risk bands,
version) is read from ml_artifacts/model_metadata.json, which the training notebook
exports next to the model. Nothing about the model is hard-coded here except the
training ranges, which the metadata does not carry (see TRAINING_RANGES).
"""
import json
import logging
import math

import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from django.conf import settings

logger = logging.getLogger(__name__)

MODEL_PATH = settings.ML_ARTIFACTS_DIR / "msme_xgboost_credit_model.json"
METADATA_PATH = settings.ML_ARTIFACTS_DIR / "model_metadata.json"


# ---------------------------------------------------------------------------
# Load once, at import time
# ---------------------------------------------------------------------------
METADATA = {}
xgb_model = None
tree_explainer = None

try:
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        METADATA = json.load(f)
    xgb_model = xgb.XGBClassifier()
    xgb_model.load_model(str(MODEL_PATH))
    tree_explainer = shap.TreeExplainer(xgb_model)
    logger.info("Loaded %s and its SHAP explainer.", METADATA.get("model_version"))
except (OSError, ValueError, xgb.core.XGBoostError) as exc:
    # Django must still start (migrations, admin) without the model; scoring will refuse.
    xgb_model = None
    tree_explainer = None
    logger.error("Credit model not loaded from %s: %s", settings.ML_ARTIFACTS_DIR, exc)

FEATURES = METADATA.get("features", [])
FEATURE_LABELS = METADATA.get("feature_labels", {})
NOMINAL_CATEGORIES = METADATA.get("nominal_categories", {})
ORDINAL_MAPPINGS = METADATA.get("ordinal_mappings", {})
MODEL_VERSION = METADATA.get("model_version")

_score_cfg = METADATA.get("score", {})
SCORE_MIN = _score_cfg.get("min", 300)
SCORE_MAX = _score_cfg.get("max", 850)
SCORE_SPAN = _score_cfg.get("span", 550)


def _band_limits(bands):
    low_max = next((b["pd_max_inclusive"] for b in bands if "pd_max_inclusive" in b), None)
    high_min = next((b["pd_min_inclusive"] for b in bands if "pd_min_inclusive" in b), None)
    return low_max, high_min


LOW_RISK_MAX_PD, HIGH_RISK_MIN_PD = _band_limits(METADATA.get("risk_bands", []))


def risk_band_rules():
    """Human-readable band rules for the admin Model page, built from the metadata."""
    if LOW_RISK_MAX_PD is None or HIGH_RISK_MIN_PD is None:
        return []
    return [
        {"label": "Low Risk", "rule": f"probability of default at or below {LOW_RISK_MAX_PD} (score 700-850)"},
        {"label": "Moderate Risk", "rule": f"above {LOW_RISK_MAX_PD} and below {HIGH_RISK_MIN_PD} (score 500-699)"},
        {"label": "High Risk", "rule": f"{HIGH_RISK_MIN_PD} and above (score 300-499)"},
    ]


# Training ranges from section B1 of notebooks/credit_scoring_modelpipeline.ipynb.
# Used only to warn; the score is never changed because of them.
TRAINING_RANGES = {
    "monthly_revenue_kes": (38_300, 3_772_000),
    "profit_margin": (0.12, 0.38),
    "loan_amount_kes": (25_000, 9_000_000),
    "loan_to_revenue": (0.50, 2.49),
    "tenure_months": (6, 36),
    "business_age_years": (1, 19),
    "employees_count": (2, 49),
    "prior_loan_count": (0, 3),
    "days_payable_outstanding": (7, 90),
}

_RANGE_FORMAT = {
    "monthly_revenue_kes": lambda v: f"KES {v:,.0f}",
    "loan_amount_kes": lambda v: f"KES {v:,.0f}",
    "profit_margin": lambda v: f"{v * 100:.0f}%",
    "loan_to_revenue": lambda v: f"{v:.2f} times monthly revenue",
    "tenure_months": lambda v: f"{v:g} months",
    "business_age_years": lambda v: f"{v:g} years",
    "days_payable_outstanding": lambda v: f"{v:g} days",
}


# ---------------------------------------------------------------------------
# Normalising form strings to the exact metadata categories
# ---------------------------------------------------------------------------
# Checked in order, against the lower-cased input, only when there is no exact match.
# There is deliberately no entry that produces "Often": the v2 model has no such category.
_ALIASES = {
    "legal_status": [("limit", "Limited"), ("ltd", "Limited"), ("partner", "Partnership"), ("sole", "Sole")],
    "owner_education": [
        ("master", "Master's"), ("post", "Master's"), ("phd", "Master's"),
        ("bachelor", "Bachelor's"), ("degree", "Bachelor's"), ("university", "Bachelor's"),
        ("higher", "Higher Secondary"), ("diploma", "Higher Secondary"),
        ("college", "Higher Secondary"), ("tertiary", "Higher Secondary"),
        ("secondary", "Secondary"), ("high school", "Secondary"),
        ("primary", "Primary"),
    ],
    "collateral_level": [("high", "High"), ("mod", "Moderate"), ("med", "Moderate"), ("low", "Low")],
    "late_payment_history": [
        ("never", "Never"), ("rare", "Rarely"), ("once", "Rarely"),
        ("sometimes", "Sometimes"), ("occas", "Sometimes"),
    ],
    "loan_purpose": [
        ("working", "Working capital"), ("equip", "Equipment"), ("expan", "Expansion"),
        ("invent", "Inventory"), ("stock", "Inventory"), ("renov", "Renovation"),
    ],
}


def _label(field):
    return FEATURE_LABELS.get(field, field.replace("_", " ").capitalize())


def _category(data, field, allowed):
    raw = data.get(field)
    if raw is None or str(raw).strip() == "":
        raise ValueError(f"{_label(field)} is missing.")
    text = str(raw).strip()
    lowered = text.lower()

    if field == "late_payment_history" and ("often" in lowered or "freq" in lowered):
        raise ValueError(
            f"Late payment history '{text}' is not supported. Use one of: {', '.join(allowed)}."
        )
    for value in allowed:
        if lowered == value.lower():
            return value
    for keyword, value in _ALIASES.get(field, []):
        if keyword in lowered and value in allowed:
            return value
    raise ValueError(f"{_label(field)} '{text}' is not recognised. Use one of: {', '.join(allowed)}.")


def _yes_no(data, field):
    raw = data.get(field)
    if isinstance(raw, bool):
        return "Yes" if raw else "No"
    if raw is not None:
        text = str(raw).strip().lower()
        if text in ("yes", "y", "true", "1"):
            return "Yes"
        if text in ("no", "n", "false", "0"):
            return "No"
    raise ValueError(f"{_label(field)} must be Yes or No.")


def _number(data, field):
    raw = data.get(field)
    if raw is None or (isinstance(raw, str) and raw.strip() == ""):
        raise ValueError(f"{_label(field)} is missing.")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ValueError(f"{_label(field)} must be a number, not '{raw}'.") from None
    if not math.isfinite(value):
        raise ValueError(f"{_label(field)} must be a finite number.")
    return value


def _prepare(data):
    """Returns (one-row DataFrame in model order, dict of the plain values used)."""
    if not FEATURES:
        raise RuntimeError("Model metadata is not loaded. Check ml_artifacts/.")

    data = dict(data)
    if "loan_amount_kes" not in data and "loan_amount" in data:
        data["loan_amount_kes"] = data["loan_amount"]

    plain = {}
    for field, cats in NOMINAL_CATEGORIES.items():
        plain[field] = _category(data, field, cats)
    for field, mapping in ORDINAL_MAPPINGS.items():
        if field == "existing_loans":
            plain[field] = _yes_no(data, field)
        else:
            plain[field] = _category(data, field, list(mapping))

    for field in (
        "business_age_years", "employees_count", "monthly_revenue_kes", "monthly_profit_kes",
        "loan_amount_kes", "tenure_months", "prior_loan_count", "cashflow_stability",
        "repayment_confidence", "days_payable_outstanding",
    ):
        plain[field] = _number(data, field)

    if plain["monthly_revenue_kes"] <= 0:
        raise ValueError("Monthly revenue must be greater than 0.")
    if plain["tenure_months"] <= 0:
        raise ValueError("Repayment period must be greater than 0 months.")

    plain["profit_margin"] = plain["monthly_profit_kes"] / plain["monthly_revenue_kes"]
    plain["loan_to_revenue"] = plain["loan_amount_kes"] / plain["monthly_revenue_kes"]

    row = {}
    for field in FEATURES:
        if field in NOMINAL_CATEGORIES:
            row[field] = float(NOMINAL_CATEGORIES[field].index(plain[field]))
        elif field in ORDINAL_MAPPINGS:
            row[field] = float(ORDINAL_MAPPINGS[field][plain[field]])
        elif field in plain:
            row[field] = float(plain[field])
        else:
            raise ValueError(f"The model needs '{field}', which this service does not know how to build.")

    return pd.DataFrame([row], columns=FEATURES, dtype=float), plain


def prepare_features(data: dict) -> pd.DataFrame:
    """One row, columns in metadata["features"] order, all floats. Raises ValueError on bad input."""
    return _prepare(data)[0]


def risk_category_for(pd_value: float) -> str:
    if pd_value <= LOW_RISK_MAX_PD:
        return "Low Risk"
    if pd_value >= HIGH_RISK_MIN_PD:
        return "High Risk"
    return "Moderate Risk"


def _out_of_range(plain):
    notes = []
    for field, (lo, hi) in TRAINING_RANGES.items():
        v = plain[field]
        if lo <= v <= hi:
            continue
        fmt = _RANGE_FORMAT.get(field, lambda x: f"{x:g}")
        side = "below" if v < lo else "above"
        notes.append(
            f"{_label(field)} of {fmt(v)} is {side} the range the model was trained on "
            f"({fmt(lo)} to {fmt(hi)})."
        )
    return notes


# ---------------------------------------------------------------------------
# BUSINESS RULE: affordability and recommended limit. Adjust the constants here.
#   - Repayments may take at most 40% of monthly profit.
#   - Low Risk: lend up to the affordable amount.
#   - Moderate Risk: lend up to half of it.
#   - High Risk: no recommended limit.
#   - Never more than the applicant asked for; rounded down to the nearest KES 1,000.
#   - The monthly repayment is a flat estimate (amount / months) with NO interest.
# ---------------------------------------------------------------------------
REPAYMENT_SHARE_OF_PROFIT = 0.40
MODERATE_RISK_SHARE = 0.5
LIMIT_ROUND_TO = 1000


def affordability(loan_amount, monthly_profit_kes, tenure_months, risk_category):
    loan_amount = float(loan_amount)
    monthly_profit_kes = float(monthly_profit_kes)
    tenure_months = float(tenure_months)

    monthly_repayment_estimate = round(loan_amount / tenure_months, 2)
    affordable_limit = max(0.0, REPAYMENT_SHARE_OF_PROFIT * monthly_profit_kes * tenure_months)

    if risk_category == "Low Risk":
        limit = min(loan_amount, affordable_limit)
    elif risk_category == "Moderate Risk":
        limit = min(loan_amount, MODERATE_RISK_SHARE * affordable_limit)
    else:
        limit = 0.0
    limit = max(0.0, math.floor(limit / LIMIT_ROUND_TO) * LIMIT_ROUND_TO)

    return {
        "requested_amount": round(loan_amount, 2),
        "monthly_repayment_estimate": monthly_repayment_estimate,
        "affordable_limit": round(affordable_limit, 2),
        "recommended_limit": float(limit),
    }
# ---------------------------------------------------------------------------


def score(data: dict) -> dict:
    if xgb_model is None or tree_explainer is None:
        raise RuntimeError("The credit model is not loaded. Check ml_artifacts/.")

    X, plain = _prepare(data)
    pd_value = float(xgb_model.predict_proba(X)[0, 1])
    credit_score = int(np.clip(np.round(SCORE_MAX - SCORE_SPAN * pd_value), SCORE_MIN, SCORE_MAX))
    risk_category = risk_category_for(pd_value)

    contributions = tree_explainer(X).values[0]
    shap_values = sorted(
        (
            {
                "feature": f,
                "label": _label(f),
                "value": round(float(v), 4),
                "direction": "raises_risk" if v > 0 else "lowers_risk",
            }
            for f, v in zip(FEATURES, contributions)
        ),
        key=lambda item: abs(item["value"]),
        reverse=True,
    )
    shap_explanation = [
        f"{item['label']} {'raised' if item['direction'] == 'raises_risk' else 'lowered'} the assessed risk."
        for item in shap_values[:3]
    ]

    return {
        "probability_of_default": round(pd_value, 4),
        "credit_score": credit_score,
        "risk_category": risk_category,
        "shap_values": shap_values,
        "shap_explanation": shap_explanation,
        "model_version": MODEL_VERSION,
        "out_of_range": _out_of_range(plain),
        **affordability(plain["loan_amount_kes"], plain["monthly_profit_kes"], plain["tenure_months"], risk_category),
    }


def request_to_dict(credit_req) -> dict:
    """The model inputs held on a CreditRequest. County is left out on purpose."""
    return {
        "sector": credit_req.sector,
        "legal_status": credit_req.legal_status,
        "location_type": credit_req.location_type,
        "loan_purpose": credit_req.loan_purpose,
        "business_age_years": credit_req.business_age_years,
        "employees_count": credit_req.employees_count,
        "monthly_revenue_kes": credit_req.monthly_revenue_kes,
        "monthly_profit_kes": credit_req.monthly_profit_kes,
        "loan_amount_kes": credit_req.loan_amount,
        "tenure_months": credit_req.tenure_months,
        "existing_loans": bool(credit_req.existing_loans),
        "prior_loan_count": credit_req.prior_loan_count,
        "late_payment_history": credit_req.late_payment_history,
        "collateral_level": credit_req.collateral_level,
        "cashflow_stability": credit_req.cashflow_stability,
        "repayment_confidence": credit_req.repayment_confidence,
        "owner_education": credit_req.owner_education,
        "days_payable_outstanding": credit_req.days_payable_outstanding,
    }


def evaluate_credit_request(credit_req) -> dict:
    """Thin wrapper kept so existing views keep working."""
    return score(request_to_dict(credit_req))
