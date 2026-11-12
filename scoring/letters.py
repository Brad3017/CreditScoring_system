"""
One-page PDF decision letter for an analysed assessment (ReportLab, built-in Helvetica).

Every figure comes from the stored assessment and its request. Nothing is re-scored: the reasons and
tips are read from the stored shap_values, and the decision is the latest stored review.
"""
from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    Frame, HRFlowable, KeepInFrame, PageTemplate, BaseDocTemplate, Paragraph, Spacer, Table, TableStyle,
)

from .services import SCORE_MAX, SCORE_MIN

# The app's accent: frontend/credit-scoring-frontend/src/styles/tokens.css, --accent (light theme).
# Copied here because the frontend folder is not in the backend image; a test keeps the two in step.
ACCENT_HEX = "#0e5a55"
ACCENT = colors.HexColor(ACCENT_HEX)
GREY = colors.HexColor("#5b6470")
BANNER_BG = colors.HexColor("#eeeeee")
BANNER_LINE = colors.HexColor("#c8c8c8")

MARGIN = 2 * cm
FOOTER_SPACE = 0.9 * cm  # reserved at the bottom of the frame for the footer line
MAX_REASONS = 3
MAX_NOTE_CHARS = 600

DEMO_BANNER = "Sample letter from a student demonstration system. This is not a real credit offer or decision."
RIGHTS = (
    "This decision was made by a credit analyst, supported by an automated score. You can ask for the "
    "decision to be reviewed, and ask what information about you was used, by contacting us through your "
    "BiasharaScore account. You may also request a copy of the personal data we hold about you."
)
LEGACY_FACTORS = "A detailed factor breakdown is not available for assessments made with an earlier model."
NO_TIPS = "None of the answers you can change raised your risk."
TIPS_NOTE = (
    "Based on the model's factor contributions for this assessment. "
    "Changing an answer does not guarantee a different result."
)

# Same list and rule as the report page's "What would improve this score"
# (frontend/credit-scoring-frontend/src/components/ImprovementTips.jsx). Keep the two in step.
CHANGEABLE = (
    "loan_to_revenue",
    "tenure_months",
    "days_payable_outstanding",
    "cashflow_stability",
    "late_payment_history",
)

DECIDED = ("approved", "declined", "referred")


# ---------------------------------------------------------------------------
# Content helpers (plain data, no PDF code; the tests use these too)
# ---------------------------------------------------------------------------
def letter_reference(assessment):
    """BS-<year of the decision>-<zero-padded assessment id>, e.g. BS-2026-000123."""
    year = timezone.localtime(assessment.reviewed_at).year
    return f"BS-{year}-{assessment.id:06d}"


def long_date(dt):
    """11 November 2026 (no leading zero, English month names whatever the server locale)."""
    months = ("January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December")
    d = timezone.localtime(dt)
    return f"{d.day} {months[d.month - 1]} {d.year}"


def kes(value):
    """Whole shillings, as the report page shows them (Math.round + en-KE grouping)."""
    return f"KES {round(float(value)):,}"


def _shap_rows(assessment):
    return [v for v in (assessment.shap_values or []) if isinstance(v, dict) and isinstance(v.get("value"), (int, float))]


def main_reasons(assessment):
    """The 3 largest stored SHAP values by absolute size, in the report page's wording."""
    rows = sorted(_shap_rows(assessment), key=lambda v: abs(v["value"]), reverse=True)
    return [
        f"{v.get('label') or v.get('feature')} {'raised' if v.get('direction') == 'raises_risk' else 'lowered'} the assessed risk."
        for v in rows[:MAX_REASONS]
        if v["value"] != 0
    ]


def improvement_tips(assessment):
    """Same filter, order and sentences as ImprovementTips.jsx. The on-screen hints are left out:
    they point to the what-if tool, which a printed letter cannot offer."""
    raising = sorted(
        (v for v in _shap_rows(assessment)
         if v.get("feature") in CHANGEABLE and v.get("direction") == "raises_risk" and v["value"] > 0),
        key=lambda v: v["value"],
        reverse=True,
    )[:3]
    return [
        f"{v.get('label') or v.get('feature')} "
        f"{'raised your risk the most among the answers you can change' if i == 0 else 'also raised your risk'}."
        for i, v in enumerate(raising)
    ]


def decision_paragraph(assessment):
    """The decision wording. Only the approved letter carries amounts."""
    status = assessment.review_status
    if status == "declined":
        return ["After reviewing your application, we are unable to offer credit at this time."]
    if status == "referred":
        return ["Before we can decide, we need more information from you. Please see the note below."]

    r = assessment.request
    limit = float(assessment.recommended_limit)
    requested = float(r.loan_amount)
    tenure = r.tenure_months
    if limit <= 0:
        # The analyst approved although the policy recommended no limit (High Risk): no amount to state.
        return [
            "We are pleased to tell you that your application has been approved. "
            "The model recommended no loan limit at this risk level, so the amount and final terms are "
            "confirmed in a separate loan agreement."
        ]
    # The stored estimate is for the REQUESTED amount (amount / months). When the limit is lower, the
    # same flat rule is applied to the limit, so the repayment matches the amount this letter offers.
    repayment = float(assessment.monthly_repayment_estimate) if limit >= requested else limit / tenure
    if repayment <= 0:  # rows from before the estimate was stored
        repayment = limit / tenure
    parts = [
        f"We are pleased to tell you that your application has been approved for up to {kes(limit)}, "
        f"repayable over {tenure} months. Estimated monthly repayment: {kes(repayment)} "
        "(flat estimate, excluding interest). Final terms are confirmed in a separate loan agreement."
    ]
    if limit < requested:
        parts.append(
            f"This is less than the {kes(requested)} you asked for, based on what your business's profit "
            "can comfortably repay."
        )
    return parts


def analyst_note(assessment):
    note = (assessment.review_note or "").strip()
    if not note:
        return None
    return note if len(note) <= MAX_NOTE_CHARS else note[:MAX_NOTE_CHARS].rstrip() + "…"


def analyst_name(assessment):
    u = assessment.reviewed_by
    return (u.full_name.strip() if u and u.full_name else "") or "Credit analyst"


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------
def _styles(body_size):
    base = ParagraphStyle("body", fontName="Helvetica", fontSize=body_size, leading=body_size * 1.35,
                          alignment=TA_LEFT, spaceAfter=0)
    return {
        "body": base,
        "brand": ParagraphStyle("brand", parent=base, fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=ACCENT),
        "tagline": ParagraphStyle("tagline", parent=base, fontSize=9.5, leading=12, textColor=GREY),
        "banner": ParagraphStyle("banner", parent=base, fontName="Helvetica-Bold", fontSize=body_size - 0.5,
                                 leading=(body_size - 0.5) * 1.3),
        "subject": ParagraphStyle("subject", parent=base, fontName="Helvetica-Bold", fontSize=body_size + 1.5,
                                  leading=(body_size + 1.5) * 1.3),
        "h2": ParagraphStyle("h2", parent=base, fontName="Helvetica-Bold", fontSize=body_size + 0.5,
                             leading=(body_size + 0.5) * 1.3, textColor=ACCENT, spaceBefore=body_size * 0.9,
                             spaceAfter=body_size * 0.25),
        "bullet": ParagraphStyle("bullet", parent=base, leftIndent=12, bulletIndent=2),
        "small": ParagraphStyle("small", parent=base, fontSize=body_size - 1.5, leading=(body_size - 1.5) * 1.35,
                                textColor=GREY),
    }


def _story(assessment, s):
    r = assessment.request
    user = r.user
    e = escape
    gap = lambda h=0.25: Spacer(1, h * cm)  # noqa: E731
    story = [
        Paragraph("BiasharaScore", s["brand"]),
        Paragraph("Credit scoring for Kenyan small businesses", s["tagline"]),
        gap(0.15),
        HRFlowable(width="100%", thickness=0.8, color=ACCENT, spaceBefore=0, spaceAfter=0),
        gap(0.35),
    ]

    banner = Table([[Paragraph(e(DEMO_BANNER), s["banner"])]], colWidths=["100%"])
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BANNER_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, BANNER_LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [banner, gap(0.35)]

    story += [
        Paragraph(f"Ref: {e(letter_reference(assessment))}", s["body"]),
        Paragraph(e(long_date(assessment.reviewed_at)), s["body"]),
        gap(),
        Paragraph(e(user.full_name.strip() if user.full_name and user.full_name.strip() else user.email), s["body"]),
        Paragraph(e(r.business_name or "Business not named"), s["body"]),
        Paragraph(e(r.business.kra_pin) if r.business and r.business.kra_pin else "KRA PIN not provided", s["body"]),
        gap(0.35),
        Paragraph(f"Your credit assessment for {e(r.business_name or 'your business')}", s["subject"]),
        gap(0.15),
    ]
    for i, text in enumerate(decision_paragraph(assessment)):
        story += [gap(0.12)] if i else []
        story.append(Paragraph(e(text), s["body"]))

    story += [
        Paragraph("Your assessment", s["h2"]),
        Paragraph(
            f"Credit score: <b>{assessment.credit_score} out of {SCORE_MAX}</b> · "
            f"Risk category: <b>{e(assessment.risk_category)}</b> · "
            f"Assessed on {e(long_date(assessment.created_at))}",
            s["body"],
        ),
        Paragraph(
            f"Scores run from {SCORE_MIN} to {SCORE_MAX}. Higher scores mean lower assessed risk.", s["body"]
        ),
    ]

    if not _shap_rows(assessment):
        story += [Paragraph("Main reasons for this result", s["h2"]), Paragraph(LEGACY_FACTORS, s["body"])]
    else:
        story.append(Paragraph("Main reasons for this result", s["h2"]))
        story += [Paragraph(e(t), s["bullet"], bulletText="•") for t in main_reasons(assessment)]
        story.append(Paragraph("What could improve your result", s["h2"]))
        tips = improvement_tips(assessment)
        if tips:
            story += [Paragraph(e(t), s["bullet"], bulletText="•") for t in tips]
            story.append(Paragraph(e(TIPS_NOTE), s["small"]))
        else:
            story.append(Paragraph(NO_TIPS, s["body"]))

    note = analyst_note(assessment)
    if note:
        story += [
            Paragraph("Note from your credit analyst", s["h2"]),
            Paragraph(e(note).replace("\n", "<br/>"), s["body"]),
            Paragraph(f"— {e(analyst_name(assessment))}", s["small"]),
        ]

    story += [Paragraph("Your rights", s["h2"]), Paragraph(e(RIGHTS), s["body"])]
    return story


def _footer_text(assessment):
    now = timezone.localtime()
    return (f"Generated on {long_date(now)} at {now:%H:%M} · Model {assessment.model_version} · "
            f"Assessment ASSESS-{assessment.id}")


def _render(assessment, body_size):
    buf = BytesIO()
    width, height = A4
    frame = Frame(MARGIN, MARGIN + FOOTER_SPACE, width - 2 * MARGIN, height - 2 * MARGIN - FOOTER_SPACE,
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="body")
    footer = _footer_text(assessment)

    def draw_footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(MARGIN, MARGIN, footer)
        canvas.restoreState()

    doc = BaseDocTemplate(
        buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
        title=f"BiasharaScore decision letter {letter_reference(assessment)}",
        author="BiasharaScore (student demonstration system)",
        subject="Sample decision letter. Not a real credit offer or decision.",
    )
    doc.addPageTemplates([PageTemplate(id="letter", frames=[frame], onPage=draw_footer)])
    # KeepInFrame(shrink) keeps everything on ONE page: if the content were ever taller than the frame,
    # it is scaled down instead of flowing onto a second page.
    story = _story(assessment, _styles(body_size))
    doc.build([KeepInFrame(frame._width, frame._height, story, mode="shrink")])
    return buf.getvalue()


def build_decision_letter(assessment) -> bytes:
    """The PDF bytes of the decision letter for a decided assessment (approved, declined or referred)."""
    if assessment.review_status not in DECIDED or assessment.reviewed_at is None:
        raise ValueError("A decision letter needs a recorded decision.")
    return _render(assessment, body_size=10.5)
