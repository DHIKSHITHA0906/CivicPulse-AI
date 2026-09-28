# CivicPulse AI — Frontend (Member 4)

React + Leaflet/OpenStreetMap frontend, built exactly against the team's
**Master Interface Reference** (function names, field names, and API shapes
below are not open to reinterpretation — a mismatch there is the integration
bug to fix, not something to work around here).

## Structure

```
frontend/src/api.js                    # The one file that talks to the backend
frontend/src/constants.js              # Mirrors shared/constants.py
frontend/src/pages/Submit.jsx          # Citizen submission page
frontend/src/pages/Dashboard.jsx       # Policymaker dashboard
frontend/src/components/Map.jsx        # Leaflet + OSM, markers colored/sized by severity
frontend/src/components/PriorityPanel.jsx  # Renders the merged /api/priority shape directly
```

`ConfidenceGauge.jsx`, `SeverityDonut.jsx`, `SeverityMeter.jsx`, `RequestsTable.jsx`,
`RequestDetailModal.jsx`, `Modal.jsx`, `Skeleton.jsx`, `StatRow.jsx`,
`LiveWaveform.jsx`, `AudioPlayer.jsx`, `labels.js`, and
`SyntheticBanner.jsx` are presentation-only helpers, not part of the
contract surface — they all render fields already returned by `api.js`,
nothing invented.

## What's on each screen

**Submit** — 4-language switcher, text or voice input (with a live
recording timer/waveform), geolocation with a district-dropdown fallback,
distinct error states for a denied microphone vs. a failed submission, and
a full result view including the `needs_review` flag.

**Dashboard** — district/category filters, a 5-card KPI row (open requests,
avg. confidence, demand hotspots, top priority, needs-review count), a
Leaflet map with severity-colored/sized markers and click-to-open request
detail, a severity-distribution donut chart, a recent-requests table, and
the ranked priority list with an inline explanation/recommendation panel.
Every screen has a loading-skeleton state, an empty state (no results for
the current filters), and a cached/error banner (Section 7).

## Run locally

```bash
npm install
npm run dev
```

Runs entirely on mocked data matching the exact response shapes below — no
backend required yet.

## Switch to the live backend

Copy `.env.example` to `.env`, set `VITE_USE_MOCKS=false` and
`VITE_BACKEND_BASE_URL` to Member 3's deployed base URL. No component code
changes — every component already reads the exact field names the real API
returns.

## API contract (Master Reference Section 5.2 / 6.1)

| Function (`api.js`) | Endpoint | Returns |
|---|---|---|
| `submitRequest({ text, audio_base64, language_hint })` | `POST /api/submit-request` | full `CitizenRequest` |
| `getRequests({ district_id, category })` | `GET /api/requests` | `{ requests: [...] }` |
| `getPriority(district_id)` | `GET /api/priority/{district_id}` | `{ priorities: [...] }` — **PriorityScore + Recommendation already merged per category** |
| `getRecommendations({ district_id })` | `GET /api/recommendations` | `{ recommendations: [...] }` |

Field names are never renamed client-side: `district_id`, `latitude`,
`longitude`, `severity` (int 1–5), `affected_population` (nullable),
`confidence`, `is_synthetic`, `needs_review`, `priority_score` (0.0–1.0),
`explanation_text`, `recommendation_type`, `reason_text` all flow straight
from the API response into the components that render them.

## Categories & recommendation types (`constants.js`, mirrors `shared/constants.py`)

- `CATEGORIES`: water, healthcare, education, roads, sanitation, other
- `RECOMMENDATION_TYPES`: NEW_INTERVENTION, ACCELERATE, REVIEW_EXPAND, MONITOR, CONSIDER_REDIRECT, NO_ACTION_FLAGGED

If either list changes in `shared/constants.py`, update `constants.js` in the
same commit.

## Error handling

- Missing/undetected location → district dropdown fallback on Submit (note:
  this is a UI affordance only — `extract_request()` infers `district` from
  the submitted text itself, so there's currently no request parameter to
  pass a user-picked district through; the dropdown is ready for that once
  the contract adds one).
- Any dashboard API failure → last successful response served from
  `localStorage` instead of a blank screen, with a visible notice.
- `needs_review: true` on a submission surfaces a plain-language notice
  ("flagged for manual review") rather than a raw confidence number.

## Deploy (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

## Visual system

Dark cinematic palette defined as tokens at the top of `src/index.css`:
charcoal/black ground, graphite surfaces, ivory ink, copper as the single
interactive accent, sage for calm signals, and a brick → amber → straw → sage
severity ramp. The severity colors also live in `components/mapSeverity.js`
(used by the map, donut and marker cards) — change both together.
Type: Newsreader (headlines, figures) + Hanken Grotesk (UI), with Noto Sans
fallbacks for Tamil, Kannada and Devanagari.

## Voice recorder (Submit)

Recording still uses `MediaRecorder`, and the submitted payload is still the
same `audio_base64` passed to `submitRequest()` in `api.js`. The live waveform
reads the mic stream through a Web Audio `AnalyserNode` for display only, the
player plays the local object URL, and recordings stop automatically at 2
minutes (`MAX_RECORD_SECONDS` in `Submit.jsx`).
