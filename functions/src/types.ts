/**
 * Type definitions for LiveResults API
 */

export interface Competition {
  id: number
  name: string
  organizer: string
  date: string
}

export interface RaceClass {
  className: string
}

export interface ResultEntry {
  place: string
  name: string
  club: string
  result: string
  status: number
  timeplus: string
  progress: string
  start: number
}

export interface LastPassing {
  passtime: string
  runnerName: string
  class: string
  control: number
  controlName: string
  time: number
}

export interface ApiResponse<T> {
  status: string
  hash?: string
  data?: T
}

export interface CachedData {
  hash: string
  data: unknown
  timestamp: number
}

export interface UserSelection {
  userId: string
  competitionId: string
  className: string
  runnerNames: string[]
  createdAt: number
  fcmToken?: string
  startTime?: number
}

export interface NotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
}
