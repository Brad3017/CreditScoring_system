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


def evaluate_credit_request(credit_req):
    """
    Takes a CreditRequest instance, prepares the 16-feature input vector,
    runs XGBoost prediction, and extracts local SHAP feature explanations.
    """
    if xgb_model is None or tree_explainer is None:
        raise ValueError("ML model artifacts are not loaded. Check ml_artifacts/ folder.")    
# A. Map attributes from the credit_req database instance
    raw_input = {
        "sector": credit_req.sector,
        "business_age_years": credit_req.business_age_years,
        "legal_status": credit_req.legal_status,
        "location_type": credit_req.location_type,
        "employees_count": credit_req.employees_count,
        "existing_loans": 1 if credit_req.existing_loans else 0,
        "prior_loan_count": credit_req.prior_loan_count,
        "late_payment_history": credit_req.late_payment_history,
        "collateral_level": credit_req.collateral_level,
        "cashflow_stability": credit_req.cashflow_stability,
        "repayment_confidence": credit_req.repayment_confidence,
        "owner_education": credit_req.owner_education,
        "days_payable_outstanding": credit_req.days_payable_outstanding,
        "monthly_revenue_kes": float(credit_req.monthly_revenue_kes),
        "monthly_profit_kes": float(credit_req.monthly_profit_kes),
        "county": credit_req.county,
    }

    df = pd.DataFrame([raw_input])

    # B. Map ordinal features
    for col, mapping in METADATA.get("ordinal_mappings", {}).items():
        if col in df.columns:
            df[col] = df[col].map(mapping)

    # C. Group unseen counties into 'Other'
    valid_counties = METADATA.get("county_categories", [])
    if valid_counties and "county" in df.columns:
        df["county"] = df["county"].where(df["county"].isin(valid_counties), "Other")

    # D. Enforce categorical dtypes expected by XGBoost
    for col in METADATA.get("categorical_columns", []):
        if col in df.columns:
            df[col] = df[col].astype("category")

    # E. Order columns strictly as trained
    ordered_df = df[METADATA["features"]]

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
        round(float(credit_req.monthly_profit_kes) * 0.4 * 12, 2)
        if risk_category != "High Risk"
        else 0.0
    )     
# G. Local SHAP Attribution
    shap_values = tree_explainer(ordered_df)
    shap_contributions = []
    for feat_name, impact in zip(METADATA["features"], shap_values.values[0]):
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