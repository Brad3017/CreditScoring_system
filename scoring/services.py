"""
Scoring service for the model described in ml_artifacts/model_metadata.json (xgb_msme_v3).

Everything model-specific (feature order, encodings, labels, score formula, risk bands,
loan limit policy, version) is read from the metadata, which the training notebook exports
next to the model. Nothing about the model is hard-coded here except the training ranges,
which the metadata does not carry (see TRAINING_RANGES).

Collateral is NOT a model input since v3. It is still a required answer, because the
recommended loan limit depends on it (metadata["limit_policy"]).
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

LIMIT_POLICY = METADATA.get("limit_policy") or {}
COLLATERAL_LEVELS = list(LIMIT_POLICY.get("collateral_levels", []))
# Answers the system uses outside the model: collateral sets the loan limit only.
LIMIT_INPUTS = ("collateral_level",) if COLLATERAL_LEVELS else ()


def _band_limits(bands):
    low_max = next((b["pd_max_inclusive"] for b in bands if "pd_max_inclusive" in b), None)
    high_min = next((b["pd_min_inclusive"] for b in bands if "pd_min_inclusive" in b), None)
    return low_max, high_min


LOW_RISK_MAX_PD, HIGH_RISK_MIN_PD = _band_limits(METADATA.get("risk_bands", []))


def _score_bands(bands):
    """[(label, low, high)] from the metadata's "score_range" strings, e.g. "700-850"."""
    out = []
    for b in bands:
        try:
            low, high = (int(x) for x in str(b.get("score_range", "")).split("-"))
        except ValueError:
            continue
        out.append((b["label"], low, high))
    return out


SCORE_BANDS = _score_bands(METADATA.get("risk_bands", []))


def label_matches_score(risk_category, credit_score):
    """True when a stored label belongs to the band of its score.

    A score is round(850 - 550 * pd) while the label comes from pd itself, so right at a band
    edge the rounding can move the score one point across (pd 0.2730 is Moderate Risk but scores
    700). One point either side is therefore accepted. Without score bands nothing is flagged."""
    if not SCORE_BANDS or credit_score is None:
        return True
    nearby = {
        label
        for s in (credit_score - 1, credit_score, credit_score + 1)
        for label, low, high in SCORE_BANDS
        if low <= s <= high
    }
    return risk_category in nearby


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
    # Not a model input since v3, but still required: the loan limit policy uses it.
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
    # For the loan limit only; never placed in the model row below.
    if not COLLATERAL_LEVELS:
        raise RuntimeError("Model metadata has no limit_policy.collateral_levels. Check ml_artifacts/.")
    plain["collateral_level"] = _category(data, "collateral_level", COLLATERAL_LEVELS)

    # repayment_confidence is not read at all: it left the model in v3.
    for field in (
        "business_age_years", "employees_count", "monthly_revenue_kes", "monthly_profit_kes",
        "loan_amount_kes", "tenure_months", "prior_loan_count", "cashflow_stability",
        "days_payable_outstanding",
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
# Loan limit: metadata["limit_policy"]. Every number here comes from the metadata.
#   affordable  = max_repayment_share_of_profit x monthly profit x tenure months
#   share       = share_of_affordable_by_band[risk category][collateral level]
#   recommended = min(requested, affordable x share), rounded DOWN to round_down_to
# The monthly repayment is a flat estimate (amount / months) with NO interest.
# ---------------------------------------------------------------------------
def _policy():
    needed = ("max_repayment_share_of_profit", "share_of_affordable_by_band", "round_down_to")
    if any(k not in LIMIT_POLICY for k in needed):
        raise RuntimeError("Model metadata has no complete limit_policy. Check ml_artifacts/.")
    return LIMIT_POLICY


def _share(risk_category, collateral_level):
    shares = _policy()["share_of_affordable_by_band"]
    try:
        return float(shares[risk_category][collateral_level])
    except KeyError:
        raise ValueError(f"No loan limit share for {risk_category} with {collateral_level} collateral.") from None


def _months(n):
    n = float(n)
    text = f"{n:g}"
    return f"{text} month" if n == 1 else f"{text} months"


def limit_explanation(risk_category, collateral_level, tenure_months):
    """One plain sentence describing how the policy set the limit, e.g.
    "Moderate risk with high collateral: up to 100% of what your profit can repay over 12 months."
    Collateral is only mentioned when it changes the share within that risk band."""
    band = risk_category[:1].upper() + risk_category[1:].lower()
    share = _share(risk_category, collateral_level)
    if share <= 0:
        return f"{band}: no loan limit is recommended."
    band_shares = {float(v) for v in _policy()["share_of_affordable_by_band"][risk_category].values()}
    lead = band if len(band_shares) == 1 else f"{band} with {collateral_level.lower()} collateral"
    return f"{lead}: up to {share * 100:g}% of what your profit can repay over {_months(tenure_months)}."


def affordability(loan_amount, monthly_profit_kes, tenure_months, risk_category, collateral_level):
    policy = _policy()
    loan_amount = float(loan_amount)
    monthly_profit_kes = float(monthly_profit_kes)
    tenure_months = float(tenure_months)
    round_to = float(policy["round_down_to"])

    monthly_repayment_estimate = round(loan_amount / tenure_months, 2)
    affordable_limit = max(0.0, float(policy["max_repayment_share_of_profit"]) * monthly_profit_kes * tenure_months)

    limit = affordable_limit * _share(risk_category, collateral_level)
    if policy.get("never_exceed_requested", True):
        limit = min(loan_amount, limit)
    # Round to cents first so float noise (e.g. 455999.9999999) cannot drop a whole step.
    limit = max(0.0, math.floor(round(limit, 2) / round_to) * round_to)

    return {
        "requested_amount": round(loan_amount, 2),
        "monthly_repayment_estimate": monthly_repayment_estimate,
        "affordable_limit": round(affordable_limit, 2),
        "recommended_limit": float(limit),
        "limit_explanation": limit_explanation(risk_category, collateral_level, tenure_months),
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
        **affordability(
            plain["loan_amount_kes"], plain["monthly_profit_kes"], plain["tenure_months"],
            risk_category, plain["collateral_level"],
        ),
    }


def request_to_dict(credit_req) -> dict:
    """The answers on a CreditRequest that scoring needs. County is left out on purpose.
    repayment_confidence stays on the model for history but is no longer read."""
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
        "owner_education": credit_req.owner_education,
        "days_payable_outstanding": credit_req.days_payable_outstanding,
    }


def evaluate_credit_request(credit_req) -> dict:
    """Thin wrapper kept so existing views keep working."""
    return score(request_to_dict(credit_req))
