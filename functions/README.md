# Push Live Results - Cloud Functions

Backend Cloud Functions for the Push Live Results system. Provides API proxy, caching, and push notification services.

## Architecture

```
Frontend → Cloud Functions API → LiveResults API
                ↓
         Firestore Cache
                ↓
         FCM Notifications
```

## Functions

### 1. `api` (HTTP)
API proxy endpoint that caches LiveResults API responses in Firestore.

**Endpoints:**
- `GET /api?method=getcompetitions`
- `GET /api?method=getclasses&comp=<id>&last_hash=<hash>`
- `GET /api?method=getclassresults&comp=<id>&class=<name>&last_hash=<hash>`
- `GET /api?method=getlastpassings&comp=<id>&last_hash=<hash>`

**Features:**
- Hash-based polling to minimize data transfer
- 15-second cache TTL matching LiveResults API
- Automatic notification sending on result changes

### 2. `cleanCache` (Scheduled)
Runs daily at 2 AM UTC to remove cache entries older than 7 days.

### 3. `cleanSelections` (Scheduled)
Runs daily at 3 AM UTC to remove user selections older than 30 days.

## Development

### Install dependencies
```bash
npm install
```

### Build
```bash
npm run build
```

### Run locally with emulator
```bash
npm run serve
```

### Deploy
```bash
npm run deploy
```

## Environment Setup

The functions use Firebase Admin SDK which automatically authenticates when deployed to Firebase.

For local development with emulators, set:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
```

## Data Model

### Firestore Collections

#### `api_cache`
Stores cached API responses with hash and timestamp.

```typescript
{
  hash: string
  data: any
  timestamp: number
}
```

#### `selections`
User competition/class/runner selections for notifications.

```typescript
{
  userId: string
  competitionId: string
  className: string
  runnerNames: string[]
  fcmToken?: string
  createdAt: timestamp
}
```

## Notification Logic

When `getclassresults` detects changes:
1. Compare old and new results
2. Find users following affected runners
3. Send FCM notifications for:
   - New runner started
   - Result/time changed
   - Place changed
   - Status changed (DNS, DNF, etc.)

## Cost Optimization

- `maxInstances: 10` to limit concurrent containers
- 15-second cache matches upstream API
- Hash-based polling reduces unnecessary data transfer
- Scheduled cleanup prevents data accumulation
