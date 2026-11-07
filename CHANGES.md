# Fixes found after reading your project files

Apply these in order. Items 1 to 4 are needed for `docker compose up --build` to work.

## 1. backend/requirements.txt (not uploaded, so I could not check it)

From your activated virtual environment, in `backend/`:

    pip freeze > requirements.txt

Then confirm it contains: Django, djangorestframework, djangorestframework-simplejwt,
django-cors-headers, python-decouple, psycopg (or psycopg2-binary), xgboost, shap, pandas, numpy,
scikit-learn, whitenoise, gunicorn. Add any that are missing. If `pip freeze` lists packages you do
not use, remove them. `shap` is large, so the first build takes a few minutes.

Also confirm `backend/ml_artifacts/` holds `msme_xgboost_credit_model.json` and `model_metadata.json`.

## 2. backend/credit_scoring/settings.py (the uploaded copy has neither change)

```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",      # add
    ...
]

# Admin login through nginx on port 8080 needs this, or Django rejects the form (CSRF).
CSRF_TRUSTED_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"]
```

Remove `CORS_ALLOW_ALL_ORIGINS = True` before any real deployment.

## 3. frontend/credit-scoring-frontend/src/lib/api.js

Line 1 is hard-coded to the Django dev server, so in Docker the browser would call
`127.0.0.1:8000`, which is not published. Replace line 1 with:

```js
export const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";
```

Add at the bottom:

```js
export async function updateMe(data) {
  const res = await fetch(`${BASE}/auth/me/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Your personal details could not be saved.");
  return body;
}

export async function saveBusinessProfile(data) {
  const res = await fetch(`${BASE}/scoring/business-profile/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || JSON.stringify(body) || "Your business details could not be saved.");
  return body;
}
```

Use the new `BusinessProfilePage.jsx` from this zip. It calls these two functions instead of building
URLs itself.

## 4. Starter styles that squeeze the layout (this is the "cramped in the middle" problem)

`App.css` is the Vite starter file. The matching `index.css` from the same template sets `#root` to a
fixed width of about 1126px, centres its text and draws side borders. That is what narrowed your pages
and added the lines at the sides. In `src/main.jsx`:

- delete the line `import './index.css'`
- delete `src/App.css` if `App.jsx` does not import it (it does not)

If `index.css` also holds Tailwind lines (`@import "tailwindcss"` or `@tailwind ...`) that the analyst
pages need, keep only those lines and delete everything else in the file.

## 5. Missing backend endpoint: business profile

The profile page calls `PUT /api/scoring/business-profile/`, which does not exist in `scoring/urls.py`.

`scoring/views.py`: change the serializer import and add the view

```python
from .serializers import CreditRequestSerializer, CreditAssessmentSerializer, BusinessProfileSerializer

class BusinessProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def _current(self, request):
        return BusinessProfile.objects.filter(user=request.user).order_by("-created_at").first()

    def get(self, request):
        profile = self._current(request)
        return Response(BusinessProfileSerializer(profile).data if profile else {})

    def put(self, request):
        profile = self._current(request)
        serializer = BusinessProfileSerializer(profile, data=request.data, partial=True) if profile \
            else BusinessProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data)
```

`scoring/urls.py`: add `BusinessProfileView` to the import list and

```python
path("business-profile/", BusinessProfileView.as_view(), name="business_profile"),
```

## 6. Smaller problems in the code you sent

- `App.jsx`: the `/analyst` route is not wrapped in `<Private>`, and no analyst route checks the role.
  A borrower who types `/analyst` opens the page, though the API refuses the data. Add a role check
  (`getRole() === "analyst" || "admin"`).
- `AnalystLayout.jsx`: the logo box says "MS" (old name). Change it to "BS". "My Profile" points to
  `analyst/profile` (no leading slash, no route).
- `scoring/models.py`: `kra_pin` is declared twice in `BusinessProfile`. Delete the second line.
  The KRA PIN from the form is never saved, because `CreditRequest` has no such field.
- Unused starter and shadcn files can be deleted: `login-form.jsx`, `signup-form.jsx`, `button.jsx`,
  `card.jsx`, `field.jsx`, `input.jsx`, `label.jsx`, `separator.jsx`, `utils.js`, and
  `AssessmentResultsCard.jsx` (it falls back to an invented score of 648 when none is given).
- `analyst_dashboard.css` is unused by any page. Delete it.
- `api.js`: `fetchAssessmentDetail` calls a URL that does not exist. Delete it if nothing uses it.
- Analyst pages `AssessmentRequests`, `MsmeRecords`, `ReviewHistory`, `RiskAnalytics` still use the old
  look and show values the data does not support (fixed "Active / Inactive / Suspended" counts, a default
  review note, a donut that draws only the low-risk arc).
