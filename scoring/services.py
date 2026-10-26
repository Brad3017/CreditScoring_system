import os
import json
import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from django.conf import settings

# 1. Resolve paths to the artifacts
BASE_DIR = settings.BASE_DIR
MODEL_PATH = os.path.join(BASE_DIR, "ml_artifacts", "msme_xgboost_credit_model.json")
METADATA_PATH = os.path.join(BASE_DIR, "ml_artifacts", "model_metadata.json")

# 2. Load model metadata
if os.path.exists(METADATA_PATH):
    with open(METADATA_PATH, "r") as f:
        METADATA = json.load(f)
else:
    METADATA = {}

# 3. Load XGBoost Model and SHAP TreeExplainer once into memory
xgb_model = None
tree_explainer = None

if os.path.exists(MODEL_PATH):
    xgb_model = xgb.XGBClassifier()
    xgb_model.load_model(MODEL_PATH)
    tree_explainer = shap.TreeExplainer(xgb_model)
    print("XGBoost Credit Model & SHAP Explainer loaded successfully into Django memory. ✅")
else:
    print(f"Warning: Model file not found at {MODEL_PATH}")


def normalize_input_values(credit_req):
    """
    Normalizes descriptive UI dropdown strings to the exact category/ordinal
    strings used in the training notebook (Cell 23).
    """
    # Normalize legal_status -> ['Limited', 'Partnership', 'Sole']
    legal_raw = str(credit_req.legal_status).strip()
    if "Limit" in legal_raw:
        legal_status = "Limited"
    elif "Partner" in legal_raw:
        legal_status = "Partnership"
    else:
        legal_status = "Sole"

    # Normalize location_type -> ['Rural', 'Urban']
    loc_raw = str(credit_req.location_type).strip()
    location_type = "Rural" if "Rural" in loc_raw else "Urban"

    # Normalize owner_education -> ['Primary', 'Secondary', 'Higher Secondary', "Bachelor's", "Master's"]
    edu_raw = str(credit_req.owner_education).strip()
    if "Master" in edu_raw or "Post" in edu_raw or "PhD" in edu_raw:
        owner_education = "Master's"
    elif "Bachelor" in edu_raw or "Degree" in edu_raw or "University" in edu_raw:
        owner_education = "Bachelor's"
    elif "Higher" in edu_raw or "Diploma" in edu_raw or "College" in edu_raw or "Tertiary" in edu_raw:
        owner_education = "Higher Secondary"
    elif "Second" in edu_raw or "High School" in edu_raw:
        owner_education = "Secondary"
    else:
        owner_education = "Primary"

    # Normalize collateral_level -> ['Low', 'Moderate', 'High']
    col_raw = str(credit_req.collateral_level).strip()
    if "High" in col_raw:
        collateral_level = "High"
    elif "Mod" in col_raw or "Med" in col_raw:
        collateral_level = "Moderate"
    else:
        collateral_level = "Low"

    # Normalize late_payment_history -> ['Never', 'Rarely', 'Sometimes', 'Often']
    late_raw = str(credit_req.late_payment_history).strip()
    if "Often" in late_raw or "Freq" in late_raw:
        late_payment_history = "Often"
    elif "Some" in late_raw or "Occas" in late_raw:
        late_payment_history = "Sometimes"
    elif "Rare" in late_raw or "Once" in late_raw:
        late_payment_history = "Rarely"
    else:
        late_payment_history = "Never"

    return {
        "legal_status": legal_status,
        "location_type": location_type,
        "owner_education": owner_education,
        "collateral_level": collateral_level,
        "late_payment_history": late_payment_history,
    }


def evaluate_credit_request(credit_req):
    """
    Takes a CreditRequest instance, prepares the exact feature vector
    matching the notebook pipeline, runs XGBoost prediction, and extracts
    local SHAP feature explanations.
    """
    if xgb_model is None or tree_explainer is None:
        raise ValueError("ML model artifacts are not loaded. Check ml_artifacts/ folder.")

    norm = normalize_input_values(credit_req)

    revenue = float(credit_req.monthly_revenue_kes)
    profit = float(credit_req.monthly_profit_kes)
    stability = int(credit_req.cashflow_stability)
    confidence = int(credit_req.repayment_confidence)

    # A. Build raw input dictionary (16 base features + 2 engineered features)
    raw_input = {
        "sector": str(credit_req.sector).strip(),
        "business_age_years": int(credit_req.business_age_years),
        "legal_status": norm["legal_status"],
        "location_type": norm["location_type"],
        "employees_count": int(credit_req.employees_count),
        "existing_loans": 1 if credit_req.existing_loans in [True, 1, "Yes", "yes", "true", "1"] else 0,
        "prior_loan_count": int(credit_req.prior_loan_count),
        "late_payment_history": norm["late_payment_history"],
        "collateral_level": norm["collateral_level"],
        "cashflow_stability": stability,
        "repayment_confidence": confidence,
        "owner_education": norm["owner_education"],
        "days_payable_outstanding": int(credit_req.days_payable_outstanding),
        "monthly_revenue_kes": revenue,
        "monthly_profit_kes": profit,
        "county": str(credit_req.county).replace(" County", "").strip(),
        # Engineered features:
        "profit_margin": (profit / revenue) if revenue > 0 else 0.0,
        "stability_confidence_ratio": (stability / confidence) if confidence > 0 else 0.0,
    }

    df = pd.DataFrame([raw_input])

    # B. Map ordinal features (Cell 23 of notebook)
    ordinal_defaults = {
        "collateral_level": {"Low": 0, "Moderate": 1, "High": 2},
        "owner_education": {
            "Primary": 0,
            "Secondary": 1,
            "Higher Secondary": 2,
            "Bachelor's": 3,
            "Master's": 4,
        },
        "late_payment_history": {"Never": 0, "Rarely": 1, "Sometimes": 2, "Often": 3},
    }
    mappings = METADATA.get("ordinal_mappings", ordinal_defaults)
    for col, mapping in mappings.items():
        if col in df.columns and col != "existing_loans":
            df[col] = df[col].map(mapping).fillna(0).astype(int)

    # C. Group unseen counties into 'Other'
    valid_counties = METADATA.get("county_categories", [])
    if valid_counties and "county" in df.columns:
        df["county"] = df["county"].where(df["county"].isin(valid_counties), "Other")

    # D. Enforce exact categorical dtypes & category ordering expected by XGBoost
    category_lists = {
        "sector": METADATA.get("sector_categories", ["Agriculture", "Manufacturing", "Retail", "Services"]),
        "legal_status": METADATA.get("legal_status_categories", ["Limited", "Partnership", "Sole"]),
        "location_type": METADATA.get("location_type_categories", ["Rural", "Urban"]),
        "county": valid_counties if valid_counties else None,
    }
    for col in METADATA.get("categorical_columns", ["sector", "legal_status", "location_type", "county"]):
        if col in df.columns:
            cats = category_lists.get(col)
            if cats:
                df[col] = pd.Categorical(df[col], categories=cats)
            else:
                df[col] = df[col].astype("category")

    # E. Order columns strictly as trained
    expected_features = METADATA.get("features", list(xgb_model.feature_names_in_))
    ordered_df = df[expected_features]

    # F. Run Inference
    prob_default = float(xgb_model.predict_proba(ordered_df)[0, 1])
    credit_score = int(np.clip(850 - (prob_default * 550), 300, 850))

    if prob_default < 0.25:
        risk_category = "Low Risk"
    elif prob_default < 0.40:
        risk_category = "Moderate Risk"
    else:
        risk_category = "High Risk"

    # Capacity limit: 40% annualized net monthly profit buffer
    recommended_limit = (
        round(profit * 0.4 * 12, 2)
        if risk_category != "High Risk"
        else 0.0
    )

    # G. Local SHAP Attribution
    shap_values = tree_explainer(ordered_df)
    shap_contributions = []
    for feat_name, impact in zip(expected_features, shap_values.values[0]):
        shap_contributions.append((feat_name, float(impact)))

    # Sort by absolute SHAP impact
    shap_contributions.sort(key=lambda x: abs(x[1]), reverse=True)

    explanations = []
    for feat, imp in shap_contributions[:3]:
        clean_name = feat.replace("_", " ").title()
        if imp > 0:
            explanations.append(f"Caution: {clean_name} elevated the assessed risk of missed payment.")
        else:
            explanations.append(f"Positive: Strong {clean_name} supported credit standing.")

    return {
        "credit_score": credit_score,
        "probability_of_default": round(prob_default, 4),
        "risk_category": risk_category,
        "recommended_limit": recommended_limit,
        "shap_explanation": explanations,
    }