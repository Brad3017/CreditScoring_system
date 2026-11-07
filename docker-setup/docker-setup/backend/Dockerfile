# Place in: CreditScoringSystem/backend/Dockerfile   (next to manage.py)

# Use the same Python minor version you trained the model with.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first so Docker caches this layer until requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the project (includes ml_artifacts/ with the model and metadata files).
COPY . .

# collectstatic loads settings.py, which requires SECRET_KEY. This throwaway value is only
# used during the build; the real key comes from backend/.env at runtime.
RUN SECRET_KEY=build-only python manage.py collectstatic --noinput

EXPOSE 8000

# Apply migrations, then start Gunicorn. "credit_scoring" is your Django project folder.
CMD ["sh", "-c", "python manage.py migrate && gunicorn credit_scoring.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60"]
