"""
Member 2 — clean_data.py
Builds the District table (Section 2.2 of the interface doc) from raw source data.

Run once, offline, from the repo root:
    python scripts/clean_data.py

Output: data/districts.csv  (this is what Member 3's Firestore loader script reads)
"""

import csv
import os
import re

RAW_SEED_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "districts_seed.csv")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "districts.csv")


def slugify(name: str) -> str:
    """'Bengaluru Urban' -> 'bengaluru-urban' — matches Section 0's district_id rule."""
    slug = name.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _to_float_or_none(value):
    value = (value or "").strip()
    if value == "" or value.lower() == "na":
        return None
    return float(value)


def _to_int_or_none(value):
    value = (value or "").strip()
    if value == "" or value.lower() == "na":
        return None
    return int(float(value))


def build_district_table() -> list[dict]:
    """
    Returns a list of District dicts (Section 2.2), cleaned and joined from
    all real source datasets.

    For now this reads data/districts_seed.csv, a small placeholder set of
    Tamil Nadu / Karnataka districts with roughly plausible numbers so the
    rest of the pipeline is testable end to end. Before final submission,
    replace the seed CSV with your real merged data (Census 2011 handbooks,
    data.gov.in, state open-data portals) — the function signature and
    output shape don't need to change.
    """
    districts = []
    with open(RAW_SEED_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["name"].strip()
            record = {
                "district_id": slugify(name),
                "name": name,
                "state": row["state"].strip(),
                "lat": float(row["lat"]),
                "long": float(row["long"]),
                "population": int(float(row["population"])),
                "hospital_count": int(float(row["hospital_count"])),
                "school_count": _to_int_or_none(row.get("school_count")),
                "road_density_km": _to_float_or_none(row.get("road_density_km")),
                "avg_rainfall_mm": _to_float_or_none(row.get("avg_rainfall_mm")),
            }
            districts.append(record)
    return districts


def save_districts_csv(districts: list[dict], path: str = OUTPUT_PATH) -> None:
    fieldnames = ["district_id", "name", "state", "lat", "long", "population",
                  "hospital_count", "school_count", "road_density_km", "avg_rainfall_mm"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(districts)


if __name__ == "__main__":
    districts = build_district_table()
    save_districts_csv(districts)
    print(f"Wrote {len(districts)} districts to {OUTPUT_PATH}")
