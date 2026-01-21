export type Country = {
  code: string
  name: string
}

export type Competition = {
  id: string
  name: string
  countryCode: string
  startDate?: string
  endDate?: string
}

export type RaceClass = {
  id: string
  name: string
  competitionId: string
}

export type Runner = {
  id: string
  name: string
  club?: string
  bib?: string
}

export type ResultEntry = {
  runnerId: string
  runnerName: string
  club?: string
  position?: number
  status?: 'running' | 'finished' | 'dns' | 'dnf'
  lastControl?: string
  lastTime?: string
  updatedAt?: string
}

export type SelectionPayload = {
  userId: string
  countryCode: string
  competitionId: string
  classId: string
  runnerIds: string[]
  createdAt: number
}
