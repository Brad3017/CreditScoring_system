# Changes to backend/credit_scoring/settings.py

Your file already reads SECRET_KEY, DEBUG, ALLOWED_HOSTS and the database from environment
variables, so only one change is required.

## Required: add WhiteNoise (serves admin CSS/JS when DEBUG is off)

```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",   # <- add this line, right after SecurityMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    # ... rest unchanged
]
```

## Recommended before any real deployment

Delete `CORS_ALLOW_ALL_ORIGINS = True`. With nginx in front, the browser calls the same origin
(localhost:8080), so CORS is not needed. Keep the explicit list for local development.

## Frontend note

`src/lib/api.js` and `BusinessProfile.jsx` use
`import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"`.
The `VITE_API_URL` build argument in docker-compose.yml sets it to `http://localhost:8080`,
so requests go through nginx. If you change the port in docker-compose.yml, change it there too.
