export type Competition = {
  id: number
  name: string
  organizer: string
  date: string
  timediff?: number
  multidaystage?: number
  multidayfirstday?: number
}

export type RaceClass = {
  className: string
}

export type Runner = {
  place: string
  name: string
  club: string
  result: string
  status: number
  timeplus: string
  progress: number
  start: number
  className?: string
}

export type ResultEntry = {
  place: string
  name: string
  club: string
  result: string
  status: number
  timeplus: string
  progress: number
  start: number
  className?: string
  totalControls?: number
  passedControls?: number
}

export type LastPassing = {
  passtime: string
  runnerName: string
  class: string
  control: number
  controlName: string
  time: number
}

export type Club = {
  name: string
  runners: number
}

export type SelectionPayload = {
  userId: string
  competitionId: string
  className: string
  runnerName: string
  startTime?: number
  createdAt: number
}
