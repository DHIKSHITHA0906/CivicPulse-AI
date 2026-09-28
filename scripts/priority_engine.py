"""
Member 2 — priority_engine.py

compute_priority(district_id, category) -> dict matching PriorityScore
minus explanation_text and computed_at.

Priority formula from the locked CivicPulse AI build spec:

raw_score =
    0.30 * citizen_demand
    + 0.30 * infrastructure_gap
    + 0.20 * population_affected
    + 0.10 * environmental_vulnerability
    - 0.10 * existing_investment

priority_score = raw_score * confidence_factor

All input components are normalized within the same state before weighting,
with infrastructure_gap using the specification's direct gap formula.

Missing values are replaced with the appropriate state/category median.

Low-confidence requests (< 0.6) are excluded from live aggregate scoring.
"""

import csv
import json
import os
import statistics
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "shared"))

from constants import (
    CONFIDENCE_LOW_THRESHOLD,
    EXISTING_INVESTMENT_MAP,
    PRIORITY_HIGH_PERCENTILE,
    PRIORITY_MODERATE_PERCENTILE,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_cache = {}


# ---------------------------------------------------------------------
# DATA LOADING
# ---------------------------------------------------------------------

def _load_requests() -> list[dict]:
    if "requests" not in _cache:
        path = os.path.join(DATA_DIR, "synthetic_requests.json")

        with open(path, encoding="utf-8") as f:
            _cache["requests"] = json.load(f)

    return _cache["requests"]


def _load_districts() -> dict:
    if "districts" not in _cache:
        path = os.path.join(DATA_DIR, "districts.csv")

        with open(path, encoding="utf-8") as f:
            _cache["districts"] = {
                row["district_id"]: row
                for row in csv.DictReader(f)
            }

    return _cache["districts"]


def _load_projects() -> list[dict]:
    if "projects" not in _cache:
        path = os.path.join(DATA_DIR, "government_projects.csv")

        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                _cache["projects"] = list(csv.DictReader(f))
        else:
            _cache["projects"] = []

    return _cache["projects"]


# ---------------------------------------------------------------------
# SMALL HELPERS
# ---------------------------------------------------------------------

def _safe_float(value, default=None):
    try:
        if value is None or value == "":
            return default

        return float(value)

    except (TypeError, ValueError):
        return default


def _clip(
    value: float,
    low: float = 0.0,
    high: float = 1.0,
) -> float:
    return max(low, min(high, value))


def _median_or_default(
    values: list[float],
    default: float = 0.5,
) -> float:
    values = [
        value
        for value in values
        if value is not None
    ]

    if not values:
        return default

    return float(statistics.median(values))


def _minmax_normalize(
    value: float,
    peer_values: list[float],
    flat_value: float = 0.5,
) -> float:
    """
    Min-max normalization within the same state/category.

    When all peer values are identical, there is no relative
    difference, so a neutral midpoint is used.
    """
    values = [
        value
        for value in peer_values
        if value is not None
    ]

    if not values:
        return flat_value

    lo = min(values)
    hi = max(values)

    if hi == lo:
        return flat_value

    return _clip(
        (value - lo) / (hi - lo)
    )


# ---------------------------------------------------------------------
# GOVERNMENT INVESTMENT
# ---------------------------------------------------------------------

def _project_status(
    district_id: str,
    category: str,
) -> str:
    """
    Returns the existing project status:

        none    -> 0.0
        planned -> 0.5
        active  -> 1.0

    If multiple projects exist, active takes precedence over planned.
    """
    statuses = []

    for project in _load_projects():

        if (
            project.get("district_id") == district_id
            and project.get("category") == category
        ):
            statuses.append(
                project.get("status", "none")
            )

    if "active" in statuses:
        return "active"

    if "planned" in statuses:
        return "planned"

    return "none"


# ---------------------------------------------------------------------
# REQUEST FILTERING
# ---------------------------------------------------------------------

def _eligible_requests(
    district_id: str,
    category: str,
) -> list[dict]:
    """
    Low-confidence requests are excluded from live aggregate scoring.
    """
    result = []

    for request in _load_requests():

        if (
            request.get("district_id") != district_id
            or request.get("category") != category
        ):
            continue

        confidence = _safe_float(
            request.get("confidence")
        )

        if confidence is None:
            continue

        if confidence < CONFIDENCE_LOW_THRESHOLD:
            continue

        result.append(request)

    return result


# ---------------------------------------------------------------------
# CITIZEN DEMAND
# ---------------------------------------------------------------------

def _citizen_demand_raw(
    district_id: str,
    category: str,
) -> float | None:
    """
    Severity-weighted count of eligible requests.

    Each request contributes its severity (1–5).
    """
    requests = _eligible_requests(
        district_id,
        category,
    )

    if requests:
        return float(
            sum(
                _safe_float(
                    request.get("severity"),
                    0.0,
                )
                for request in requests
            )
        )

    return None


# ---------------------------------------------------------------------
# POPULATION AFFECTED
# ---------------------------------------------------------------------

def _population_affected_raw(
    district_id: str,
    category: str,
) -> float | None:
    """
    Affected population normalized by district population.
    """
    districts = _load_districts()
    district = districts.get(district_id)

    if district is None:
        return None

    district_population = _safe_float(
        district.get("population")
    )

    if (
        district_population is None
        or district_population <= 0
    ):
        return None

    requests = _eligible_requests(
        district_id,
        category,
    )

    affected_values = []

    for request in requests:

        affected = _safe_float(
            request.get("affected_population")
        )

        if (
            affected is not None
            and affected >= 0
        ):
            affected_values.append(affected)

    if not affected_values:
        return None

    total_affected = sum(
        affected_values
    )

    return _clip(
        total_affected / district_population
    )


# ---------------------------------------------------------------------
# INFRASTRUCTURE DENSITY
# ---------------------------------------------------------------------

def _facility_density(
    district: dict,
    category: str,
) -> float | None:
    """
    Returns the facility-density measure available for the category.

    healthcare -> hospital_count / population
    education  -> school_count / population
    roads      -> road_density_km

    Water and sanitation use optional prepared fields when available.
    If unavailable, the state/category median is used later.
    """
    population = _safe_float(
        district.get("population")
    )

    if category == "healthcare":

        count = _safe_float(
            district.get("hospital_count")
        )

        if (
            count is not None
            and population
            and population > 0
        ):
            return count / population

    elif category == "education":

        count = _safe_float(
            district.get("school_count")
        )

        if (
            count is not None
            and population
            and population > 0
        ):
            return count / population

    elif category == "roads":

        return _safe_float(
            district.get("road_density_km")
        )

    elif category == "water":

        for field in (
            "water_facility_density",
            "water_point_density",
            "water_facility_count",
            "water_point_count",
        ):
            value = _safe_float(
                district.get(field)
            )

            if value is not None:

                if (
                    "count" in field
                    and population
                    and population > 0
                ):
                    return value / population

                return value

    elif category == "sanitation":

        for field in (
            "sanitation_facility_density",
            "sanitation_facility_count",
            "drainage_density",
        ):
            value = _safe_float(
                district.get(field)
            )

            if value is not None:

                if (
                    "count" in field
                    and population
                    and population > 0
                ):
                    return value / population

                return value

    return None


def _infrastructure_gap_raw(
    district_id: str,
    category: str,
    state_district_ids: list[str],
) -> float | None:
    """
    Locked specification formula:

        infrastructure_gap =
            1 - (facility_density / state_median_density)

    Final value is clipped to [0, 1].
    """
    districts = _load_districts()

    densities = []

    for d_id in state_district_ids:

        density = _facility_density(
            districts[d_id],
            category,
        )

        if density is not None:
            densities.append(density)

    if not densities:
        return None

    state_median_density = statistics.median(
        densities
    )

    if state_median_density <= 0:
        return None

    own_density = _facility_density(
        districts[district_id],
        category,
    )

    if own_density is None:
        return None

    return _clip(
        1.0
        - (
            own_density
            / state_median_density
        )
    )


# ---------------------------------------------------------------------
# ENVIRONMENTAL VULNERABILITY
# ---------------------------------------------------------------------

def _environmental_raw(
    district_id: str,
    state_district_ids: list[str],
) -> float | None:
    """
    Uses average rainfall as the available environmental indicator.
    """
    districts = _load_districts()

    own_value = _safe_float(
        districts[district_id].get(
            "avg_rainfall_mm"
        )
    )

    peer_values = []

    for d_id in state_district_ids:

        value = _safe_float(
            districts[d_id].get(
                "avg_rainfall_mm"
            )
        )

        if value is not None:
            peer_values.append(value)

    if own_value is None:

        own_value = _median_or_default(
            peer_values,
            default=0.0,
        )

    if not peer_values:
        return None

    return own_value


# ---------------------------------------------------------------------
# CONFIDENCE FACTOR
# ---------------------------------------------------------------------

def _confidence_factor(
    district_id: str,
    category: str,
) -> float:
    """
    Uses the average extraction confidence of eligible requests.

    Required range:
        0.5 to 1.0

    Therefore:
        average confidence 0.90 -> factor 0.90
        average confidence 0.40 -> factor 0.50
    """
    requests = _eligible_requests(
        district_id,
        category,
    )

    if not requests:
        return 0.5

    confidences = []

    for request in requests:

        confidence = _safe_float(
            request.get("confidence")
        )

        if confidence is not None:
            confidences.append(
                _clip(confidence)
            )

    if not confidences:
        return 0.5

    average_confidence = (
        sum(confidences)
        / len(confidences)
    )

    return _clip(
        average_confidence,
        0.5,
        1.0,
    )


# ---------------------------------------------------------------------
# COMPONENT BUILDING
# ---------------------------------------------------------------------

def _component_values(
    district_id: str,
    category: str,
) -> tuple[dict[str, float], float]:

    districts = _load_districts()
    district = districts.get(district_id)

    if district is None:

        return {
            "citizen_demand": 0.5,
            "infrastructure_gap": 0.5,
            "population_affected": 0.5,
            "environmental_vulnerability": 0.5,
        }, 0.5

    state = district["state"]

    state_district_ids = [
        d_id
        for d_id, d in districts.items()
        if d["state"] == state
    ]

    # -----------------------------------------------------------------
    # CITIZEN DEMAND
    # -----------------------------------------------------------------

    demand_raw = {}

    for d_id in state_district_ids:

        demand_raw[d_id] = _citizen_demand_raw(
            d_id,
            category,
        )

    demand_nonmissing = [
        value
        for value in demand_raw.values()
        if value is not None
    ]

    demand_median = _median_or_default(
        demand_nonmissing,
        default=0.0,
    )

    for d_id in state_district_ids:

        if demand_raw[d_id] is None:
            demand_raw[d_id] = demand_median

    citizen_demand = _minmax_normalize(
        demand_raw[district_id],
        list(demand_raw.values()),
    )

    # -----------------------------------------------------------------
    # INFRASTRUCTURE GAP
    # -----------------------------------------------------------------

    gap_raw = {}

    for d_id in state_district_ids:

        gap_raw[d_id] = _infrastructure_gap_raw(
            d_id,
            category,
            state_district_ids,
        )

    gap_nonmissing = [
        value
        for value in gap_raw.values()
        if value is not None
    ]

    gap_median = _median_or_default(
        gap_nonmissing,
        default=0.5,
    )

    for d_id in state_district_ids:

        if gap_raw[d_id] is None:
            gap_raw[d_id] = gap_median

    # IMPORTANT:
    # The specification already defines infrastructure_gap as:
    # 1 - (facility_density / state_median_density)
    #
    # Do NOT min-max normalize this value again.

    infrastructure_gap = _clip(
        gap_raw[district_id]
    )

    # -----------------------------------------------------------------
    # POPULATION AFFECTED
    # -----------------------------------------------------------------

    population_raw = {}

    for d_id in state_district_ids:

        population_raw[d_id] = _population_affected_raw(
            d_id,
            category,
        )

    population_nonmissing = [
        value
        for value in population_raw.values()
        if value is not None
    ]

    population_median = _median_or_default(
        population_nonmissing,
        default=0.0,
    )

    for d_id in state_district_ids:

        if population_raw[d_id] is None:
            population_raw[d_id] = population_median

    population_affected = _minmax_normalize(
        population_raw[district_id],
        list(population_raw.values()),
    )

    # -----------------------------------------------------------------
    # ENVIRONMENTAL VULNERABILITY
    # -----------------------------------------------------------------

    environmental_raw = {}

    for d_id in state_district_ids:

        environmental_raw[d_id] = _environmental_raw(
            d_id,
            state_district_ids,
        )

    environmental_nonmissing = [
        value
        for value in environmental_raw.values()
        if value is not None
    ]

    environmental_median = _median_or_default(
        environmental_nonmissing,
        default=0.0,
    )

    for d_id in state_district_ids:

        if environmental_raw[d_id] is None:
            environmental_raw[d_id] = environmental_median

    environmental_vulnerability = _minmax_normalize(
        environmental_raw[district_id],
        list(environmental_raw.values()),
    )

    return {
        "citizen_demand": citizen_demand,
        "infrastructure_gap": infrastructure_gap,
        "population_affected": population_affected,
        "environmental_vulnerability": environmental_vulnerability,
    }, _confidence_factor(
        district_id,
        category,
    )


# ---------------------------------------------------------------------
# FINAL PRIORITY SCORE
# ---------------------------------------------------------------------

def compute_priority(
    district_id: str,
    category: str,
) -> dict:
    """
    Returns:

    {
        "district_id": str,
        "category": str,
        "raw_score": float,
        "priority_score": float,
        "confidence": float,
    }

    Never intentionally raises and never returns NaN.
    """
    try:

        districts = _load_districts()

        if district_id not in districts:

            return {
                "district_id": district_id,
                "category": category,
                "raw_score": 0.0,
                "priority_score": 0.0,
                "confidence": 0.5,
            }

        components, confidence_factor = (
            _component_values(
                district_id,
                category,
            )
        )

        project_status = _project_status(
            district_id,
            category,
        )

        existing_investment = (
            EXISTING_INVESTMENT_MAP.get(
                project_status,
                0.0,
            )
        )

        # -------------------------------------------------------------
        # LOCKED BUILD-SPEC FORMULA
        # -------------------------------------------------------------

        raw_score = (
            0.30
            * components["citizen_demand"]

            + 0.30
            * components["infrastructure_gap"]

            + 0.20
            * components["population_affected"]

            + 0.10
            * components["environmental_vulnerability"]

            - 0.10
            * existing_investment
        )

        priority_score = (
            raw_score
            * confidence_factor
        )

        return {
            "district_id": district_id,
            "category": category,
            "raw_score": round(
                raw_score,
                4,
            ),
            "priority_score": round(
                priority_score,
                4,
            ),
            "confidence": round(
                confidence_factor,
                4,
            ),
        }

    except Exception:

        return {
            "district_id": district_id,
            "category": category,
            "raw_score": 0.0,
            "priority_score": 0.0,
            "confidence": 0.5,
        }


# ---------------------------------------------------------------------
# RUNTIME PERCENTILE TIER
# ---------------------------------------------------------------------

def _percentile(
    sorted_values: list[float],
    percentile: float,
) -> float:

    if not sorted_values:
        return 0.0

    if len(sorted_values) == 1:
        return sorted_values[0]

    position = (
        percentile
        * (len(sorted_values) - 1)
    )

    lower = int(position)

    upper = min(
        lower + 1,
        len(sorted_values) - 1,
    )

    fraction = position - lower

    return (
        sorted_values[lower]
        + (
            sorted_values[upper]
            - sorted_values[lower]
        )
        * fraction
    )


def priority_tier(
    district_id: str,
    category: str,
    priority_score: float,
) -> str:
    """
    Runtime percentile thresholds within the district's state:

        top 20% -> high
        50th–80th percentile -> moderate
        below 50th percentile -> low
    """
    districts = _load_districts()

    district = districts.get(
        district_id
    )

    if district is None:
        return "low"

    state = district["state"]

    peer_ids = [
        d_id
        for d_id, d in districts.items()
        if d["state"] == state
    ]

    peer_scores = sorted(
        compute_priority(
            d_id,
            category,
        )["priority_score"]
        for d_id in peer_ids
    )

    if not peer_scores:
        return "low"

    high_threshold = _percentile(
        peer_scores,
        PRIORITY_HIGH_PERCENTILE,
    )

    moderate_threshold = _percentile(
        peer_scores,
        PRIORITY_MODERATE_PERCENTILE,
    )

    if priority_score >= high_threshold:
        return "high"

    if priority_score >= moderate_threshold:
        return "moderate"

    return "low"


# ---------------------------------------------------------------------
# STANDALONE TEST
# ---------------------------------------------------------------------

if __name__ == "__main__":

    districts = _load_districts()

    for district_id in list(districts)[:4]:

        for category in [
            "water",
            "healthcare",
        ]:

            result = compute_priority(
                district_id,
                category,
            )

            tier = priority_tier(
                district_id,
                category,
                result["priority_score"],
            )

            print(
                district_id,
                category,
                result,
                "tier:",
                tier,
            )