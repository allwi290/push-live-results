import { useEffect, useState } from 'preact/hooks'
import type { User } from 'firebase/auth'
import {
  fetchClasses,
  fetchClassResults,
  fetchCompetitions,
  fetchClubs,
  fetchRunnersForClub,
} from './services/liveResults'
import {
  listenToAuthChanges,
  requestNotificationPermission,
  signOutUser,
  checkForEmailLink,
  completeEmailLinkSignIn,
} from './services/firebase'
import { saveSelections, loadSelections } from './services/selections'
import { AuthModal } from './components/AuthModal'
import type { Club, Competition, RaceClass, ResultEntry } from './types/live-results'

type Status = { kind: 'idle' | 'info' | 'error' | 'success'; message: string }

const buttonBase =
  'rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]'

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' })
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [classes, setClasses] = useState<RaceClass[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [results, setResults] = useState<ResultEntry[]>([])
  const [loadingResults, setLoadingResults] = useState(false)

  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [className, setClassName] = useState('')
  const [clubName, setClubName] = useState('')
  const [selectionMode, setSelectionMode] = useState<'class' | 'club'>('class')
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
    const unsub = listenToAuthChanges((next) => {
      setUser(next)
    })
    return () => unsub()
  }, [])

  // Load competitions once
  useEffect(() => {
    fetchCompetitions().then(setCompetitions).catch(console.error)
  }, [])

  // Pull classes and clubs when competition changes
  useEffect(() => {
    if (!competitionId) {
      setClasses([])
      setClubs([])
      setClassName('')
      setClubName('')
      return
    }

    fetchClasses(competitionId).then(setClasses).catch(console.error)
    fetchClubs(competitionId).then(setClubs).catch(console.error)
  }, [competitionId])

  // Pull results when class or club changes
  useEffect(() => {
    if (!competitionId) {
      setResults([])
      setLoadingResults(false)
      return
    }

    if (selectionMode === 'class') {
      if (!className) {
        setResults([])
        setLoadingResults(false)
        return
      }
      setLoadingResults(true)
      fetchClassResults(competitionId, className)
        .then(({ results }) => {
          setResults(results)
          setLoadingResults(false)
        })
        .catch((err) => {
          console.error(err)
          setLoadingResults(false)
        })
    } else {
      if (!clubName || !classes.length) {
        setResults([])
        setLoadingResults(false)
        return
      }

      setLoadingResults(true)
      // Use the new API endpoint to fetch all club runners
      fetchRunnersForClub(competitionId, clubName)
        .then((res) => {
          setResults(res)
          setLoadingResults(false)
        })
        .catch((err) => {
          console.error(err)
          setLoadingResults(false)
        })
    }
  }, [competitionId, className, clubName, selectionMode, classes])

  // Load saved selections when user, competition, or class changes
  useEffect(() => {
    if (!user || !competitionId || !className || selectionMode !== 'class') {
      return
    }

    loadSelections(user.uid, competitionId.toString(), className)
      .then(setFollowed)
      .catch((err) => {
        console.error('Failed to load saved selections:', err)
      })
  }, [user, competitionId, className, selectionMode])

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
    if (selectionMode === 'club') {
      setStatus({
        kind: 'error',
        message: 'Saving alerts is currently available for class selections. Please pick a class.',
      })
      return
    }
    if (!user || !competitionId || !className) {
      setStatus({ kind: 'error', message: 'Complete selections first' })
      return
    }
    setStatus({ kind: 'info', message: 'Saving your follows…' })
    try {
      // Request notification permission when saving
      try {
        await requestNotificationPermission()
      } catch {
        setStatus({
          kind: 'error',
          message: 'Enable push notifications to receive runner alerts',
        })
        return
      }

      await saveSelections(
        user.uid,
        competitionId.toString(),
        className,
        followed
      )
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
          <span class="text-xs text-slate-500">Competition → Class or Club</span>
        </div>
        <div class="mt-3 grid gap-3">
          <Select
            label="Competition"
            value={competitionId?.toString() || ''}
            placeholder="Choose competition"
            onChange={(val) => setCompetitionId(val ? Number(val) : null)}
            options={groupCompetitionsByDate(competitions).map((group) => ({
              label: group.label,
              options: group.competitions.map((c) => ({
                value: c.id.toString(),
                label: `${c.name} (${c.organizer})`,
              })),
            }))}
          />
          <div class="flex gap-2 text-sm">
            <button
              class={`${buttonBase} flex-1 ${selectionMode === 'class' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => {
                setSelectionMode('class')
                setClubName('')
              }}
            >
              Select by Class
            </button>
            <button
              class={`${buttonBase} flex-1 ${selectionMode === 'club' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => {
                setSelectionMode('club')
                setClassName('')
              }}
            >
              Select by Club
            </button>
          </div>
          {selectionMode === 'class' && (
            <Select
              label="Class"
              value={className}
              placeholder={classes.length === 0 && competitionId ? "No classes available" : "Choose class"}
              onChange={setClassName}
              disabled={!competitionId}
              options={classes.map((c) => ({
                value: c.className,
                label: c.className,
              }))}
            />
          )}
          {selectionMode === 'club' && (
            <Select
              label="Club"
              value={clubName}
              placeholder={clubs.length === 0 && competitionId ? "No clubs available" : "Choose club"}
              onChange={setClubName}
              disabled={!competitionId}
              options={clubs.map((club) => ({
                value: club.name,
                label: `${club.name} (${club.runners})`,
              }))}
            />
          )}
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
              disabled={!results.length || loadingResults}
            >
              Follow all
            </button>
          </div>
        </div>
        <div class="mt-3 grid gap-2">
          {loadingResults && (
            <div class="flex items-center justify-center py-6">
              <div class="flex flex-col items-center gap-2">
                <div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"></div>
                <p class="text-sm text-slate-500">Loading runners…</p>
              </div>
            </div>
          )}
          {!loadingResults && [...results].sort((a, b) => a.name.localeCompare(b.name)).map((result) => {
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
                  {result.className && <p class="text-xs text-slate-400">{result.className}</p>}
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
          {!loadingResults && !results.length && (
            <p class="text-sm text-slate-500">Select a class or club to see runners.</p>
          )}
          <button
            class={`${buttonBase} mt-3 w-full bg-emerald-600 text-white disabled:opacity-50`}
            onClick={handleSave}
            disabled={!user || !followed.length || selectionMode === 'club'}
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
            const isOK = result.status === 0
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
                    {isOK && <p>Pos {result.place}</p>}
                  </div>
                </div>
                {isOK && (
                  <>
                    <div class="mt-2 grid grid-cols-2 text-xs text-slate-600">
                      <span>Result: {result.result}</span>
                      <span class="text-right">{result.timeplus}</span>
                    </div>
                    <p class="mt-1 text-[11px] text-slate-400">
                      Progress: {result.progress}%
                    </p>
                  </>
                )}
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
    1: 'Did not start', //DNS
    2: 'Did not finished', //DNF
    3: 'Missing punch', //MP
    4: 'Disqualified', //DSQ
    5: 'Over max time', //OT
    9: 'Not Started',
    10: 'Not Started',
    11: 'Walk Over',
    12: 'Moved Up',
  }
  return statusMap[status] || 'Unknown'
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Today'
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
}

function groupCompetitionsByDate(competitions: Competition[]): { label: string; competitions: Competition[] }[] {
  const groups: Record<string, Competition[]> = {}

  competitions.forEach((comp) => {
    const label = formatDateLabel(comp.date)
    if (!groups[label]) {
      groups[label] = []
    }
    groups[label].push(comp)
  })

  // Order: Today, Yesterday, then others by date descending
  const order = ['Today', 'Yesterday']
  const otherDates = Object.keys(groups).filter((key) => !order.includes(key)).sort()
  const sortedKeys = [...order.filter((key) => groups[key]), ...otherDates]

  return sortedKeys.map((label) => ({
    label,
    competitions: groups[label],
  }))
}

type SelectOption = { value: string; label: string }
type SelectGroup = { label: string; options: SelectOption[] }

type SelectProps = {
  label: string
  value: string
  placeholder: string
  options: SelectOption[] | SelectGroup[]
  onChange: (value: string) => void
  disabled?: boolean
}

function isGrouped(options: SelectOption[] | SelectGroup[]): options is SelectGroup[] {
  return options.length > 0 && 'options' in options[0]
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
        {isGrouped(options) ? (
          options.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))
        ) : (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        )}
      </select>
    </label>
  )
}
