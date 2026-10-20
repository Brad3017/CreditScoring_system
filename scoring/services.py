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