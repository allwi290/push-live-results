import { doc, serverTimestamp, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db, requestNotificationPermission } from './firebase'
import type { Competition, ResultEntry } from '../types/live-results'

/**
 * Calculate the runner's start time from competition date, runner's start property, and timezone offset
 * @param competitionDate - Competition date in YYYY-MM-DD format
 * @param runnerStart - Runner's start time in hundreds of seconds since midnight CET
 * @param timediff - Competition timezone offset from CET in hours (defaults to 0)
 * @returns Unix timestamp in milliseconds, or undefined if runnerStart is not provided
 */
function calculateStartTime(
  competitionDate: string,
  runnerStart: number | undefined,
  timediff = 0
): number | undefined {
  if (runnerStart === undefined) {
    return undefined
  }

  // Parse competition date (format: YYYY-MM-DD)
  const [year, month, day] = competitionDate.split('-').map(Number)
  
  // Create date at midnight UTC
  const date = new Date(Date.UTC(year, month - 1, day))
  
  // Add the runner's start time (hundreds of seconds since midnight CET)
  const startMilliseconds = runnerStart * 10
  date.setTime(date.getTime() + startMilliseconds)
  
  // Apply timezone offset (timediff is offset from CET in hours) 
  const timezoneOffsetMs = (timediff - 1) * 3600000
  date.setTime(date.getTime() + timezoneOffsetMs)
  
  return date.getTime()
}

export async function addSelection(
  userId: string,
  competitionId: string,
  className: string,
  runnerName: string,
  competition?: Competition,
  runner?: ResultEntry
): Promise<void> {
  // Get FCM token for push notifications
  let fcmToken: string | undefined
  try {
    fcmToken = (await requestNotificationPermission()) || undefined
  } catch (error) {
    console.warn('Could not get FCM token:', error)
  }

  // Calculate start time if we have the necessary data
  let startTime: number | undefined
  if (competition && runner) {
    startTime = calculateStartTime(
      competition.date,
      runner.start,
      competition.timediff
    )
  }

  const id = `${userId}-${competitionId}-${className}-${runnerName.replace(/[^a-zA-Z0-9]/g, '_')}`
  const docRef = doc(db, 'selections', id)
  
  const data: Record<string, unknown> = {
    userId,
    competitionId,
    className,
    runnerName,
    fcmToken,
    createdAt: serverTimestamp(),
  }

  // Only add startTime if it's available
  if (startTime !== undefined) {
    data.startTime = startTime
  }
  
  await setDoc(docRef, data)
}

export async function removeSelection(
  userId: string,
  competitionId: string,
  className: string,
  runnerName: string
): Promise<void> {
  const id = `${userId}-${competitionId}-${className}-${runnerName.replace(/[^a-zA-Z0-9]/g, '_')}`
  const docRef = doc(db, 'selections', id)
  await deleteDoc(docRef)
}

export async function loadSelections(
  userId: string,
  competitionId: string,
  className: string
): Promise<string[]> {
  const selectionsRef = collection(db, 'selections')
  const q = query(
    selectionsRef,
    where('userId', '==', userId),
    where('competitionId', '==', competitionId),
    where('className', '==', className)
  )
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data().runnerName as string)
}
