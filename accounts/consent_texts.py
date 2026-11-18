"""Consent texts: the single source of truth for the wording a user agrees to.

Each ConsentRecord stores CONSENT_VERSION, so the version on a record identifies the exact text the user
saw. When ANY text here changes, bump CONSENT_VERSION: every user is then asked again, because has_consent()
only counts records with the current version. The frontend reads these texts from GET /api/consents/texts/.
"""

CONSENT_VERSION = "1.0"

PRIVACY_NOTICE = "privacy_notice"
CREDIT_SCORING = "credit_scoring"
STATEMENT_PROCESSING = "statement_processing"
COMMUNICATIONS = "communications"
STAFF_CONFIDENTIALITY = "staff_confidentiality"

CONSENT_TEXTS = {
    PRIVACY_NOTICE: "I have read and understood the BiasharaScore privacy notice.",
    CREDIT_SCORING: (
        "BiasharaScore uses a machine-learning model to estimate the credit risk of my business from the "
        "information I provide, and shows the main reasons for the score. A credit analyst reviews every "
        "application before a final decision, and I can ask for a review at any time. My assessment is seen "
        "only by the analysts and administrators of this service. I can withdraw this consent at any time; "
        "if I do, I won't be able to request new assessments."
    ),
    STATEMENT_PROCESSING: (
        "I agree to BiasharaScore reading this statement to assess my business. "
        "The file is deleted after reading."
    ),
    COMMUNICATIONS: (
        "Send me email updates about my assessments. Messages never include my score or any amounts."
    ),
    STAFF_CONFIDENTIALITY: (
        "I will access MSME owners' data only to review and manage credit assessments, keep it confidential, "
        "and not copy or share it outside BiasharaScore."
    ),
}

# Short names for screens and the admin.
PURPOSE_LABELS = {
    PRIVACY_NOTICE: "Privacy notice",
    CREDIT_SCORING: "Credit scoring",
    STATEMENT_PROCESSING: "Till statement reading",
    COMMUNICATIONS: "Email updates",
    STAFF_CONFIDENTIALITY: "Staff confidentiality",
}
