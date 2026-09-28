"""
Member 2 — generate_synthetic.py
Generates synthetic CitizenRequest records (Section 2.1) for demo/testing,
weighted by a per (district, category) "need index" so high-need areas get
more simulated complaints (Part 14 of the build spec — not in the interface
doc I was given, so this weighting is my own reasonable design; adjust the
NEED_DRIVER functions if your team agreed on something different).

Run once, offline, from the repo root (after clean_data.py):
    python scripts/generate_synthetic.py

Output: data/synthetic_requests.json  (loaded into Firestore by Member 3's loader)
"""

import json
import os
import random
import sys
import uuid
from datetime import datetime, timezone

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "shared"))
from constants import CATEGORIES, SUB_CATEGORY_EXAMPLES, LANGUAGES, CONFIDENCE_LOW_THRESHOLD

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_requests.json")

# Rough "what drives need" per category — used only to weight synthetic
# volume, not part of the real priority formula in priority_engine.py.
NEED_DRIVER = {
    "water": lambda d: d["population"] / max(d["avg_rainfall_mm"] or 800, 1),
    "healthcare": lambda d: d["population"] / max(d["hospital_count"], 1),
    "education": lambda d: d["population"] / max(d["school_count"] or 1, 1),
    "roads": lambda d: d["population"] / max(d["road_density_km"] or 1, 1),
    "sanitation": lambda d: d["population"] / max(d["hospital_count"], 1),
    "other": lambda d: 1.0,
}


def _need_weights(districts: list[dict]) -> dict:
    """(district_id, category) -> need weight, min-max normalized to (0.1, 1.0)."""
    raw = {}
    for d in districts:
        for cat in CATEGORIES:
            raw[(d["district_id"], cat)] = NEED_DRIVER[cat](d)
    values = list(raw.values())
    lo, hi = min(values), max(values)
    span = (hi - lo) or 1
    return {k: 0.1 + 0.9 * (v - lo) / span for k, v in raw.items()}


def generate_synthetic_requests(districts: list[dict], n_total: int = 750) -> list[dict]:
    """
    Returns a list of CitizenRequest dicts (Section 2.1) with is_synthetic=True,
    request_id/timestamp already filled in — matches what Member 3's loader
    script expects to write straight into Firestore.
    """
    weights = _need_weights(districts)
    keys = list(weights.keys())
    probs = list(weights.values())

    requests = []
    for _ in range(n_total):
        district_id, category = random.choices(keys, weights=probs, k=1)[0]
        district = next(d for d in districts if d["district_id"] == district_id)

        confidence = round(random.uniform(0.55, 0.99), 2)
        options = SUB_CATEGORY_EXAMPLES.get(category, [])
        sub_category = random.choice(options) if options else ""
        severity = random.choices([1, 2, 3, 4, 5], weights=[5, 15, 30, 30, 20])[0]
        has_pop_estimate = random.random() > 0.25

        # small jitter around the district centroid so map markers don't stack
        lat = district["lat"] + random.uniform(-0.05, 0.05)
        long = district["long"] + random.uniform(-0.05, 0.05)

        record = {
            "request_id": str(uuid.uuid4()),
            "language": random.choice(LANGUAGES),
            "original_text": f"[synthetic] {category}/{sub_category} issue reported in {district['name']}",
            "translated_text": f"[synthetic] {category}/{sub_category} issue reported in {district['name']}",
            "category": category,
            "sub_category": sub_category,
            "district": district["name"],
            "district_id": district_id,
            "latitude": lat,
            "longitude": long,
            "severity": severity,
            "affected_population": random.randint(50, 15000) if has_pop_estimate else None,
            "confidence": confidence,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "is_synthetic": True,
            "needs_review": confidence < CONFIDENCE_LOW_THRESHOLD,
        }
        requests.append(record)
    return requests


if __name__ == "__main__":
    from clean_data import build_district_table
    districts = build_district_table()
    requests = generate_synthetic_requests(districts, n_total=750)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(requests, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(requests)} synthetic requests to {OUTPUT_PATH}")
