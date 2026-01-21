import type {
  Competition,
  Country,
  RaceClass,
  ResultEntry,
  Runner,
} from '../types/live-results'

// Points to our Firebase Cloud Functions backend API (NOT directly to external LiveResults API)
// Backend handles caching and hash-based polling to minimize load on external API
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '/api'

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    throw new Error(`LiveResults request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Fallback stub data so the UI remains usable during development.
const fallback = {
  countries: [
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'FI', name: 'Finland' },
  ],
  competitions: [
    {
      id: 'sample-1',
      name: 'Sample Orienteering Cup',
      countryCode: 'SE',
      startDate: '2026-04-20',
      endDate: '2026-04-21',
    },
  ],
  classes: [
    { id: 'h21', name: 'H21', competitionId: 'sample-1' },
    { id: 'd21', name: 'D21', competitionId: 'sample-1' },
  ],
  runners: [
    { id: 'r1', name: 'Lina Karlsson', club: 'IFK' },
    { id: 'r2', name: 'Oskar Berg', club: 'OK Linné' },
    { id: 'r3', name: 'Maja Lind', club: 'OK Orion' },
  ],
}

export async function fetchCountries(): Promise<Country[]> {
  try {
    return await fetchJson<Country[]>('/countries')
  } catch (error) {
    console.warn('Using fallback countries', error)
    return fallback.countries
  }
}

export async function fetchCompetitions(countryCode: string): Promise<Competition[]> {
  try {
    return await fetchJson<Competition[]>(`/competitions?country=${countryCode}`)
  } catch (error) {
    console.warn('Using fallback competitions', error)
    return fallback.competitions.filter((c) => c.countryCode === countryCode)
  }
}

export async function fetchClasses(competitionId: string): Promise<RaceClass[]> {
  try {
    return await fetchJson<RaceClass[]>(`/classes?competition=${competitionId}`)
  } catch (error) {
    console.warn('Using fallback classes', error)
    return fallback.classes.filter((c) => c.competitionId === competitionId)
  }
}

export async function fetchRunners(classId: string): Promise<Runner[]> {
  try {
    return await fetchJson<Runner[]>(`/runners?class=${classId}`)
  } catch (error) {
    console.warn('Using fallback runners', error)
    return fallback.runners
  }
}

export async function fetchResults(classId: string): Promise<ResultEntry[]> {
  try {
    return await fetchJson<ResultEntry[]>(`/results?class=${classId}`)
  } catch (error) {
    console.warn('Using fallback results', error)
    return fallback.runners.map((runner, index) => ({
      runnerId: runner.id,
      runnerName: runner.name,
      club: runner.club,
      position: index + 1,
      status: 'running',
      lastControl: 'Finish',
      lastTime: `00:${10 + index}:30`,
      updatedAt: new Date().toISOString(),
    }))
  }
}
