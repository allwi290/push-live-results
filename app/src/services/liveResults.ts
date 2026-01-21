import type {
  Competition,
  LastPassing,
  RaceClass,
  ResultEntry,
} from '../types/live-results'

// Points to our Firebase Cloud Functions backend API (NOT directly to external LiveResults API)
// Backend handles caching and hash-based polling to minimize load on external API
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '/api'

type ApiResponse<T> = {
  status: string
  hash?: string
} & T

async function fetchJson<T>(params: URLSearchParams): Promise<T> {
  const url = `${API_BASE}?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`LiveResults request failed: ${res.status}`)
  }
  const data = (await res.json()) as ApiResponse<T>
  if (data.status === 'NOT MODIFIED') {
    throw new Error('NOT_MODIFIED')
  }
  return data as T
}

// Fallback stub data so the UI remains usable during development.
const fallback = {
  competitions: [
    {
      id: 10278,
      name: 'Demo Competition',
      organizer: 'Test Organizer',
      date: '2026-04-20',
      timediff: 0,
    },
  ],
  classes: [{ className: 'H21' }, { className: 'D21' }],
  results: [
    {
      place: '1',
      name: 'Lina Karlsson',
      club: 'IFK',
      result: '45:23',
      status: 0,
      timeplus: '+00:00',
      progress: 100,
      start: 36000000,
    },
    {
      place: '2',
      name: 'Oskar Berg',
      club: 'OK Linné',
      result: '46:15',
      status: 0,
      timeplus: '+00:52',
      progress: 100,
      start: 36000000,
    },
  ],
}

export async function fetchCompetitions(): Promise<Competition[]> {
  try {
    const params = new URLSearchParams({ method: 'getcompetitions' })
    const data = await fetchJson<{ competitions: Competition[] }>(params)
    return data.competitions
  } catch (error) {
    console.warn('Using fallback competitions', error)
    return fallback.competitions
  }
}

export async function fetchCompetitionInfo(
  compId: number,
): Promise<Competition | null> {
  try {
    const params = new URLSearchParams({
      method: 'getcompetitioninfo',
      comp: compId.toString(),
    })
    return await fetchJson<Competition>(params)
  } catch (error) {
    console.warn('Failed to fetch competition info', error)
    return null
  }
}

export async function fetchClasses(
  compId: number,
  lastHash?: string,
): Promise<RaceClass[]> {
  try {
    const params = new URLSearchParams({
      method: 'getclasses',
      comp: compId.toString(),
    })
    if (lastHash) {
      params.append('last_hash', lastHash)
    }
    const data = await fetchJson<{ classes: RaceClass[] }>(params)
    return data.classes
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_MODIFIED') {
      throw error
    }
    console.warn('Using fallback classes', error)
    return fallback.classes
  }
}

export async function fetchClassResults(
  compId: number,
  className: string,
  lastHash?: string,
): Promise<{ results: ResultEntry[]; hash?: string }> {
  try {
    const params = new URLSearchParams({
      method: 'getclassresults',
      comp: compId.toString(),
      class: className,
      unformattedTimes: 'false',
    })
    if (lastHash) {
      params.append('last_hash', lastHash)
    }
    const data = await fetchJson<{
      className: string
      results: ResultEntry[]
      hash?: string
    }>(params)
    return { results: data.results, hash: data.hash }
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_MODIFIED') {
      throw error
    }
    console.warn('Using fallback results', error)
    return { results: fallback.results }
  }
}

export async function fetchLastPassings(
  compId: number,
  lastHash?: string,
): Promise<{ passings: LastPassing[]; hash?: string }> {
  try {
    const params = new URLSearchParams({
      method: 'getlastpassings',
      comp: compId.toString(),
    })
    if (lastHash) {
      params.append('last_hash', lastHash)
    }
    const data = await fetchJson<{ passings: LastPassing[]; hash?: string }>(params)
    return data
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_MODIFIED') {
      throw error
    }
    console.warn('Failed to fetch last passings', error)
    return { passings: [] }
  }
}
