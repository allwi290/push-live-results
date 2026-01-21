# Push Live Results

A minimal mobile-first web application for receiving push notifications about orienteering competition results. Built with Firebase and integrated with the LiveResults API.

## Architecture

```
┌─────────────┐
│   Frontend  │ (Preact + TypeScript + Tailwind)
│  (Firebase  │
│   Hosting)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Cloud     │ API Proxy + Cache + Notifications
│  Functions  │
└──────┬──────┘
       │
       ├────────────┐
       │            │
       ▼            ▼
┌─────────────┐  ┌─────────────┐
│  Firestore  │  │ LiveResults │
│             │  │     API     │
│  - Cache    │  │             │
│  - Users    │  └─────────────┘
└─────────────┘
       │
       ▼
┌─────────────┐
│     FCM     │ Push Notifications
│ (Messaging) │
└─────────────┘
```

## Features

- **Mobile-First UI**: Optimized for mobile devices
- **Push Notifications**: Real-time alerts for followed runners
- **Efficient Polling**: Hash-based polling to minimize data transfer
- **Smart Caching**: 15-second cache with Firestore backend
- **Data Retention**: 7-day result retention, automatic cleanup
- **Firebase Auth**: Google and email authentication

## Tech Stack

### Frontend (`/app`)
- **Preact** - Lightweight React alternative (3KB)
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS
- **Firebase SDK** - Auth, Firestore, Messaging

Bundle size: ~107KB gzipped

### Backend (`/functions`)
- **Firebase Cloud Functions** - Serverless API
- **TypeScript** - Type safety
- **Firestore** - NoSQL database for caching
- **FCM** - Push notifications
- **LiveResults API** - External data source

## Project Structure

```
push-live-results/
├── app/                    # Frontend application
│   ├── src/
│   │   ├── services/       # Firebase, API clients
│   │   ├── types/          # TypeScript definitions
│   │   ├── app.tsx         # Main component
│   │   └── main.tsx        # Entry point
│   ├── public/
│   └── package.json
│
├── functions/              # Cloud Functions
│   ├── src/
│   │   ├── index.ts        # Function exports
│   │   ├── liveResultsClient.ts
│   │   ├── cache.ts
│   │   ├── notifications.ts
│   │   └── types.ts
│   └── package.json
│
├── firebase.json           # Firebase configuration
├── .firebaserc            # Firebase project
└── architecture.puml      # System diagram
```

## Getting Started

### Prerequisites

- Node.js 18+ (functions require Node 24)
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with Blaze (pay-as-you-go) plan

### 1. Clone and Install

```bash
git clone <repository-url>
cd push-live-results

# Install frontend dependencies
cd app
npm install

# Install functions dependencies
cd ../functions
npm install
```

### 2. Firebase Setup

```bash
# Login to Firebase
firebase login

# Create a new project or use existing
firebase projects:create push-live-results
# or
firebase use --add

# Enable required services in Firebase Console:
# - Authentication (Google, Email/Password)
# - Cloud Firestore
# - Cloud Messaging
# - Cloud Functions
# - Hosting
```

### 3. Environment Configuration

Create `app/.env.local`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key

# For local development with emulators:
VITE_BACKEND_API_URL=http://127.0.0.1:5001/push-live-results/us-central1/api

# For production (after first deploy):
# VITE_BACKEND_API_URL=https://us-central1-push-live-results.cloudfunctions.net/api
```

Get these values from Firebase Console → Project Settings.

For VAPID key:
```bash
firebase projects:create
# Go to Cloud Messaging tab → Web Push certificates → Generate key pair
```

### 4. Local Development

#### Option A: With Firebase Emulators (Recommended)

```bash
# Start emulators (from root directory)
firebase emulators:start

# In another terminal, start frontend dev server
cd app
npm run dev
```

Access at: http://localhost:5173

#### Option B: Frontend Only

```bash
cd app
npm run dev
```

Note: This requires backend functions to be deployed first.

### 5. Build

```bash
# Build frontend
cd app
npm run build

# Build functions
cd ../functions
npm run build
```

### 6. Deploy

```bash
# Deploy everything (from root directory)
firebase deploy

# Or deploy individually:
firebase deploy --only hosting
firebase deploy --only functions
```

After first deployment, update `VITE_BACKEND_API_URL` in `app/.env.local` to point to your deployed function URL.

## Development

### Frontend Development

```bash
cd app
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run format       # Format with Prettier
```

### Functions Development

```bash
cd functions
npm run build        # Compile TypeScript
npm run build:watch  # Watch mode
npm run serve        # Start with emulator
npm run lint         # Run ESLint
npm run deploy       # Deploy to Firebase
```

## API Endpoints

The Cloud Functions expose a unified API endpoint:

### `GET /api`

Query parameters:
- `method` - API method (required)
- `comp` - Competition ID (for some methods)
- `class` - Class name (for some methods)
- `last_hash` - Hash from previous response (optional)

**Methods:**

#### `getcompetitions`
Get list of all competitions.

```
GET /api?method=getcompetitions
```

#### `getclasses`
Get classes for a competition.

```
GET /api?method=getclasses&comp=12345&last_hash=abc123
```

#### `getclassresults`
Get results for a class. Triggers notifications on changes.

```
GET /api?method=getclassresults&comp=12345&class=M21E&last_hash=abc123
```

#### `getlastpassings`
Get most recent control passings.

```
GET /api?method=getlastpassings&comp=12345&last_hash=abc123
```

**Response Format:**

```json
{
  "status": "OK" | "NOT MODIFIED" | "ERROR",
  "hash": "abc123",
  "data": [...]
}
```

## Data Model

### Firestore Collections

#### `selections`
User selections for notifications.

```typescript
{
  userId: string
  competitionId: string
  className: string
  runnerNames: string[]
  fcmToken?: string
  createdAt: Timestamp
}
```

Document ID: `{userId}-{competitionId}-{className}`

#### `api_cache`
Cached API responses.

```typescript
{
  hash: string
  data: any
  timestamp: number
}
```

Document ID: Cache key from query parameters

## Push Notifications

Notifications are sent when:
- A followed runner appears in results (started)
- Result/time changes
- Place changes
- Status changes (DNS, DNF, MP, DSQ, OT)

Notification payload:
```json
{
  "title": "M21E Update",
  "body": "John Doe - 45:23",
  "data": {
    "competitionId": "12345",
    "className": "M21E",
    "runnerName": "John Doe"
  }
}
```

## Scheduled Tasks

### `cleanCache`
Runs daily at 2 AM UTC. Removes cache entries older than 7 days.

### `cleanSelections`
Runs daily at 3 AM UTC. Removes user selections older than 30 days.

## Cost Optimization

- `maxInstances: 10` limits concurrent function containers
- 15-second cache TTL matches upstream API
- Hash-based polling reduces bandwidth
- Automatic cleanup prevents data accumulation
- Frontend bundle optimized to ~107KB gzipped

## Deployment with GitHub Actions

The repository includes a GitHub Actions workflow that automatically deploys to Firebase on push to `main`.

### Setup

1. Generate a Firebase service account key:
   ```bash
   firebase login:ci
   ```

2. Add the token to GitHub Secrets as `FIREBASE_SERVICE_ACCOUNT_PUSH_LIVE_RESULTS`

3. Push to `main` branch - deployment happens automatically

## Testing

### Manual Testing

1. Start emulators: `firebase emulators:start`
2. Open http://localhost:5173
3. Sign in with Google or email
4. Select a competition and class
5. Follow some runners
6. Check browser console for FCM token
7. Verify data in Firestore emulator (http://localhost:4000)

### Testing Notifications

1. Get FCM token from browser console
2. Use Firebase Console → Cloud Messaging → Send test message
3. Or trigger from functions by updating results

## Troubleshooting

### Build Issues

**Error: Cannot find module 'graphql'**
- Add `"skipLibCheck": true` to `functions/tsconfig.json`

**Frontend build fails**
- Clear `app/node_modules` and reinstall
- Check `app/.env.local` has all required variables

### Runtime Issues

**Functions not receiving requests**
- Check CORS is enabled on function
- Verify `VITE_BACKEND_API_URL` points to correct endpoint
- Check Firebase Console → Functions → Logs

**Notifications not working**
- Verify VAPID key is correct
- Check browser notification permissions
- Ensure FCM token is saved to Firestore
- Check Functions logs for notification errors

**Data not updating**
- Check hash-based polling is working (cache key)
- Verify external LiveResults API is accessible
- Check Firestore rules allow read/write

## LiveResults API

This project integrates with the LiveResults API:
- Docs: https://liveresults.github.io/documentation/api.html
- Endpoint: http://liveresultat.orientering.se/api.php

The API is cached at 15-second intervals and supports hash-based polling.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linters: `npm run lint`
5. Test locally with emulators
6. Submit a pull request

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
