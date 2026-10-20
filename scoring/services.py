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