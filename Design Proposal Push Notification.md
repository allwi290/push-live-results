# Design Proposal: Push Notification Engine (Updated)

## Overview

The system implements a push notification engine for live orienteering results using Firebase Cloud Functions. Based on the current implementation analysis, this document outlines the validated architecture.

## Architecture: Event-Driven with Cache-Based Change Detection

The implementation uses **Firestore caching + FCM** instead of Pub/Sub, which is more suitable for this use case:
- Lower cost (Pub/Sub charges per message, Firestore operations are cheaper)
- Simpler architecture (fewer moving parts)
- No need for separate polling infrastructure
- Natural integration with Firebase ecosystem

## Module 1: API Proxy & Change Detection

**Implementation**: Two Cloud Functions working together

### A. `api` (HTTP triggered) - On-Demand Detection
**Responsibilities**:
1. **Proxy LiveResults API** - Provides caching layer for frontend
2. **Hash-based change detection** - Uses API's built-in hash mechanism
3. **Immediate notification dispatch** - Triggers notifications on detected changes

**Operation Flow**:
```
Client Request → api() → Check Firestore Cache
                     ↓
            Cache Miss/Expired?
                     ↓
            Fetch from LiveResults API
                     ↓
            Compare hash with cached version
                     ↓
            Data changed? → notifyResultChanges()
                     ↓
            Update cache → Return to client
```

### B. `pollActiveSelections` (Scheduled) - Background Polling
**Responsibilities**:
1. **Query active user selections** - Find competitions/classes users are following
2. **Poll LiveResults API** - Check for updates even when no clients connected
3. **Trigger notifications** - Send push notifications on changes

**Operation Flow**:
```
Every minute:
  ↓
Query active selections (< 24h old)
  ↓
Group by (competitionId, className)
  ↓
For each unique combination:
  ↓
Fetch current results from API
  ↓
Compare with cached data (hash)
  ↓
Changes detected? → notifyResultChanges()
  ↓
Update cache with new hash/data
```

**Polling Strategy**:
- **Frequency**: Every minute during active events
- **Selection age filter**: Only poll for selections created within last 24 hours
- **Deduplication**: One API call per unique competition/class (not per user)
- **Auto-stop**: Selections older than 24h are ignored (event likely finished)

### Key Features:
- **Dual detection** - Both on-demand (client requests) and background (scheduled)
- **Hash-based efficiency** - LiveResults API returns "NOT MODIFIED" with hash if unchanged
- **Smart caching TTLs**:
  - Competitions: 1 hour (rarely change)
  - Classes: 15 minutes (fairly stable)
  - Results: 15 seconds (frequent updates during events)
- **Cost-effective** - Background polling only for active selections

### Cache Key Strategy:
```typescript
getCacheKey({method: "getclassresult", comp: 1234, class: "H21"})
// → "getclassresult_comp_1234_class_H21"
```

## Module 2: Push Notification Delivery

**Implementation**: `notifications.ts` module, called by `api` function

### Responsibilities:
1. **Query user selections** - Find who follows specific competition/class
2. **Detect meaningful changes** - Compare old vs new results per runner
3. **Send FCM notifications** - Deliver to user devices via Firebase Cloud Messaging

### Change Detection Logic:
```typescript
// Notify on:
- Place change (e.g., 3rd → 2nd)
- Time change (new split time)
- Status change (e.g., OK → DNF)
- Progress update (e.g., 50% → 75%)
```Functions

**1. `pollActiveSelections`** - Every 30 seconds
- Queries active user selections (< 24h old)
- Polls LiveResults API for each unique competition/class
- Sends push notifications on changes
- **Critical for push notifications without active clients**

**2. `cleanCache`** - Daily at 2 AM UTC
- Removes cache entries older than 7 days
- Prevents storage bloat

**3a: {competitionId, className, runnerName}
```

## Data Storage

### Firestore Collections:

**1. `api_cache`** (TTL-based)
- Stores API responses with hash and timestamp
- Automatic expiration via scheduled cleanup
- Keys: `method_comp_X_class_Y`

**2. `selections`** (user preferences)
- Schema:
  ```typescript
  {
    userId: string
    competitionId: string
    className: string
    runnerNames: string[]
    fcmToken: string
    createdAt: timestamp
  }
  ```
- Cleaned up 30 days after creation

## Scheduled Maintenance

**1. `cleanCache`** - Daily at 2 AM UTC
- Removes cache entries older than 7 days
- Prevents storage bloat

**2. `cleanSelections`** - Daily at 3 AM UTC
- Removes user selections older than 30 days
- Auto-cleanup after events end
topics per class) | Low (single scheduled function) |
| **Latency** | Polling interval delay | Immediate on client request + 1min background |
| **Scaling** | Need subscription management | Firebase handles automatically |
| **Data retention** | 72h in Pub/Sub | 7 days in Firestore (configurable) |
| **Deduplication** | Manual per-topic management | Automatic grouping by comp/class |
| **Notification guarantee** | Yes (background polling) | Yes (dual: on-demand + scheduled
| **Cost** | High (per-message charges) | Low (Firestore + FCM free tiers) |
| **Complexity** | High (separate polling workers) | Low (integrated with API proxy) |
| **Latency** | Polling interval delay | Immediate on client request |
| **SPolling frequency** - 30-second intervals balance cost vs latency
   - *Mitigation*: On-demand detection provides immediate updates when clients active
   - *Future*: Dynamic polling frequency based on event activitye periods) |

## Limitations & Considerations

1. **No active polling** - Notifications only trigger when clients request data
   - *Mitigation*: Frontend keeps screen awake during events
   - *Future*: Add optional scheduled polling for high-priority selections

2. **Single-region by default** - Firebase Functions default to us-central1
   - *Mitigation*: Low latency for most users
   - *Future*: Multi-region deployment if needed

3. **FCM token management** - Tokens can expire/change
   - *Handled*: Error handling removes invalid tokens
   - *Future*: Add token refresh mechanism

## Security & Privacy

- **Authentication**: Firebase Auth required for selections
- **Data isolation**: Users can only access their own selections
- **Token storage**: FCM tokens securely stored in Firestore
- **Auto-cleanup**: Old selections removed after 30 days

## Performance Characteristics

- **Cold start**: ~1-2 seconds for first function invocation
- **Warm invocation**: <200ms for cached responses
- **Notification delivery**: <1 second via FCM
- **Max concurrent requests**: 10 instances (cost control)

## Future Enhancements
Dynamic polling frequency** - Increase frequency for active events, decrease for quiet periods
2. **Webhook support** - Direct integration with LiveResults event notifications
3. **Analytics** - Track notification delivery rates and user engagement
4. **Batch notifications** - Combine multiple changes for same user
5. **Smart polling windows** - Only poll during typical event hours (e.g., 08:00-20:00 local time)ement
4. **Batch notifications** - Combine multiple changes for same user