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
- **`timediff` property**: In responses from `getCompetitions` and `getCompetitionInfo`, the `timediff` property represents the number of hours that the competition's timezone is ahead (+) or behind (-) compared to Central European Time (CET).
- **`start` property**: In responses from `getClassResults` and `getClubResults`, the `start` property represents the start time for the runner in hundreds of seconds since midnight.

### getcompetitions

Example response

``` json
{ 
    "competitions" :
    [
        {
            "id" : 10278, 
            "name" : "Demo #1", 
            "organizer" : "TestOrganizer", 
            "date" : "2012-06-01",
            "timediff" : 0
        },
        {
            "id" : 10279, 
            "name" : "Demo #2", 
            "organizer" : "TestOrganizer", 
            "date" : "2012-06-02",
            "timediff" : 1,
            "multidaystage" : 1,
            "multidayfirstday" : 10278
        }
    ]
}
```

### getclassresults

Example response:

``` json
{
   "status": "OK",
   "className": "Gul h",
   "splitcontrols": [],
   "results": [
      {
         "place": "1",
         "name": "Anton Mörkfors",
         "club": "Järfälla OK",
         "result": "17:02",
         "status": 0,
         "timeplus": "+00:00",
         "progress": 100,
         "start": 6840000
      },
      {
         "place": "2",
         "name": "Leif Mörkfors",
         "club": "Järfälla OK",
         "result": "18:23",
         "status": 0,
         "timeplus": "+01:21",
         "progress": 100,
         "start": 6840000
      },
      {
         "place": "3",
         "name": "Martin Kvarnefalk",
         "club": "Järfälla OK",
         "result": "21:07",
         "status": 0,
         "timeplus": "+04:05",
         "progress": 100,
         "start": 6840000
      }
   ],
   "hash": "883fae6e4b8f0727b6ffabb7c403277c"
}
```
#### getclassresults

This is how getclassresults changes for a runner during a competion

| Property | 10:02:55 | 14:25:33 | 14:27:40 | 14:32:57 | 14:35:03 | 14:44:01 | 14:46:07 | 14:48:45 | 14:50:52 | 15:10:22 | 15:11:57 | 15:14:04 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **status** | `10` | → `9` | | | | | | | | | → `0` | |
| **progress** | `0` | | | → `20` | | → `40` | | → `60` | | → `80` | → `100` | |
| **place** | `""` | | | | | | | | | | → `"1"` | |
| **result** | `""` | | | | | | | | | | → `"43:18"` | |
| **timeplus** | `"+"` | | | | | | | | | | → `"+00:00"` | |
| **DT_RowClass** | — | + `new_result` | removed | + `new_result` | removed | + `new_result` | removed | + `new_result` | removed | + `new_result` | `new_result` | removed |
| **1065** (split) | `""` | | | → `26900` | | | | | | | | |
| **1065_status** | `1` | | | → `0` | | | | | | | | |
| **1065_place** | `""` | | | → `2` | | | | | | | | |
| **1065_timeplus** | — | | | + `1100` | | | | | | | | |
| **1050** (split) | `""` | | | | | → `94800` | | | | | | |
| **1050_status** | `1` | | | | | → `0` | | | | | | |
| **1050_place** | `""` | | | | | → `18` | | | | | | |
| **1050_timeplus** | — | | | | | + `29100` | | | | | | |
| **1074** (split) | `""` | | | | | | | → `122700` | | | | |
| **1074_status** | `1` | | | | | | | → `0` | | | | |
| **1074_place** | `""` | | | | | | | → `8` | | | | |
| **1074_timeplus** | — | | | | | | | + `17500` | | | | |
| **1090** (split) | `""` | | | | | | | | | → `252700` | | |
| **1090_status** | `1` | | | | | | | | | → `0` | | |
| **1090_place** | `""` | | | | | | | | | → `1` | | |
| **1090_timeplus** | — | | | | | | | | | + `0` | | |

**Key observations:**
- The first update (10:02:55) is the **initial state** (not yet started, status=10).
- At 14:25:33 status changes to `9` (started/running). The `DT_RowClass: "new_result"` flag toggles on/off in pairs — it marks "something changed" and is cleared on the next poll.
- Splits arrive in order: **1065** → **1050** → **1074** → **1090**, each bumping progress by 20%.
- At 15:11:57 the runner **finishes**: status → `0`, result `"43:18"`, place `"1"`, timeplus `"+00:00"` — **1st place**.
- Unchanged properties (`name`, `club`, `start`) are omitted from the table.

### Runner status

0 - OK
1 - DNS (Did Not Start)
2 - DNF (Did not finish)
3 - MP (Missing Punch)
4 - DSQ (Disqualified)
5 - OT (Over (max) time)
9 - Not Started Yet
10 - Not Started Yet
11 - Walk Over (Resigned before the race started)
12 - Moved up (The runner have been moved to a higher class)

## Dev Notes

- Environment via .env for Firebase keys; do not commit secrets.
- Validate minimal footprint (analyze bundle size). Prefer Preact + Vite swap if size is critical.
- Keep code comments sparse and purposeful.
