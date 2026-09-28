from .schemas import CitizenRequest


def fallback_request(text=None, language_hint=None):

    text = text or "Unable to extract request"

    text_lower = text.lower()


    if any(word in text_lower for word in [
        "garbage",
        "waste",
        "trash",
        "dustbin",
        "cleaning"
    ]):
        category = "sanitation"


    elif any(word in text_lower for word in [
        "water",
        "pipeline",
        "supply"
    ]):
        category = "water"


    elif any(word in text_lower for word in [
        "light",
        "streetlight",
        "electricity"
    ]):
        category = "electricity"


    elif any(word in text_lower for word in [
        "road",
        "pothole",
        "damage"
    ]):
        category = "road"


    else:
        category = "general"


    return CitizenRequest(
        category=category,
        description=text,
        location=None,
        language=language_hint or "unknown",
        priority="medium",
        confidence=0.5,
        needs_review=True
    ).to_dict()