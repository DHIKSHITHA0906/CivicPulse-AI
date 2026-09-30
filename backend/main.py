import sys
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4

from backend.firestore_client import save_request, get_requests

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# --------------------------------------------------
# PATHS
# --------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT_DIR / "scripts"
AI_DIR = ROOT_DIR / "ai"

sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(ROOT_DIR))


# --------------------------------------------------
# M2
# --------------------------------------------------

from priority_engine import compute_priority, priority_tier
from recommendation_engine import compute_recommendation


# --------------------------------------------------
# M1
# --------------------------------------------------

from ai.extractor import extract_request


# --------------------------------------------------
# APP
# --------------------------------------------------

app = FastAPI(
    title="CivicPulse AI Backend",
    version="1.0.0",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://civicpulse-ai-50f1a.web.app",
        "https://civicpulse-ai-50f1a.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# REQUEST MODEL
# --------------------------------------------------

class SubmitRequest(BaseModel):
    text: str | None = None
    audio_base64: str | None = None
    language_hint: str | None = None
    district_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None


# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "CivicPulse AI Backend",
        "status": "running",
    }


# --------------------------------------------------
# NORMALIZATION HELPERS
# --------------------------------------------------

CATEGORY_MAP = {
    "water": "water",
    "water supply": "water",
    "drinking water": "water",

    "health": "healthcare",
    "healthcare": "healthcare",

    "education": "education",
    "school": "education",

    "road": "roads",
    "roads": "roads",

    "sanitation": "sanitation",
    "toilet": "sanitation",

    "other": "other",
    "general": "other",
    "unknown": "other",
}


DISTRICT_MAP = {
    "chennai": "chennai",
    "madras": "chennai",

    "madurai": "madurai",

    "coimbatore": "coimbatore",

    "tiruchirappalli": "tiruchirappalli",
    "trichy": "tiruchirappalli",

    "salem": "salem",
}


# --------------------------------------------------
# DISTRICT-LEVEL MAP COORDINATES
# --------------------------------------------------

# These are district/city-level coordinates.
# They are NOT intended to represent exact citizen locations.

DISTRICT_COORDINATES = {
    "chennai": (13.0827, 80.2707),
    "madurai": (9.9252, 78.1198),
    "coimbatore": (11.0168, 76.9558),
    "tiruchirappalli": (10.7905, 78.7047),
    "salem": (11.6643, 78.1460),
}


SEVERITY_MAP = {
    "low": 2,
    "medium": 3,
    "high": 5,
}


def normalize_category(value):
    if not value:
        return "other"

    key = str(value).strip().lower()

    return CATEGORY_MAP.get(key, "other")


def normalize_district(value):
    if not value:
        return None

    key = str(value).strip().lower()

    return DISTRICT_MAP.get(key)


def normalize_severity(value):
    if isinstance(value, (int, float)):
        return max(1, min(5, int(value)))

    if not value:
        return 3

    key = str(value).strip().lower()

    return SEVERITY_MAP.get(key, 3)


# --------------------------------------------------
# SUBMIT CITIZEN REQUEST
# --------------------------------------------------

@app.post("/api/submit-request")
def submit_request(payload: SubmitRequest):

    # ----------------------------------------------
    # 1. Send citizen input to M1
    # ----------------------------------------------

    extracted = extract_request(
        text=payload.text,
        audio_base64=payload.audio_base64,
        language_hint=payload.language_hint,
    )

    # ----------------------------------------------
    # 2. Normalize district/category
    # ----------------------------------------------

    district_id = payload.district_id or normalize_district(extracted.get("location"))

    category = normalize_category(
        extracted.get("category")
    )

    # ----------------------------------------------
    # 3. Get district-level coordinates
    # ----------------------------------------------

    latitude = payload.latitude
longitude = payload.longitude

if latitude is None or longitude is None:
    if district_id in DISTRICT_COORDINATES:
        latitude, longitude = DISTRICT_COORDINATES[district_id]

    # ----------------------------------------------
    # 4. Create request ID
    # ----------------------------------------------

    request_id = str(uuid4())

    # ----------------------------------------------
    # 5. Build CitizenRequest
    # ----------------------------------------------

    result = {
        "request_id": request_id,

        "language": extracted.get("language"),

        "original_text": payload.text or "",

        "translated_text": extracted.get("description"),

        "category": category,

        "sub_category": None,

        "district": extracted.get("location"),

        "district_id": district_id,

        "latitude": latitude,

        "longitude": longitude,

        "severity": normalize_severity(
            extracted.get("priority")
        ),

        "affected_population": None,

        "confidence": extracted.get(
            "confidence",
            0.5
        ),

        "timestamp": datetime.now(
            timezone.utc
        ).isoformat(),

        "is_synthetic": False,

        "needs_review": extracted.get(
            "needs_review",
            True
        ),
    }

    # ----------------------------------------------
    # 6. Save to Firestore
    # ----------------------------------------------

    save_request(result)

    # ----------------------------------------------
    # 7. Return to frontend
    # ----------------------------------------------

    return result


# --------------------------------------------------
# GET CITIZEN REQUESTS
# --------------------------------------------------

@app.get("/api/requests")
def requests_endpoint(
    district_id: str | None = None,
    category: str | None = None,
):

    requests = get_requests(
        district_id=district_id,
        category=category,
    )

    return {
        "requests": requests
    }


# --------------------------------------------------
# PRIORITY
# --------------------------------------------------

@app.get("/api/priority/{district_id}")
def get_priority(district_id: str):

    categories = [
        "water",
        "healthcare",
        "education",
        "roads",
        "sanitation",
        "other",
    ]

    priorities = []

    for category in categories:

        priority = compute_priority(
            district_id,
            category,
        )

        tier = priority_tier(
            district_id,
            category,
            priority["priority_score"],
        )

        priority["tier"] = tier

        recommendation = compute_recommendation(
            priority
        )

        priority.update(recommendation)

        priorities.append(priority)

    return {
        "district_id": district_id,
        "priorities": priorities,
    }


# --------------------------------------------------
# RECOMMENDATIONS
# --------------------------------------------------

@app.get("/api/recommendations")
def get_recommendations(
    district_id: str
):

    categories = [
        "water",
        "healthcare",
        "education",
        "roads",
        "sanitation",
        "other",
    ]

    recommendations = []

    for category in categories:

        priority = compute_priority(
            district_id,
            category,
        )

        tier = priority_tier(
            district_id,
            category,
            priority["priority_score"],
        )

        priority["tier"] = tier

        recommendation = compute_recommendation(
            priority
        )

        recommendations.append({
            "district_id": district_id,
            "category": category,
            **priority,
            **recommendation,
        })

    return {
        "district_id": district_id,
        "recommendations": recommendations,
    }