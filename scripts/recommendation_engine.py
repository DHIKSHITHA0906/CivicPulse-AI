"""
Member 2 — recommendation_engine.py

compute_recommendation(priority_record) -> Recommendation dict.

The recommendation is determined from:
1. Runtime percentile priority tier
2. Existing government project status

Locked recommendation rules:

high + active   -> MONITOR
high + planned  -> ACCELERATE
high + none     -> NEW_INTERVENTION

moderate + active/planned -> REVIEW_EXPAND
moderate + none           -> CONSIDER_REDIRECT

low -> NO_ACTION_FLAGGED
"""

import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "shared"))

from constants import RECOMMENDATION_TYPES
from priority_engine import _project_status, priority_tier


def compute_recommendation(priority_record: dict) -> dict:
    """
    Input:
        priority_record returned by compute_priority()

    Returns:
        {
            "district_id": str,
            "category": str,
            "recommendation_type": str,
            "reason_text": str,
        }

    Recommendation uses the runtime percentile tier and the existing
    government-project status.
    """

    district_id = priority_record["district_id"]
    category = priority_record["category"]
    priority_score = float(priority_record["priority_score"])

    status = _project_status(
        district_id,
        category,
    )

    tier = priority_tier(
        district_id,
        category,
        priority_score,
    )

    # -----------------------------------------------------------------
    # LOCKED PART 7 RULES
    # -----------------------------------------------------------------

    if tier == "high":

        if status == "active":
            recommendation_type = "MONITOR"
            reason_text = (
                "An active project exists and priority is high; "
                "monitor implementation and outcomes."
            )

        elif status == "planned":
            recommendation_type = "ACCELERATE"
            reason_text = (
                "A project is already planned and priority is high; "
                "recommend accelerating the planned intervention."
            )

        else:
            recommendation_type = "NEW_INTERVENTION"
            reason_text = (
                "No existing project found and priority is in the "
                "top 20% for this state."
            )

    elif tier == "moderate":

        if status in ("active", "planned"):
            recommendation_type = "REVIEW_EXPAND"
            reason_text = (
                "An existing project is present and priority is moderate; "
                "review the project for possible expansion."
            )

        else:
            recommendation_type = "CONSIDER_REDIRECT"
            reason_text = (
                "No existing project found and priority is moderate; "
                "consider redirecting resources toward higher-priority needs."
            )

    else:
        recommendation_type = "NO_ACTION_FLAGGED"
        reason_text = (
            "Priority is currently below the moderate threshold "
            "for this state."
        )

    assert recommendation_type in RECOMMENDATION_TYPES

    return {
        "district_id": district_id,
        "category": category,
        "recommendation_type": recommendation_type,
        "reason_text": reason_text,
    }


if __name__ == "__main__":
    from priority_engine import compute_priority, _load_districts

    districts = _load_districts()

    for district_id in list(districts)[:4]:
        for category in ["water", "healthcare"]:

            priority_record = compute_priority(
                district_id,
                category,
            )

            recommendation = compute_recommendation(
                priority_record,
            )

            print(recommendation)