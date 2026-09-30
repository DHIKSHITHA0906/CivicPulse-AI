// frontend/src/api.js — the one file that talks to the backend (Master
// Reference Section 6.1). A backend schema change touches this file only.
// Every exported function name, parameter shape, and response shape below
// matches Section 5.2 / 6.1 exactly. Internally: mock-first (Section 6 of
// the earlier build spec) — set VITE_USE_MOCKS=false once the backend is
// live; no caller code changes either way, because the shapes don't change.

import { CATEGORIES, SUB_CATEGORY_EXAMPLES, RECOMMENDATION_TYPES, DISTRICTS, CONFIDENCE_LOW_THRESHOLD } from "./constants";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";
const MOCK_LATENCY_MS = 450;
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? "";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uuid4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Internal mock data generation (Section 3.1 / 4.2 / 4.3 shapes, produced
// client-side for demo purposes — this is what Member 1/2's real functions
// will eventually produce; only api.js knows the difference).
// ---------------------------------------------------------------------------

const ORIGINAL_TEXT_SAMPLE = {
  ta: "எங்கள் பகுதியில் தண்ணீர் இல்லை",
  kn: "ನಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ನೀರು ಇಲ್ಲ",
  hi: "हमारे क्षेत्र में पानी नहीं है",
  en: "There is no water in our area",
};

// Sample report text per category, used only to make the mock requests
// list (and its detail modal) read realistically — never sent anywhere,
// purely local demo flavor for a field that's otherwise blank in mocks.
const SAMPLE_REPORTS = {
  water: "There has been no piped water supply in our street for over a week.",
  healthcare: "The nearest clinic has been out of basic medicines for over a month.",
  education: "Our school has no functioning toilets for the students.",
  roads: "The road near the market has a large pothole causing accidents.",
  sanitation: "Garbage has not been collected from our street in two weeks.",
  other: "There is an ongoing issue in our area that needs attention.",
};

function mockCitizenRequest({ text, audio_base64, language_hint, district_id } = {}) {
  const rng = seedRandom((text?.length ?? 0) * 13 + (audio_base64 ? 29 : 0) + (Date.now() % 1000));
  const district = DISTRICTS.find((d) => d.district_id === district_id) ?? pick(rng, DISTRICTS.filter((d) => d.state === "Tamil Nadu"));
  const category = pick(rng, CATEGORIES);
  const subOptions = SUB_CATEGORY_EXAMPLES[category];
  const confidence = Number((0.55 + rng() * 0.43).toFixed(2));
  const language = language_hint || "ta";

  return {
    request_id: uuid4(),
    language,
    original_text: text || ORIGINAL_TEXT_SAMPLE[language] || ORIGINAL_TEXT_SAMPLE.en,
    translated_text: text ? `Translation: ${text}` : ORIGINAL_TEXT_SAMPLE.en,
    category,
    sub_category: subOptions.length ? pick(rng, subOptions) : "general",
    district: district.name,
    district_id: district.district_id,
    latitude: district.lat + (rng() - 0.5) * 0.15,
    longitude: district.long + (rng() - 0.5) * 0.15,
    severity: 1 + Math.floor(rng() * 5),
    affected_population: rng() > 0.1 ? Math.floor(200 + rng() * 4800) : null,
    confidence,
    timestamp: new Date().toISOString(),
    is_synthetic: true,
    needs_review: confidence < CONFIDENCE_LOW_THRESHOLD,
  };
}

function mockRequestsList({ district_id, category } = {}) {
  const rng = seedRandom((district_id?.length ?? 3) * 31 + (category?.length ?? 5) * 7);
  const pool = district_id ? DISTRICTS.filter((d) => d.district_id === district_id) : DISTRICTS;
  const count = 8 + Math.floor(rng() * 14);
  return Array.from({ length: count }).map((_, i) => {
    const district = pick(rng, pool.length ? pool : DISTRICTS);
    const cat = category || pick(rng, CATEGORIES);
    const subOptions = SUB_CATEGORY_EXAMPLES[cat];
    const confidence = Number((0.5 + rng() * 0.48).toFixed(2));
    return {
      request_id: uuid4(),
      language: pick(rng, ["ta", "kn", "hi", "en"]),
      original_text: SAMPLE_REPORTS[cat],
      translated_text: SAMPLE_REPORTS[cat],
      category: cat,
      sub_category: subOptions.length ? pick(rng, subOptions) : "general",
      district: district.name,
      district_id: district.district_id,
      latitude: district.lat + (rng() - 0.5) * 0.18,
      longitude: district.long + (rng() - 0.5) * 0.18,
      severity: 1 + Math.floor(rng() * 5),
      affected_population: rng() > 0.15 ? Math.floor(150 + rng() * 5000) : null,
      confidence,
      timestamp: new Date(Date.now() - Math.floor(rng() * 20) * 86400000).toISOString(),
      is_synthetic: true,
      needs_review: confidence < CONFIDENCE_LOW_THRESHOLD,
      _request_index: i,
    };
  });
}

const EXPLANATION_TEMPLATES = {
  NEW_INTERVENTION: (district, cat) =>
    `${district} (${cat}) shows high citizen demand with no existing project on record; this is a top-quintile priority for the state.`,
  ACCELERATE: (district, cat) =>
    `${district} (${cat}) has a planned project, but demand is growing faster than the current timeline accounts for.`,
  MONITOR: (district, cat) =>
    `${district} (${cat}) shows moderate demand with an active project already addressing this area.`,
  REVIEW_EXPAND: (district, cat) =>
    `${district} (${cat}) demand pattern suggests the existing project's scope may need to be revisited.`,
  CONSIDER_REDIRECT: (district, cat) =>
    `${district} (${cat}) demand has fallen relative to the investment already committed here.`,
  NO_ACTION_FLAGGED: (district, cat) =>
    `${district} (${cat}) signals are too sparse or inconsistent to act on with confidence yet.`,
};

const REASON_TEMPLATES = {
  NEW_INTERVENTION: "No existing project found; priority is in the top 20% for this state.",
  ACCELERATE: "Planned project exists but demand growth outpaces its current timeline.",
  MONITOR: "Active project already in progress and demand is within its capacity.",
  REVIEW_EXPAND: "Existing project's recorded scope may not match current demand.",
  CONSIDER_REDIRECT: "Demand has dropped relative to the investment already made.",
  NO_ACTION_FLAGGED: "Signal volume or consistency is too low to act on confidently.",
};

// Produces the already-merged shape /api/priority/{district_id} returns
// (Section 5.2's deliberate convenience — PriorityScore + Recommendation
// joined per category before the frontend ever sees it).
function mockPriorityList(district_id) {
  const rng = seedRandom((district_id?.length ?? 4) * 53);
  const district = DISTRICTS.find((d) => d.district_id === district_id) ?? DISTRICTS[0];
  return CATEGORIES.map((category) => {
    const priority_score = Number(rng().toFixed(2));
    const confidence = Number((0.55 + rng() * 0.44).toFixed(2));
    const recommendation_type = pick(rng, RECOMMENDATION_TYPES);
    return {
      category,
      priority_score,
      confidence,
      explanation_text: EXPLANATION_TEMPLATES[recommendation_type](district.name, category.replace("_", " ")),
      recommendation_type,
      reason_text: REASON_TEMPLATES[recommendation_type],
    };
  }).sort((a, b) => b.priority_score - a.priority_score);
}

function mockRecommendationsList(district_id) {
  const districts = district_id ? DISTRICTS.filter((d) => d.district_id === district_id) : DISTRICTS;
  return districts.flatMap((district) => {
    const rng = seedRandom(district.district_id.length * 71);
    return CATEGORIES.map((category) => {
      const recommendation_type = pick(rng, RECOMMENDATION_TYPES);
      return {
        district_id: district.district_id,
        category,
        recommendation_type,
        reason_text: REASON_TEMPLATES[recommendation_type],
      };
    });
  });
}

// ---------------------------------------------------------------------------
// Cache-on-failure wrapper (spec: dashboard API failure → last successful
// response instead of a blank screen; friendly message only, never a raw
// stack trace). Callers get { data, error, isCached }.
// ---------------------------------------------------------------------------
const CACHE_PREFIX = "civicpulse.cache.";

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {
    // Best-effort only — quota/private-mode failures shouldn't break the app.
  }
}

async function withFallback(cacheKey, fetcher) {
  try {
    const data = await fetcher();
    writeCache(cacheKey, data);
    return { data, error: null, isCached: false };
  } catch {
    const cached = readCache(cacheKey);
    if (cached) return { data: cached, error: "stale", isCached: true };
    return { data: null, error: "unavailable", isCached: false };
  }
}

async function liveGet(path) {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown", message: "Request failed" }));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

async function livePost(path, body) {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Public API — exact names/signatures from Section 6.1.
// ---------------------------------------------------------------------------

// POST /api/submit-request → returns the full CitizenRequest (Section 2.1 / 5.2).
export async function submitRequest({
  text,
  audio_base64,
  language_hint,
  district_id,
  latitude,
  longitude,
}) {
  try {
    const data = USE_MOCKS
      ? (
          await delay(MOCK_LATENCY_MS),
          mockCitizenRequest({
            text,
            audio_base64,
            language_hint,
            district_id,
            latitude,
            longitude,
          })
        )
      : await livePost("/api/submit-request", {
          text,
          audio_base64,
          language_hint,
          district_id,
          latitude,
          longitude,
        });

    return { data, error: null };
  } catch (err) {
    return { data: null, error: "unavailable", message: err.message };
  }
}

// GET /api/requests?district_id=&category= → { requests: [...] }
export async function getRequests({ district_id, category } = {}) {
  const cacheKey = `requests:${district_id || ""}:${category || ""}`;
  return withFallback(cacheKey, async () => {
    if (USE_MOCKS) {
      await delay(MOCK_LATENCY_MS);
      return { requests: mockRequestsList({ district_id, category }) };
    }
    const params = new URLSearchParams();
    if (district_id) params.set("district_id", district_id);
    if (category) params.set("category", category);
    return liveGet(`/api/requests?${params.toString()}`);
  });
}

// GET /api/priority/{district_id} → { priorities: [...] } (merged PriorityScore + Recommendation per category)
export async function getPriority(district_id) {
  const cacheKey = `priority:${district_id}`;
  return withFallback(cacheKey, async () => {
    if (USE_MOCKS) {
      await delay(MOCK_LATENCY_MS);
      return { priorities: mockPriorityList(district_id) };
    }
    return liveGet(`/api/priority/${encodeURIComponent(district_id)}`);
  });
}

// GET /api/recommendations?district_id= → { recommendations: [...] }
export async function getRecommendations({ district_id } = {}) {
  const cacheKey = `recommendations:${district_id || "all"}`;
  return withFallback(cacheKey, async () => {
    if (USE_MOCKS) {
      await delay(MOCK_LATENCY_MS);
      return { recommendations: mockRecommendationsList(district_id) };
    }
    const params = new URLSearchParams();
    if (district_id) params.set("district_id", district_id);
    return liveGet(`/api/recommendations?${params.toString()}`);
  });
}
