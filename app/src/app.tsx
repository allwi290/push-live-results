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
  listenToForegroundMessages,
} from './services/firebase'
import { addSelection, removeSelection, loadSelections } from './services/selections'
import { AuthModal } from './components/AuthModal'
import { CompetitionSelector } from './components/CompetitionSelector'
import { RunnerFollower } from './components/RunnerFollower'
import { LiveResultsDisplay } from './components/LiveResultsDisplay'
import { Profile } from './components/Profile'
import type { Club, Competition, RaceClass, ResultEntry } from './types/live-results'

type Status = { kind: 'idle' | 'info' | 'error' | 'success'; message: string }
type ForegroundNotice = { title: string; body: string; runnerName?: string }

const buttonBase =
  'rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]'

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [classes, setClasses] = useState<RaceClass[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [results, setResults] = useState<ResultEntry[]>([])
  const [loadingResults, setLoadingResults] = useState(false)

  const [competitionId, setCompetitionId] = useState<number | null>(() => {
    const saved = localStorage.getItem('competitionId')
    return saved ? parseInt(saved) : null
  })
  const [className, setClassName] = useState(() => 
    localStorage.getItem('className') || ''
  )
  const [clubName, setClubName] = useState(() => 
    localStorage.getItem('clubName') || ''
  )
  const [selectionMode, setSelectionMode] = useState<'class' | 'club'>(() => {
    const saved = localStorage.getItem('selectionMode')
    return saved === 'club' ? 'club' : 'class'
  })
  const [followed, setFollowed] = useState<string[]>([])
  const [sortField, setSortField] = useState<'name' | 'secondary' | 'startTime'>(() => {
    const saved = localStorage.getItem('sortField')
    if (saved === 'secondary' || saved === 'startTime') return saved
    return 'name'
  })
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('sortDirection')
    return saved === 'desc' ? 'desc' : 'asc'
  })
  const [focusedRunnerName, setFocusedRunnerName] = useState<string>('')
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [foregroundNotice, setForegroundNotice] = useState<ForegroundNotice | null>(null)

  const focusRunner = (runnerName: string) => {
    setFocusedRunnerName(runnerName)
    setFocusTrigger((prev) => prev + 1)
  }

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

  // Handle deep-link navigation from push notification click
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const competitionIdParam = params.get('competitionId')
    const classNameParam = params.get('className')
    const runnerNameParam = params.get('runnerName')

    const parsedCompetitionId = competitionIdParam ? Number(competitionIdParam) : NaN
    if (!Number.isNaN(parsedCompetitionId)) {
      setCompetitionId(parsedCompetitionId)
    }

    if (classNameParam) {
      setSelectionMode('class')
      setClubName('')
      setClassName(classNameParam)
    }

    if (runnerNameParam) {
      focusRunner(runnerNameParam)
    }

    if (competitionIdParam || classNameParam || runnerNameParam) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Auth listener
  useEffect(() => {
    const unsub = listenToAuthChanges((next) => {
      setUser(next)
    })
    return () => unsub()
  }, [])

  // Handle foreground push messages while app is open
  useEffect(() => {
    const unsubscribe = listenToForegroundMessages((payload) => {
      const data = payload.data ?? {}
      const competitionIdParam = data.competitionId
      const classNameParam = data.className
      const runnerNameParam = data.runnerName

      const parsedCompetitionId = competitionIdParam ? Number(competitionIdParam) : NaN
      if (!Number.isNaN(parsedCompetitionId)) {
        setCompetitionId(parsedCompetitionId)
      }

      if (classNameParam) {
        setSelectionMode('class')
        setClubName('')
        setClassName(classNameParam)
      }

      if (runnerNameParam) {
        focusRunner(runnerNameParam)
      }

      setForegroundNotice({
        title: payload.notification?.title || 'Live results update',
        body: payload.notification?.body || 'A followed runner has a new update.',
        runnerName: runnerNameParam,
      })
      setTimeout(() => {
        setForegroundNotice(null)
      }, 6000)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Load competitions once
  useEffect(() => {
    fetchCompetitions().then(setCompetitions).catch(console.error)
  }, [])

  // Save preferences to localStorage
  useEffect(() => {
    if (competitionId) {
      localStorage.setItem('competitionId', competitionId.toString())
    } else {
      localStorage.removeItem('competitionId')
    }
  }, [competitionId])

  useEffect(() => {
    if (className) {
      localStorage.setItem('className', className)
    } else {
      localStorage.removeItem('className')
    }
  }, [className])

  useEffect(() => {
    if (clubName) {
      localStorage.setItem('clubName', clubName)
    } else {
      localStorage.removeItem('clubName')
    }
  }, [clubName])

  useEffect(() => {
    localStorage.setItem('selectionMode', selectionMode)
  }, [selectionMode])

  useEffect(() => {
    localStorage.setItem('sortField', sortField)
  }, [sortField])

  useEffect(() => {
    localStorage.setItem('sortDirection', sortDirection)
  }, [sortDirection])

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
          // Ensure className is set on all results (for storage consistency)
          const resultsWithClass = results.map(r => ({
            ...r,
            className: r.className || className
          }))
          setResults(resultsWithClass)
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

  // Load saved selections when results or user changes
  useEffect(() => {
    if (!user || !competitionId || results.length === 0) {
      setFollowed([])
      return
    }

    // Get unique classNames from results
    const uniqueClasses = [...new Set(results.map(r => r.className).filter((cls): cls is string => Boolean(cls)))]
    
    // Load selections for all classes in the current results
    Promise.all(
      uniqueClasses.map(cls =>
        loadSelections(user.uid, competitionId.toString(), cls)
      )
    )
      .then((results) => {
        // Flatten all selections from all classes
        const allFollowed = results.flat()
        setFollowed(allFollowed)
      })
      .catch((err) => {
        console.error('Failed to load saved selections:', err)
      })
  }, [user, competitionId, results])

  const toggleRunner = async (runnerName: string) => {
    // Check prerequisites
    if (!user) {
      setShowAuthModal(true)
      return
    }

    if (!competitionId) {
      setStatus({ kind: 'error', message: 'Please select a competition first' })
      return
    }

    // Find the runner to get their className
    const runner = results.find(r => r.name === runnerName)
    if (!runner?.className) {
      setStatus({
        kind: 'error',
        message: 'Runner class information not available',
      })
      return
    }

    // Request notification permission on first selection
    if (followed.length === 0) {
      try {
        await requestNotificationPermission()
      } catch {
        setStatus({
          kind: 'error',
          message: 'Enable push notifications to receive runner alerts',
        })
        return
      }
    }

    // Optimistic update
    const isAdding = !followed.includes(runnerName)
    const previousFollowed = followed
    const newFollowed = isAdding
      ? [...followed, runnerName]
      : followed.filter((name) => name !== runnerName)

    setFollowed(newFollowed)
    setStatus({ kind: 'info', message: 'Saving…' })

    // Save to backend
    try {
      if (isAdding) {
        // Find the competition data to pass to addSelection
        const competition = competitions.find(c => c.id === competitionId)
        
        await addSelection(
          user.uid, 
          competitionId.toString(), 
          runner.className,
          runnerName,
          competition,
          runner
        )
      } else {
        await removeSelection(user.uid, competitionId.toString(), runner.className, runnerName)
      }
      setStatus({ kind: 'success', message: 'Saved' })
      // Clear success message after 2 seconds
      setTimeout(() => {
        setStatus({ kind: 'idle', message: '' })
      }, 2000)
    } catch (error) {
      // Rollback on failure
      setFollowed(previousFollowed)
      setStatus({ kind: 'error', message: 'Could not save. Please try again.' })
      console.error(error)
    }
  }

  return (
    <div class="mx-auto max-w-screen-sm px-4 py-6 text-slate-900">
      {foregroundNotice && (
        <button
          type="button"
          class="mb-4 w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-900 shadow-sm"
          onClick={() => {
            if (foregroundNotice.runnerName) {
              focusRunner(foregroundNotice.runnerName)
            }
          }}
        >
          <p class="font-semibold">{foregroundNotice.title}</p>
          <p class="text-xs text-emerald-700">{foregroundNotice.body}</p>
        </button>
      )}

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
              <button
                class={`${buttonBase} mt-1 bg-emerald-600 text-white hover:bg-emerald-700`}
                onClick={() => setShowProfile(true)}
              >
                {user.displayName || user.email || 'Profile'}
              </button>
            </>
          ) : (
            <button
              class={`${buttonBase} bg-emerald-600 text-white`}
              onClick={() => setShowAuthModal(true)}
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <CompetitionSelector
        competitions={competitions}
        classes={classes}
        clubs={clubs}
        competitionId={competitionId}
        className={className}
        clubName={clubName}
        selectionMode={selectionMode}
        onCompetitionChange={setCompetitionId}
        onClassNameChange={setClassName}
        onClubNameChange={setClubName}
        onSelectionModeChange={setSelectionMode}
      />

      <RunnerFollower
        results={results}
        loadingResults={loadingResults}
        followed={followed}
        sortField={sortField}
        sortDirection={sortDirection}
        selectionMode={selectionMode}
        user={user}
        status={status}
        onToggleRunner={toggleRunner}
        onSortFieldChange={setSortField}
        onSortDirectionToggle={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
      />

      <LiveResultsDisplay
        results={results}
        focusedRunnerName={focusedRunnerName}
        focusTrigger={focusTrigger}
      />

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      
      {showProfile && user && (
        <Profile
          user={user}
          onClose={() => setShowProfile(false)}
          onSignOut={async () => {
            await signOutUser()
            setShowProfile(false)
          }}
        />
      )}
    </div>
  )
}
