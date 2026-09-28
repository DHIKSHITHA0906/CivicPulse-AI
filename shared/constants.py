"""
shared/constants.py — Section 1 of the CivicPulse master interface doc.
Mirrored manually in frontend/src/constants.js. If you ever change a value
here, change it there too in the same commit.
"""

CATEGORIES = ["water", "healthcare", "education", "roads", "sanitation", "other"]

SUB_CATEGORY_EXAMPLES = {
    "water": ["drinking_water", "irrigation", "water_quality"],
    "healthcare": ["clinic_access", "medicine_shortage", "staff_shortage"],
    "education": ["school_infrastructure", "teacher_shortage", "transport"],
    "roads": ["road_condition", "connectivity", "traffic_safety"],
    "sanitation": ["drainage", "waste_management", "public_toilets"],
    "other": [],
}

LANGUAGES = ["ta", "kn", "hi", "en"]  # Tamil, Kannada, Hindi, English
STATES = ["Tamil Nadu", "Karnataka"]

RECOMMENDATION_TYPES = [
    "NEW_INTERVENTION",
    "ACCELERATE",
    "REVIEW_EXPAND",
    "MONITOR",
    "CONSIDER_REDIRECT",
    "NO_ACTION_FLAGGED",
]

PROJECT_STATUS = ["none", "planned", "active"]
# existing_investment numeric mapping used inside the priority formula only:
EXISTING_INVESTMENT_MAP = {"none": 0.0, "planned": 0.5, "active": 1.0}

CONFIDENCE_LOW_THRESHOLD = 0.6      # extraction confidence below this -> needs_review = true
PRIORITY_HIGH_PERCENTILE = 0.80     # top 20% of scores in a state = "high"
PRIORITY_MODERATE_PERCENTILE = 0.50  # next 30% = "moderate"; below = low
