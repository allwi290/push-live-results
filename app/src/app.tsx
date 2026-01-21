import { useEffect, useState } from 'preact/hooks'
import type { User } from 'firebase/auth'
import {
  fetchClasses,
  fetchCompetitions,
  fetchCountries,
  fetchResults,
  fetchRunners,
} from './services/liveResults'
import {
  listenToAuthChanges,
  requestNotificationPermission,
  signInWithGoogle,
  signOutUser,
} from './services/firebase'
import { saveSelection } from './services/selections'
import type {
  Competition,
  Country,
  RaceClass,
  ResultEntry,
  Runner,
} from './types/live-results'

type Status = { kind: 'idle' | 'info' | 'error' | 'success'; message: string }

const buttonBase =
  'rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]'

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' })

  const [countries, setCountries] = useState<Country[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [classes, setClasses] = useState<RaceClass[]>([])
  const [runners, setRunners] = useState<Runner[]>([])
  const [results, setResults] = useState<ResultEntry[]>([])

  const [country, setCountry] = useState('')
  const [competitionId, setCompetitionId] = useState('')
  const [classId, setClassId] = useState('')
  const [followed, setFollowed] = useState<string[]>([])

  // Auth listener
  useEffect(() => {
    const unsub = listenToAuthChanges(async (next) => {
      setUser(next)
      if (next) {
        try {
          await requestNotificationPermission()
          setStatus({ kind: 'success', message: 'Push notifications ready' })
        } catch {
          setStatus({
            kind: 'error',
            message: 'Enable push notifications to get runner alerts',
          })
        }
      }
    })
    return () => unsub()
  }, [])

  // Load countries once
  useEffect(() => {
    fetchCountries().then(setCountries).catch(console.error)
  }, [])

  // Pull competitions when country changes
  useEffect(() => {
    if (!country) {
      setCompetitions([])
      setCompetitionId('')
      return
    }
    fetchCompetitions(country).then(setCompetitions).catch(console.error)
  }, [country])

  // Pull classes when competition changes
  useEffect(() => {
    if (!competitionId) {
      setClasses([])
      setClassId('')
      return
    }
    fetchClasses(competitionId).then(setClasses).catch(console.error)
  }, [competitionId])

  // Pull runners and results when class changes
  useEffect(() => {
    if (!classId) {
      setRunners([])
      setResults([])
      return
    }
    fetchRunners(classId).then(setRunners).catch(console.error)
    fetchResults(classId).then(setResults).catch(console.error)
  }, [classId])

  const toggleRunner = (runnerId: string) => {
    setFollowed((prev) =>
      prev.includes(runnerId)
        ? prev.filter((id) => id !== runnerId)
        : [...prev, runnerId],
    )
  }

  const followAll = () => setFollowed(runners.map((runner) => runner.id))

  const clearFollowed = () => setFollowed([])

  const handleSave = async () => {
    if (!user || !country || !competitionId || !classId) {
      setStatus({ kind: 'error', message: 'Complete selections first' })
      return
    }
    setStatus({ kind: 'info', message: 'Saving your follows…' })
    try {
      await saveSelection({
        userId: user.uid,
        countryCode: country,
        competitionId,
        classId,
        runnerIds: followed,
        createdAt: Date.now(),
      })
      setStatus({ kind: 'success', message: 'Saved. Push alerts will follow.' })
    } catch (error) {
      setStatus({ kind: 'error', message: 'Could not save follows just now.' })
      console.error(error)
    }
  }

  return (
    <div class="mx-auto max-w-screen-sm px-4 py-6 text-slate-900">
      <header class="mb-6 flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500">
            Live Orienteering Alerts
          </p>
          <h1 class="text-2xl font-semibold text-slate-900">Push Live Results</h1>
        </div>
        <div class="text-right">
          {user ? (
            <>
              <p class="text-sm font-medium">{user.displayName || 'Account'}</p>
              <button
                class={`${buttonBase} bg-slate-100 text-slate-700`}
                onClick={signOutUser}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              class={`${buttonBase} bg-emerald-600 text-white`}
              onClick={signInWithGoogle}
            >
              Sign in to follow runners
            </button>
          )}
        </div>
      </header>

      <section class="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Select event</h2>
          <span class="text-xs text-slate-500">Country → Competition → Class</span>
        </div>
        <div class="mt-3 grid gap-3">
          <Select
            label="Country"
            value={country}
            placeholder="Choose country"
            onChange={setCountry}
            options={countries.map((c) => ({ value: c.code, label: c.name }))}
          />
          <Select
            label="Competition"
            value={competitionId}
            placeholder="Choose competition"
            onChange={setCompetitionId}
            disabled={!country}
            options={competitions.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Class"
            value={classId}
            placeholder="Choose class"
            onChange={setClassId}
            disabled={!competitionId}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </section>

      <section class="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Follow runners</h2>
          <div class="flex gap-2 text-sm">
            <button
              class={`${buttonBase} bg-slate-100 text-slate-700`}
              onClick={clearFollowed}
              disabled={!followed.length}
            >
              Clear
            </button>
            <button
              class={`${buttonBase} bg-emerald-50 text-emerald-700`}
              onClick={followAll}
              disabled={!runners.length}
            >
              Follow all
            </button>
          </div>
        </div>
        <div class="mt-3 grid gap-2">
          {runners.map((runner) => {
            const checked = followed.includes(runner.id)
            return (
              <button
                key={runner.id}
                onClick={() => toggleRunner(runner.id)}
                class={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${
                  checked
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-900'
                }`}
              >
                <div>
                  <p class="font-semibold">{runner.name}</p>
                  {runner.club && <p class="text-xs text-slate-500">{runner.club}</p>}
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  aria-label={`Follow ${runner.name}`}
                  class="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  readOnly
                />
              </button>
            )
          })}
          {!runners.length && (
            <p class="text-sm text-slate-500">Select a class to see runners.</p>
          )}
          <button
            class={`${buttonBase} mt-3 w-full bg-emerald-600 text-white disabled:opacity-50`}
            onClick={handleSave}
            disabled={!user || !followed.length}
          >
            Save & enable push alerts
          </button>
          {status.message && (
            <p
              class={`text-sm ${
                status.kind === 'error'
                  ? 'text-red-600'
                  : status.kind === 'success'
                    ? 'text-emerald-700'
                    : 'text-slate-600'
              }`}
            >
              {status.message}
            </p>
          )}
        </div>
      </section>

      <section class="rounded-2xl bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Live results</h2>
          <span class="text-xs text-slate-500">Updated as data arrives</span>
        </div>
        <div class="mt-3 space-y-2">
          {results.map((result) => (
            <article
              key={result.runnerId}
              class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <div class="flex items-center justify-between text-sm">
                <div>
                  <p class="font-semibold">{result.runnerName}</p>
                  <p class="text-xs text-slate-500">{result.club || '—'}</p>
                </div>
                <div class="text-right text-xs text-slate-600">
                  <p>{result.status || 'running'}</p>
                  <p>Pos {result.position ?? '–'}</p>
                </div>
              </div>
              <div class="mt-2 grid grid-cols-2 text-xs text-slate-600">
                <span>Last: {result.lastControl || '—'}</span>
                <span class="text-right">{result.lastTime || '--:--'}</span>
              </div>
              <p class="mt-1 text-[11px] text-slate-400">
                Updated{' '}
                {result.updatedAt
                  ? new Date(result.updatedAt).toLocaleTimeString()
                  : 'recently'}
              </p>
            </article>
          ))}
          {!results.length && (
            <p class="text-sm text-slate-500">Select a class to see live results.</p>
          )}
        </div>
      </section>
    </div>
  )
}

type SelectProps = {
  label: string
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}

function Select({ label, value, placeholder, options, onChange, disabled }: SelectProps) {
  return (
    <label class="block text-sm">
      <span class="mb-1 block font-medium text-slate-700">{label}</span>
      <select
        value={value}
        disabled={disabled}
        class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base shadow-inner focus:border-emerald-500 focus:outline-none"
        onChange={(event) => onChange((event.target as HTMLSelectElement).value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
