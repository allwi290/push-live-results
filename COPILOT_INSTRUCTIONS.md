# Copilot Instructions: Minimal Mobile-Only Frontend

Goal: Build a minimal, mobile-only web client for live orienteering push notifications using Firebase services and the LiveResults API.

## Scope

- Mobile-first UI only (optimize for small viewports; no desktop extras).
- Core flows: auth, select country → competition → class → runners (or entire class), edit followed runners, view live class results.
- Push notifications for followed runners; data retention cleared after event ends (user data removed), results remain available for 7 days post-event end.

## Tech Choices

- Framework: lightweight React (TS) or Preact (TS) with Vite for small footprint.
- Styling: Tailwind or minimalist utility CSS; avoid large UI kits.
- Firebase: Auth (social + email), Cloud Messaging, Firestore (or Realtime DB) for selections, Cloud Functions for notification logic, Hosting for deploy.

## Frontend Guidance

- Mobile-first layout, minimal JS/CSS; limit bundle size (code-splitting, tree-shaking).
- Components: Login gate → Event selector (country/competition/class) → Runner selector (multi-select + “follow all”) → Follow list editor → Live results view per class.
- Request notification permission post-login; surface token errors gracefully.- **Frontend calls our backend API only** (Cloud Functions), never directly to external LiveResults API.- Poll or listen to backend updates for class results; keep result page live-updating.
- Keep forms touch-friendly; use cached selections locally to reduce reads.

## Data/Retention Rules

- Store only what’s needed: user profile id, notification token, followed runners/classes, event id, timestamp.
- Backend caches LiveResults data (countries, competitions, classes, results) in Firestore.
- On event end: delete user-specific selection + tokens; keep class results available for 7 days, then purge cached data.

## Backend (Firebase Functions)

- Expose REST API endpoints: `/api/countries`, `/api/competitions`, `/api/classes`, `/api/results`
- Poll external LiveResults API using **hash-based updates** to minimize transfer (see API docs).
- Cache responses in Firestore with TTL/hash tracking.
- Detect result changes → fan-out FCM notifications to users following affected runners.
- Cron/trigger to detect event end → purge user selections/tokens, schedule cached results expiry (7 days).

## External API Reference

- LiveResults API: <https://liveresults.github.io/documentation/api.html>
- Use hash parameter to minimize data transfer on polling.

## Dev Notes

- Environment via .env for Firebase keys; do not commit secrets.
- Validate minimal footprint (analyze bundle size). Prefer Preact + Vite swap if size is critical.
- Keep code comments sparse and purposeful.
