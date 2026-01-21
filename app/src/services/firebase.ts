import { initializeApp } from 'firebase/app'
import type { User } from 'firebase/auth'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

const messagingPromise = isSupported().then((supported) =>
  supported ? getMessaging(app) : null,
)

export function listenToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  await signInWithPopup(auth, provider)
}

export async function signOutUser() {
  await signOut(auth)
}

export async function requestNotificationPermission() {
  const messaging = await messagingPromise
  if (!messaging) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications not allowed by user')
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  return getToken(messaging, vapidKey ? { vapidKey } : undefined)
}
