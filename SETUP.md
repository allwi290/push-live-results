# Setup Checklist

Complete setup guide for Push Live Results project.

## ✅ Prerequisites

- [ ] Node.js 18+ installed
- [ ] Firebase CLI installed: `npm install -g firebase-tools`
- [ ] Firebase project created (Blaze plan recommended)
- [ ] Git repository cloned

## ✅ Firebase Project Setup

### 1. Create/Select Project
```bash
firebase login
firebase projects:create push-live-results
# or use existing project
firebase use --add
```

### 2. Enable Firebase Services

In Firebase Console (https://console.firebase.google.com):

- [ ] **Authentication**
  - [ ] Enable Google Sign-In
  - [ ] Enable Email/Password
  - [ ] Add authorized domain for hosting

- [ ] **Cloud Firestore**
  - [ ] Create database (start in production mode)
  - [ ] Set up security rules:
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Allow users to read/write their own selections
        match /selections/{selectionId} {
          allow read, write: if request.auth != null && 
            selectionId.matches('^' + request.auth.uid + '-.*');
        }
        
        // API cache is read-only for clients (written by functions)
        match /api_cache/{cacheKey} {
          allow read: if request.auth != null;
          allow write: if false;
        }
      }
    }
    ```

- [ ] **Cloud Messaging**
  - [ ] Go to Project Settings → Cloud Messaging
  - [ ] Web Push certificates → Generate key pair
  - [ ] Copy VAPID key for `.env.local`

- [ ] **Cloud Functions**
  - [ ] Enable (automatic on first deploy)
  - [ ] Ensure billing is enabled (Blaze plan)

- [ ] **Hosting**
  - [ ] Enable (automatic on first deploy)

### 3. Get Firebase Configuration

From Firebase Console → Project Settings → General → Your apps:

- [ ] Copy configuration values
- [ ] Note down for `.env.local` file

## ✅ Local Setup

### 1. Install Dependencies

```bash
# Frontend
cd app
npm install

# Functions
cd ../functions
npm install
```

### 2. Configure Environment

Create `app/.env.local` with your Firebase config:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=push-live-results.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=push-live-results
VITE_FIREBASE_STORAGE_BUCKET=push-live-results.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123
VITE_FIREBASE_VAPID_KEY=BKqY...

# For local development:
VITE_BACKEND_API_URL=http://127.0.0.1:5001/push-live-results/us-central1/api
```

- [ ] All Firebase config values added
- [ ] VAPID key added
- [ ] Backend API URL configured

### 3. Test Local Build

```bash
# Build frontend
cd app
npm run build
# Should see: dist/assets/index-*.js (~107KB gzipped)

# Build functions
cd ../functions
npm run build
# Should compile without errors
```

## ✅ Local Development Testing

### Option 1: Firebase Emulators (Recommended)

```bash
# From project root
firebase emulators:start

# In another terminal
cd app
npm run dev
```

- [ ] Emulators started successfully
- [ ] Frontend accessible at http://localhost:5173
- [ ] Emulator UI at http://localhost:4000

### Option 2: Deploy First, Then Dev

```bash
# Deploy functions first
firebase deploy --only functions

# Update app/.env.local with deployed function URL
# VITE_BACKEND_API_URL=https://us-central1-push-live-results.cloudfunctions.net/api

# Start dev server
cd app
npm run dev
```

## ✅ First Deployment

### 1. Build Everything

```bash
# Build frontend
cd app
npm run build

# Build functions
cd ../functions
npm run build
```

### 2. Deploy to Firebase

```bash
# From project root
firebase deploy

# Or deploy separately:
firebase deploy --only hosting
firebase deploy --only functions
```

- [ ] Hosting deployed successfully
- [ ] Functions deployed successfully
- [ ] Note function URLs from deploy output

### 3. Update Production URL

Update `app/.env.local` for production:

```env
VITE_BACKEND_API_URL=https://us-central1-push-live-results.cloudfunctions.net/api
```

Then rebuild and redeploy frontend:

```bash
cd app
npm run build
cd ..
firebase deploy --only hosting
```

## ✅ GitHub Actions Setup (Optional)

### 1. Get Firebase Token

```bash
firebase login:ci
# Copy the token
```

### 2. Add to GitHub Secrets

- [ ] Go to GitHub repository → Settings → Secrets
- [ ] Add new secret: `FIREBASE_SERVICE_ACCOUNT_PUSH_LIVE_RESULTS`
- [ ] Paste the token

### 3. Test Workflow

- [ ] Push to `main` branch
- [ ] Check Actions tab for deployment status
- [ ] Verify deployment succeeded

## ✅ Verification Testing

### 1. Test Authentication

- [ ] Open deployed app URL
- [ ] Sign in with Google
- [ ] Sign out
- [ ] Sign in with Email/Password

### 2. Test Data Flow

- [ ] Select a competition
- [ ] Select a class
- [ ] Follow some runners
- [ ] Check Firestore Console for `selections` document
- [ ] Verify FCM token saved

### 3. Test API Endpoints

```bash
# Test competitions endpoint
curl "https://us-central1-push-live-results.cloudfunctions.net/api?method=getcompetitions"

# Should return JSON with competitions list
```

### 4. Test Notifications

- [ ] Follow a runner
- [ ] Grant notification permissions in browser
- [ ] Use Firebase Console → Cloud Messaging → Send test
- [ ] Or wait for real results to update

### 5. Test Cache

- [ ] Make API request
- [ ] Check Firestore Console for `api_cache` documents
- [ ] Verify hash and timestamp fields
- [ ] Make same request again (should use cache)

## ✅ Scheduled Functions Setup

In Firebase Console → Functions:

- [ ] Verify `cleanCache` function exists
- [ ] Verify `cleanSelections` function exists
- [ ] Check logs for scheduled runs (daily at 2 AM and 3 AM UTC)

## ✅ Monitoring Setup

### 1. Firebase Console

- [ ] Functions → Logs - Check for errors
- [ ] Firestore → Data - Verify data structure
- [ ] Hosting → Usage - Check traffic

### 2. Set Up Alerts (Optional)

In Firebase Console → Alerts:

- [ ] Function execution errors
- [ ] Firestore quota exceeded
- [ ] Hosting bandwidth exceeded

## ✅ Production Checklist

Before going live:

- [ ] Environment variables set correctly
- [ ] Firebase security rules configured
- [ ] Notification permissions requested properly
- [ ] Error handling implemented
- [ ] Bundle size optimized (~107KB gzipped)
- [ ] CORS configured on functions
- [ ] Domain verified in Firebase Auth
- [ ] Monitoring and alerts configured
- [ ] README documentation complete
- [ ] GitHub Actions deployment working

## ✅ Optional Enhancements

- [ ] Custom domain setup (Firebase Hosting)
- [ ] Analytics integration (GA4)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] PWA manifest and service worker
- [ ] Offline support
- [ ] Dark mode

## Troubleshooting

### Common Issues

**Functions deploy fails:**
- Ensure Node version is correct (24 for functions)
- Check billing is enabled
- Verify Firebase CLI is latest: `npm install -g firebase-tools@latest`

**Frontend can't connect to API:**
- Check CORS configuration
- Verify `VITE_BACKEND_API_URL` is correct
- Check browser console for errors
- Test API directly with curl

**Notifications not working:**
- Check browser permissions
- Verify VAPID key is correct
- Check FCM token is saved to Firestore
- Look at Functions logs for errors

**Data not caching:**
- Check Firestore security rules
- Verify Functions have correct permissions
- Check Functions logs for errors

## Support

- Firebase documentation: https://firebase.google.com/docs
- LiveResults API docs: https://liveresults.github.io/documentation/api.html
- Project issues: Create GitHub issue

---

## Summary

Once all checkboxes are complete:

✅ Firebase project configured
✅ Local development working
✅ Production deployed
✅ Testing verified
✅ Monitoring active

Your Push Live Results system is ready! 🎉
