# Push Live Results (mobile-first)

Minimal mobile-only frontend for orienteering push notifications. Built with Vite + Preact + Tailwind, Firebase (Auth, Messaging, Firestore), and the LiveResults API.

## Stack

- Vite + Preact + TypeScript
- Tailwind CSS (mobile-first utilities)
- Firebase Auth, Cloud Messaging, Firestore
- LiveResults API (<https://liveresults.github.io/documentation/api.html>)

## Prereqs

- Node 18+
- Firebase project with Auth, Cloud Messaging, Firestore enabled

## Setup

1. Install deps

```sh
npm install
```

1. Configure env

```sh
cp .env.example .env
# fill VITE_FIREBASE_* values + VAPID key
```

1. Run dev server

```sh
npm run dev
```

1. Build for prod

```sh
npm run build
```

## Firebase hosting (optional)

- `npm install -g firebase-tools`
- `firebase login`
- `firebase init hosting` (pick existing project)
- Deploy: `npm run build && firebase deploy --only hosting`

## Data retention expectations

- App stores minimal user selection (user id, competition/class, runner ids, notification token).
- Backend/Cloud Functions should purge user selections when an event ends and drop result data after 7 days.

## Architecture Notes

- **Frontend does NOT call external LiveResults API directly**. Instead, it calls our backend API (Cloud Functions).
- **Backend (Cloud Functions)** polls LiveResults API using hash-based updates to minimize transfer, caches data in Firestore, and serves it to the frontend.
- `src/services/liveResults.ts` calls our backend API (`VITE_BACKEND_API_URL`); set this in `.env` to point to your Cloud Functions endpoint.
- UI is mobile-first; keep bundles small. If footprint is critical, swap to Preact signals and trim unused Firebase SDKs.
