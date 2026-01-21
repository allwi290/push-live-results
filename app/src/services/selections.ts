import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { SelectionPayload } from '../types/live-results'

export async function saveSelection(payload: SelectionPayload) {
  const id = `${payload.userId}-${payload.classId}`
  await setDoc(doc(db, 'selections', id), {
    ...payload,
    createdAt: serverTimestamp(),
  })
}
