import json
from .gemini_client import send_gemini_request
from .fallback import fallback_request


def repair_json(response_text):
    """
    Repairs common Gemini JSON formatting issues.
    """

    try:
        return json.loads(response_text)

    except Exception:

        # Remove markdown code blocks
        cleaned = response_text.replace("```json", "")
        cleaned = cleaned.replace("```", "")
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)

        except Exception:
            return None



def build_prompt(text, language_hint):
    """
    Creates Gemini extraction prompt.
    """

    return f"""
You are an AI assistant for a citizen complaint platform.

Extract the citizen request into JSON.

Supported languages:
Tamil, Kannada, Hindi, English.

Return ONLY valid JSON.

Required fields:

{{
"category":"",
"description":"",
"location":"",
"language":"",
"priority":"",
"confidence":0.0,
"needs_review":false
}}

Citizen input:

{text}

Language hint:
{language_hint}

Rules:
- confidence must be between 0 and 1
- needs_review true if uncertain
- priority can be low, medium, high
"""



def extract_request(
        text=None,
        audio_base64=None,
        language_hint=None
):
    """
    Main AI extraction interface.

    Accepts:
    - text input
    - audio input placeholder
    - language hint

    Returns:
    Structured CitizenRequest dictionary
    """

    try:

        # Audio processing will be integrated later
        # For now Gemini receives extracted text

        if audio_base64 and not text:
            text = "Audio request received. Transcription required."

        if not text:
            return fallback_request(
                text="Empty citizen request",
                language_hint=language_hint
            )


        prompt = build_prompt(
            text,
            language_hint
        )


        response = send_gemini_request(prompt)


        result = repair_json(response)


        if result is None:
            raise Exception("Invalid Gemini JSON")


        return result


    except Exception as e:

        print(
            "Gemini extraction failed:",
            e
        )

        return fallback_request(
            text=text,
            language_hint=language_hint
        )