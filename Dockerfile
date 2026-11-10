# Place in: CreditScoringSystem/backend/Dockerfile   (next to manage.py)

# Python 3.12: your .pyc files are cpython-312 and your Django version (6.x) needs 3.12 or newer.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copies the project, including ml_artifacts/ and every app's migrations/ folder.
COPY . .

# collectstatic loads settings.py, which needs SECRET_KEY. This throwaway value is used at build time only.
RUN SECRET_KEY=build-only python manage.py collectstatic --noinput

EXPOSE 8000

# 2 workers: each one loads the XGBoost model and the SHAP explainer into memory, so keep it at 2.
# 4 threads per worker (gthread) so a page's parallel API calls are not queued behind each other.
CMD ["sh", "-c", "python manage.py migrate && gunicorn credit_scoring.wsgi:application --bind 0.0.0.0:8000 --workers 2 --threads 4 --worker-class gthread --timeout 90"]
