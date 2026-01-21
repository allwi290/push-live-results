import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, requestNotificationPermission } from './firebase'
import type { SelectionPayload } from '../types/live-results'

export async function saveSelection(payload: SelectionPayload) {
  const id = `${payload.userId}-${payload.competitionId}-${payload.className}`
  
  // Get FCM token for push notifications
  let fcmToken: string | undefined
  try {
    fcmToken = (await requestNotificationPermission()) || undefined
  } catch (error) {
    console.warn('Could not get FCM token:', error)
  }
  
  await setDoc(doc(db, 'selections', id), {
    ...payload,
    fcmToken,
    createdAt: serverTimestamp(),
  })
}
