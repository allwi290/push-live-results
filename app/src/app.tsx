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
import { addSelection, removeSelection, loadSelections } from './services/selections'
import { AuthModal } from './components/AuthModal'
import { CompetitionSelector } from './components/CompetitionSelector'
import { RunnerFollower } from './components/RunnerFollower'
import { LiveResultsDisplay } from './components/LiveResultsDisplay'
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
  const [sortField, setSortField] = useState<'name' | 'secondary'>(() => {
    const saved = localStorage.getItem('sortField')
    return saved === 'secondary' ? 'secondary' : 'name'
  })
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('sortDirection')
    return saved === 'desc' ? 'desc' : 'asc'
  })

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
              <p class="text-sm font-medium">
                {user.displayName || user.email || 'Account'}
              </p>
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

      <LiveResultsDisplay results={results} />

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}
