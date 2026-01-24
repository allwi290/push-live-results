import { useEffect, useState } from 'preact/hooks'
import type { User } from 'firebase/auth'
import {
  fetchClasses,
  fetchClassResults,
  fetchCompetitions,
} from './services/liveResults'
import {
  listenToAuthChanges,
  requestNotificationPermission,
  signOutUser,
  checkForEmailLink,
  completeEmailLinkSignIn,
} from './services/firebase'
import { saveSelection } from './services/selections'
import { AuthModal } from './components/AuthModal'
import type { Competition, RaceClass, ResultEntry } from './types/live-results'

type Status = { kind: 'idle' | 'info' | 'error' | 'success'; message: string }

const buttonBase =
  'rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]'

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' })
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [classes, setClasses] = useState<RaceClass[]>([])
  const [results, setResults] = useState<ResultEntry[]>([])

  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [className, setClassName] = useState('')
  const [followed, setFollowed] = useState<string[]>([])

  // Handle email link sign-in on mount
  useEffect(() => {
    if (checkForEmailLink()) {
      completeEmailLinkSignIn()
        .then(() => {
          setStatus({ kind: 'success', message: 'Signed in successfully!' })
          // Remove the emailLink param from URL
          window.history.replaceState({}, document.title, window.location.pathname)
        })
        .catch((err) => {
          setStatus({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Failed to sign in',
          })
        })
    }
  }, [])

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

  // Load competitions once
  useEffect(() => {
    fetchCompetitions().then(setCompetitions).catch(console.error)
  }, [])

  // Pull classes when competition changes
  useEffect(() => {
    if (!competitionId) {
      setClasses([])
      setClassName('')
      return
    }
    fetchClasses(competitionId).then(setClasses).catch(console.error)
  }, [competitionId])

  // Pull results when class changes
  useEffect(() => {
    if (!competitionId || !className) {
      setResults([])
      return
    }
    fetchClassResults(competitionId, className)
      .then(({ results }) => setResults(results))
      .catch(console.error)
  }, [competitionId, className])

  const toggleRunner = (runnerName: string) => {
    setFollowed((prev) =>
      prev.includes(runnerName)
        ? prev.filter((name) => name !== runnerName)
        : [...prev, runnerName],
    )
  }

  const followAll = () => setFollowed(results.map((result) => result.name))

  const clearFollowed = () => setFollowed([])

  const handleSave = async () => {
    if (!user || !competitionId || !className) {
      setStatus({ kind: 'error', message: 'Complete selections first' })
      return
    }
    setStatus({ kind: 'info', message: 'Saving your follows…' })
    try {
      await saveSelection({
        userId: user.uid,
        competitionId: competitionId.toString(),
        className,
        runnerNames: followed,
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
              <p class="text-sm font-medium">{user.displayName || user.email || 'Account'}</p>
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
              onClick={() => setShowAuthModal(true)}
            >
              Sign in to follow runners
            </button>
          )}
        </div>
      </header>

      <section class="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Select event</h2>
          <span class="text-xs text-slate-500">Competition → Class</span>
        </div>
        <div class="mt-3 grid gap-3">
          <Select
            label="Competition"
            value={competitionId?.toString() || ''}
            placeholder="Choose competition"
            onChange={(val) => setCompetitionId(val ? Number(val) : null)}
            options={competitions.map((c) => ({
              value: c.id.toString(),
              label: `${c.name} (${c.organizer})`,
            }))}
          />
          <Select
            label="Class"
            value={className}
            placeholder="Choose class"
            onChange={setClassName}
            disabled={!competitionId}
            options={classes.map((c) => ({
              value: c.className,
              label: c.className,
            }))}
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
              disabled={!results.length}
            >
              Follow all
            </button>
          </div>
        </div>
        <div class="mt-3 grid gap-2">
          {results.map((result) => {
            const checked = followed.includes(result.name)
            return (
              <button
                key={result.name}
                onClick={() => toggleRunner(result.name)}
                class={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${
                  checked
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-900'
                }`}
              >
                <div>
                  <p class="font-semibold">{result.name}</p>
                  {result.club && <p class="text-xs text-slate-500">{result.club}</p>}
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  aria-label={`Follow ${result.name}`}
                  class="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  readOnly
                />
              </button>
            )
          })}
          {!results.length && (
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
          {results.map((result) => {
            const statusText = getStatusText(result.status)
            return (
              <article
                key={result.name}
                class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div class="flex items-center justify-between text-sm">
                  <div>
                    <p class="font-semibold">{result.name}</p>
                    <p class="text-xs text-slate-500">{result.club || '—'}</p>
                  </div>
                  <div class="text-right text-xs text-slate-600">
                    <p>{statusText}</p>
                    <p>Pos {result.place}</p>
                  </div>
                </div>
                <div class="mt-2 grid grid-cols-2 text-xs text-slate-600">
                  <span>Result: {result.result}</span>
                  <span class="text-right">{result.timeplus}</span>
                </div>
                <p class="mt-1 text-[11px] text-slate-400">
                  Progress: {result.progress}%
                </p>
              </article>
            )
          })}
          {!results.length && (
            <p class="text-sm text-slate-500">Select a class to see live results.</p>
          )}
        </div>
      </section>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}

function getStatusText(status: number): string {
  const statusMap: Record<number, string> = {
    0: 'OK',
    1: 'DNS',
    2: 'DNF',
    3: 'MP',
    4: 'DSQ',
    5: 'OT',
    9: 'Not Started',
    10: 'Not Started',
    11: 'Walk Over',
    12: 'Moved Up',
  }
  return statusMap[status] || 'Unknown'
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
