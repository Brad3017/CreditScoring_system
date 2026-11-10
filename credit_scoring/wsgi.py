"""
WSGI config for credit_scoring project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'credit_scoring.settings')

application = get_wsgi_application()

# Load the XGBoost model and SHAP explainer when each worker starts, not on its first request.
# The module caches them at import, so this happens once per worker process.
import scoring.services  # noqa: E402,F401
