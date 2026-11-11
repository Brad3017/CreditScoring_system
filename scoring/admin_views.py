"""Admin-only reporting endpoints. Every number is computed from stored data."""
import csv
import json
from collections import defaultdict
from datetime import datetime

from django.conf import settings
from django.db.models import Avg, Count
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CreditAssessment, LessonView
from . import services

User = get_user_model()

MIN_GROUP = 5  # groups smaller than this are shown but not compared


class IsAdminRole(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == "admin"


def _parse(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date() if value else None
    except ValueError:
        return None


def _queryset(request):
    qs = CreditAssessment.objects.select_related("request", "reviewed_by")
    start = _parse(request.query_params.get("date_from"))
    end = _parse(request.query_params.get("date_to"))
    if start:
        qs = qs.filter(created_at__date__gte=start)
    if end:
        qs = qs.filter(created_at__date__lte=end)
    return qs


def _is_high(category):
    return "high" in (category or "").lower()


def _pct(num, den):
    return round(100 * num / den, 1) if den else None


class AdminOverviewView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = _queryset(request)
        total = qs.count()
        agg = qs.aggregate(avg_score=Avg("credit_score"), avg_pd=Avg("probability_of_default"))

        risk = {"Low Risk": 0, "Moderate Risk": 0, "High Risk": 0}
        for row in qs.values("risk_category").annotate(n=Count("id")):
            risk[row["risk_category"]] = row["n"]

        review = {"pending": 0, "approved": 0, "declined": 0, "referred": 0}
        for row in qs.values("review_status").annotate(n=Count("id")):
            review[row["review_status"]] = row["n"]

        # Score histogram in 50-point bins across 300-850.
        bins = [{"from": s, "to": s + 49 if s < 800 else 850, "count": 0} for s in range(300, 850, 50)]
        for score in qs.values_list("credit_score", flat=True):
            idx = min(max((score - 300) // 50, 0), len(bins) - 1)
            bins[idx]["count"] += 1

        def by(field, limit=None):
            rows = (
                qs.values(f"request__{field}")
                .annotate(n=Count("id"), avg=Avg("credit_score"))
                .order_by("-n")
            )
            out = [
                {"name": r[f"request__{field}"] or "Not recorded", "count": r["n"], "avg_score": round(r["avg"])}
                for r in rows
            ]
            return out[:limit] if limit else out

        monthly = [
            {"month": r["m"].strftime("%Y-%m"), "count": r["n"]}
            for r in qs.annotate(m=TruncMonth("created_at")).values("m").annotate(n=Count("id")).order_by("m")
        ]

        # "Learn" lessons opened (one count per owner per lesson per day). Titles live in the frontend.
        lesson_views = [
            {"feature_key": r["feature_key"], "views": r["n"]}
            for r in LessonView.objects.values("feature_key").annotate(n=Count("id")).order_by("-n", "feature_key")
        ]

        users = {"owner": 0, "analyst": 0, "admin": 0}
        for row in User.objects.values("role").annotate(n=Count("id")):
            users[row["role"]] = row["n"]

        return Response({
            "total": total,
            "avg_score": round(agg["avg_score"]) if agg["avg_score"] is not None else None,
            "avg_pd": round(float(agg["avg_pd"]) * 100, 1) if agg["avg_pd"] is not None else None,
            "high_risk_rate": _pct(risk["High Risk"], total),
            "risk": risk,
            "review": review,
            "awaiting_review": review["pending"],
            "score_bins": bins,
            "sectors": by("sector"),
            "counties": by("county", limit=10),
            "monthly": monthly,
            "users": users,
            "lesson_views": lesson_views,
        })


class AdminFairnessView(APIView):
    """Compares outcomes across groups. This is a screening tool, not proof of bias."""
    permission_classes = [IsAdminRole]
    DIMENSIONS = [
        ("sector", "Sector"),
        ("county", "County"),
        ("legal_status", "Legal structure"),
        ("location_type", "Location type"),
    ]

    def get(self, request):
        qs = _queryset(request)
        rows = list(qs.values(
            "request__sector", "request__county", "request__legal_status", "request__location_type",
            "credit_score", "risk_category", "review_status",
        ))
        total = len(rows)
        overall_high = _pct(sum(_is_high(r["risk_category"]) for r in rows), total)

        dimensions = []
        for field, label in self.DIMENSIONS:
            groups = defaultdict(list)
            for r in rows:
                groups[r[f"request__{field}"] or "Not recorded"].append(r)
            out = []
            for name, items in groups.items():
                n = len(items)
                decided = [i for i in items if i["review_status"] in ("approved", "declined")]
                out.append({
                    "name": name,
                    "count": n,
                    "avg_score": round(sum(i["credit_score"] for i in items) / n),
                    "high_risk_rate": _pct(sum(_is_high(i["risk_category"]) for i in items), n),
                    "decided": len(decided),
                    "approval_rate": _pct(sum(i["review_status"] == "approved" for i in decided), len(decided)),
                    "comparable": n >= MIN_GROUP,
                })
            out.sort(key=lambda g: -g["count"])
            comp = [g["high_risk_rate"] for g in out if g["comparable"]]
            dimensions.append({
                "field": field,
                "label": label,
                "groups": out,
                "gap": round(max(comp) - min(comp), 1) if len(comp) >= 2 else None,
            })

        return Response({"total": total, "overall_high_risk_rate": overall_high,
                         "min_group": MIN_GROUP, "dimensions": dimensions})


class AdminModelView(APIView):
    permission_classes = [IsAdminRole]

    @staticmethod
    def _load(name):
        path = settings.ML_ARTIFACTS_DIR / name
        try:
            with open(path, "r") as f:
                return json.load(f)
        except (OSError, ValueError):
            return None

    def get(self, request):
        meta = self._load("model_metadata.json") or {}
        report = self._load("model_report.json")
        versions = list(
            CreditAssessment.objects.values("model_version").annotate(n=Count("id")).order_by("-n")
        )
        return Response({
            "loaded": services.xgb_model is not None,
            "model_name": meta.get("model_name"),
            "target": meta.get("target"),
            "metadata_threshold": meta.get("threshold"),
            "features": meta.get("features", []),
            "risk_bands": services.risk_band_rules(),
            "score_formula": "credit score = " + meta.get("score", {}).get("formula", "not recorded") + ", where pd is the probability of default",
            "versions_in_use": [{"version": v["model_version"], "count": v["n"]} for v in versions],
            "report": report,
        })


def _safe(value):
    """Stop spreadsheet formula injection from user-entered text."""
    s = "" if value is None else str(value)
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s


class AdminExportView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="assessments.csv"'
        w = csv.writer(response)
        w.writerow([
            "id", "submitted", "business", "sector", "county", "legal_status", "monthly_revenue_kes",
            "credit_score", "probability_of_default", "risk_category", "recommended_limit_kes",
            "review_status", "reviewed_by", "reviewed_at", "review_note",
        ])
        for a in _queryset(request).order_by("-created_at"):
            r = a.request
            w.writerow([
                a.id, a.created_at.date().isoformat(), _safe(r.business_name), _safe(r.sector),
                _safe(r.county), _safe(r.legal_status), r.monthly_revenue_kes, a.credit_score,
                a.probability_of_default, a.risk_category, a.recommended_limit, a.review_status,
                _safe(a.reviewed_by.full_name or a.reviewed_by.email) if a.reviewed_by else "",
                a.reviewed_at.isoformat() if a.reviewed_at else "", _safe(a.review_note),
            ])
        return response
