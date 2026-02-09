import JSON5 from 'json5'
import type {
  Competition,
  LastPassing,
  RaceClass,
  ResultEntry,
  Club,
} from '../types/live-results'

// Backend API for endpoints that need server-side logic (caching, notifications)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '/api'

// Direct LiveResults API for navigation/read-only endpoints
const LIVE_RESULTS_API = 'https://liveresultat.orientering.se/api.php'

type ApiResponse<T> = {
  status: string
  hash?: string
} & T

// --- Local cache helpers (localStorage with TTL and periodic cleanup) ---

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_PREFIX = 'lr_cache_'
const CACHE_TTL = {
  COMPETITIONS: 15 * 60 * 1000, // 15 minutes
  CLASSES: 10 * 60 * 1000,      // 10 minutes
}
// Max age before an entry is eligible for cleanup
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

function cacheGet<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.timestamp > ttlMs) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

function cacheSet<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Storage full — run cleanup and retry once
    cacheCleanup()
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now() }
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
    } catch {
      // Still full, give up silently
    }
  }
}

/** Remove all cache entries older than CACHE_MAX_AGE */
function cacheCleanup(): void {
  const now = Date.now()
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(CACHE_PREFIX)) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const entry: CacheEntry<unknown> = JSON.parse(raw)
      if (now - entry.timestamp > CACHE_MAX_AGE) {
        keysToRemove.push(key)
      }
    } catch {
      keysToRemove.push(key!) // corrupt entry, remove it
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k))
}

// Run cleanup once on module load to keep storage tidy
cacheCleanup()

// --- Fetch helpers ---

/**
 * Sanitize byte array by replacing control characters.
 * Mirrors the backend sanitization in liveResultsClient.ts.
 */
function sanitizeControlCharacters(uint8Array: Uint8Array): void {
  for (let i = 0; i < uint8Array.length; i++) {
    const byte = uint8Array[i]
    // Replace control chars 0x00-0x1F except HT(0x09), LF(0x0A), CR(0x0D)
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      uint8Array[i] = 0x20
    }
  }
}

/** Fetch directly from the LiveResults API (used for navigation endpoints) */
async function fetchLiveResultsApi<T>(params: URLSearchParams): Promise<T> {
  const url = `${LIVE_RESULTS_API}?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`LiveResults request failed: ${res.status}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  sanitizeControlCharacters(uint8Array)
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array)
  return JSON5.parse(text) as T
}

/** Fetch from our backend API (used for endpoints needing server-side logic) */
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
  // Try local cache first
  const cached = cacheGet<Competition[]>('competitions', CACHE_TTL.COMPETITIONS)
  if (cached) return cached

  try {
    const params = new URLSearchParams({ method: 'getcompetitions' })
    const data = await fetchLiveResultsApi<{ competitions: Competition[] }>(params)
    const competitions = data.competitions || []

    // Apply same filtering as the backend: ±3/4 days window, sorted latest first
    const now = new Date()
    const toDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)
    const fromDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    const filtered = competitions
      .filter((comp) => {
        const compDate = new Date(comp.date)
        return compDate <= toDate && compDate >= fromDate
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    cacheSet('competitions', filtered)
    return filtered
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
  _lastHash?: string,
): Promise<RaceClass[]> {
  // Try local cache first
  const cacheKey = `classes_${compId}`
  const cached = cacheGet<RaceClass[]>(cacheKey, CACHE_TTL.CLASSES)
  if (cached) return cached

  try {
    const params = new URLSearchParams({
      method: 'getclasses',
      comp: compId.toString(),
    })
    const data = await fetchLiveResultsApi<{ classes: RaceClass[] }>(params)
    const classes = data.classes || []
    cacheSet(cacheKey, classes)
    return classes
  } catch (error) {
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
    const response = await fetchJson<{
      data: ResultEntry[]
      hash?: string
    }>(params)
    return { results: response.data, hash: response.hash }
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
    const response = await fetchJson<{ data: LastPassing[]; hash?: string }>(params)
    return { passings: response.data, hash: response.hash }
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_MODIFIED') {
      throw error
    }
    console.warn('Failed to fetch last passings', error)
    return { passings: [] }
  }
}
export async function fetchClubs(compId: number): Promise<Club[]> {
  try {
    const params = new URLSearchParams({
      method: 'getclubs',
      comp: compId.toString(),
    })
    const response = await fetchJson<{ data: Club[] }>(params)
    return response.data
  } catch (error) {
    console.warn('Failed to fetch clubs', error)
    return []
  }
}

export async function fetchRunnersForClub(
  compId: number,
  clubName: string,
): Promise<ResultEntry[]> {
  try {
    const params = new URLSearchParams({
      method: 'getrunnersforclub',
      comp: compId.toString(),
      club: clubName,
    })
    const response = await fetchJson<{ data: ResultEntry[] }>(params)
    return response.data
  } catch (error) {
    console.warn('Failed to fetch runners for club', error)
    return []
  }
}

