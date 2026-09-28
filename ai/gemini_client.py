import os
from dotenv import load_dotenv
from google import genai

load_dotenv()


def get_gemini_client():
    """
    Creates Gemini client.
    """

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise ValueError("GEMINI_API_KEY not found")

    client = genai.Client(
        api_key=api_key
    )

    return client



def send_gemini_request(prompt):
    """
    Sends prompt to Gemini and returns text response.
    """

    client = get_gemini_client()

    response = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=prompt,
    config={
        "automatic_function_calling": {
            "disable": True
        }
    }
)

    return response.text