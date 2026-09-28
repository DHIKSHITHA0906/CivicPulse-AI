def generate_explanation(priority_record):
    """
    Generates human-readable explanation
    for a citizen request priority.
    """

    category = priority_record.get(
        "category",
        "general"
    )

    priority = priority_record.get(
        "priority",
        "medium"
    )

    confidence = priority_record.get(
        "confidence",
        0.0
    )


    explanation = (
        f"This request is classified as "
        f"{category}. "
        f"It has been assigned {priority} "
        f"priority based on the available "
        f"request information. "
        f"The AI confidence score is "
        f"{confidence}."
    )

    return explanation