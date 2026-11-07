# Docker + nginx setup for BiasharaScore

## How the pieces fit

```
Browser --> nginx (frontend container, port 8080)
              |-- /            -> React build (static files)
              |-- /api/        -> backend container (Django + Gunicorn, port 8000)
              |-- /admin/      -> backend container
              |-- /static/     -> backend container (WhiteNoise)
backend --> db container (Postgres)
```

## Where each file goes

```
CreditScoringSystem/
├── docker-compose.yml                              <- docker-compose.yml
├── backend/
│   ├── Dockerfile                                  <- backend/Dockerfile
│   ├── .dockerignore                               <- backend/.dockerignore
│   ├── .env                                        <- copy of backend/.env.example, edited
│   └── requirements.txt                            <- add lines from requirements-additions.txt
└── frontend/credit-scoring-frontend/
    ├── Dockerfile                                  <- frontend/credit-scoring-frontend/Dockerfile
    ├── nginx.conf                                  <- frontend/credit-scoring-frontend/nginx.conf
    └── .dockerignore                               <- frontend/credit-scoring-frontend/.dockerignore
```

## Steps

1. Install Docker Desktop (Windows: enable the WSL 2 backend) and start it.
2. Copy the files above into your project at the locations shown.
3. Add the lines from `backend/requirements-additions.txt` to `backend/requirements.txt`.
   Keep your ML library versions identical to the ones you trained with.
4. Make the WhiteNoise change described in `settings_changes.md`.
5. Copy `backend/.env.example` to `backend/.env`. Set a long random `SECRET_KEY` and a real
   `DB_PASSWORD`. Use the same password for `POSTGRES_PASSWORD` in `docker-compose.yml`.
6. Check that `backend/ml_artifacts/` contains the model and metadata files.
7. From the project root, run:

       docker compose up --build

8. In a second terminal, create an admin user:

       docker compose exec backend python manage.py createsuperuser

9. Open http://localhost:8080 (app) and http://localhost:8080/admin/ (Django admin).

## Everyday commands

| Task | Command |
|---|---|
| Start in the background | `docker compose up -d` |
| Stop | `docker compose down` |
| Stop and delete the database | `docker compose down -v` |
| See backend logs | `docker compose logs -f backend` |
| Rebuild after code changes | `docker compose up --build` |
| Open a Django shell | `docker compose exec backend python manage.py shell` |

## If something fails

- **Backend exits at startup:** run `docker compose logs backend`. Usual causes are a missing
  package in requirements.txt, or `DB_PASSWORD` not matching `POSTGRES_PASSWORD`.
- **Model fails to load:** the library versions in requirements.txt differ from training.
- **Admin has no styling:** the WhiteNoise middleware line is missing.
- **Page loads but API calls fail:** the frontend was built with the wrong `VITE_API_URL`.
  Fix it in docker-compose.yml and run `docker compose up --build`.
- **Refreshing /home gives 404:** nginx.conf was not copied into the frontend folder.
