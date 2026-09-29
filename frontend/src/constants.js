// Mirrors shared/constants.py exactly (Master Reference, Section 1).
// Both files are committed at kickoff and updated together if ever changed —
// do not let this drift from the Python source of truth.

export const CATEGORIES = ["water", "healthcare", "education", "roads", "sanitation", "other"];

export const SUB_CATEGORY_EXAMPLES = {
  water: ["drinking_water", "irrigation", "water_quality"],
  healthcare: ["clinic_access", "medicine_shortage", "staff_shortage"],
  education: ["school_infrastructure", "teacher_shortage", "transport"],
  roads: ["road_condition", "connectivity", "traffic_safety"],
  sanitation: ["drainage", "waste_management", "public_toilets"],
  other: [],
};
// sub_category is free text in practice; the list above is guidance only,
// not a hard enum enforced by the backend.

export const LANGUAGES = ["ta", "kn", "hi", "en"]; // Tamil, Kannada, Hindi, English

export const STATES = ["Tamil Nadu", "Karnataka"];

export const RECOMMENDATION_TYPES = [
  "NEW_INTERVENTION",
  "ACCELERATE",
  "REVIEW_EXPAND",
  "MONITOR",
  "CONSIDER_REDIRECT",
  "NO_ACTION_FLAGGED",
];

export const PROJECT_STATUS = ["none", "planned", "active"];
// existing_investment numeric mapping used inside the priority formula only
// (backend-internal — the frontend never computes this, only displays status):
// "none" -> 0.0, "planned" -> 0.5, "active" -> 1.0

export const CONFIDENCE_LOW_THRESHOLD = 0.6; // extraction confidence below this -> needs_review = true
export const PRIORITY_HIGH_PERCENTILE = 0.8; // top 20% of scores in a state = "high"
export const PRIORITY_MODERATE_PERCENTILE = 0.5; // next 30% = "moderate"; below = low

// ---------------------------------------------------------------------------
// Frontend-only reference data below this line: NOT part of shared/constants.py.
// Member 2's District schema (Section 2.2) will eventually be served from
// Firestore; this local list exists purely so Submit.jsx's district dropdown
// fallback and Dashboard.jsx's district filter have something to render
// against before that pipeline is wired up (mock-first development).
export const DISTRICTS = [
  { district_id: "chennai", name: "Chennai", state: "Tamil Nadu", lat: 13.0827, long: 80.2707 },
  { district_id: "coimbatore", name: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, long: 76.9558 },
  { district_id: "madurai", name: "Madurai", state: "Tamil Nadu", lat: 9.9252, long: 78.1198 },
  { district_id: "tiruvallur", name: "Tiruvallur", state: "Tamil Nadu", lat: 13.1231, long: 79.9086 },
  { district_id: "bengaluru-urban", name: "Bengaluru Urban", state: "Karnataka", lat: 12.9716, long: 77.5946 },
  { district_id: "mysuru", name: "Mysuru", state: "Karnataka", lat: 12.2958, long: 76.6394 },
];
