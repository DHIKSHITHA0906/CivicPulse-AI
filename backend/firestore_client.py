import os
import json

import firebase_admin
from firebase_admin import credentials, firestore


if not firebase_admin._apps:
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

    if service_account_json:
        service_account_info = json.loads(service_account_json)
        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred)
    else:
        # Local development: use the Firebase service-account file
        from pathlib import Path

        ROOT_DIR = Path(__file__).resolve().parent
        SERVICE_ACCOUNT = ROOT_DIR / "civicpulse-ai-50f1a-firebase-adminsdk-fbsvc-d213f8259c.json"

        if SERVICE_ACCOUNT.exists():
            cred = credentials.Certificate(str(SERVICE_ACCOUNT))
            firebase_admin.initialize_app(cred)
        else:
            # Cloud environments using Application Default Credentials
            firebase_admin.initialize_app()


db = firestore.client()


def save_request(request_data: dict):
    request_id = request_data["request_id"]
    db.collection("citizen_requests").document(request_id).set(request_data)
    return request_data


def get_requests(
    district_id: str | None = None,
    category: str | None = None,
):
    query = db.collection("citizen_requests")

    if district_id:
        query = query.where("district_id", "==", district_id)

    if category:
        query = query.where("category", "==", category)

    return [doc.to_dict() for doc in query.stream()]