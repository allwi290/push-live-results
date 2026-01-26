import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db, requestNotificationPermission } from './firebase'

export async function saveSelections(
  userId: string,
  competitionId: string,
  className: string,
  runnerNames: string[]
) {
  // Get FCM token for push notifications
  let fcmToken: string | undefined
  try {
    fcmToken = (await requestNotificationPermission()) || undefined
  } catch (error) {
    console.warn('Could not get FCM token:', error)
  }

  const batch = writeBatch(db)

  for (const runnerName of runnerNames) {
    const id = `${userId}-${competitionId}-${className}-${runnerName.replace(/[^a-zA-Z0-9]/g, '_')}`
    const docRef = doc(db, 'selections', id)
    
    batch.set(docRef, {
      userId,
      competitionId,
      className,
      runnerName,
      fcmToken,
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
}
