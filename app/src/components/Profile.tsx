import { useEffect, useState } from 'preact/hooks'
import type { User } from 'firebase/auth'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db, getCurrentFCMToken } from '../services/firebase'
import { removeSelection } from '../services/selections'
import { fetchCompetitions } from '../services/liveResults'
import type { Competition } from '../types/live-results'

const buttonBase =
  'rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]'

type Selection = {
  competitionId: string
  className: string
  runnerName: string
  fcmToken?: string
  createdAt: Timestamp | number
  startTime?: number
}

type GroupedSelections = {
  thisDevice: Selection[]
  otherDevices: Selection[]
}

type ProfileProps = {
  user: User
  onClose: () => void
  onSignOut: () => void
}

export function Profile({ user, onClose, onSignOut }: ProfileProps) {
  const [selections, setSelections] = useState<GroupedSelections>({
    thisDevice: [],
    otherDevices: [],
  })
  const [loading, setLoading] = useState(true)
  const [removingRunner, setRemovingRunner] = useState<string | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        
        // Load competitions and selections in parallel
        const [comps, currentToken] = await Promise.all([
          fetchCompetitions(),
          getCurrentFCMToken(),
        ])
        
        setCompetitions(comps)
        
        const selectionsRef = collection(db, 'selections')
        const q = query(selectionsRef, where('userId', '==', user.uid))
        const snapshot = await getDocs(q)

        const thisDevice: Selection[] = []
        const otherDevices: Selection[] = []

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as Selection
          if (data.fcmToken === currentToken) {
            thisDevice.push(data)
          } else {
            otherDevices.push(data)
          }
        })

        // Sort by competition and class
        const sortFn = (a: Selection, b: Selection) => {
          const compCompare = a.competitionId.localeCompare(b.competitionId)
          if (compCompare !== 0) return compCompare
          return a.className.localeCompare(b.className)
        }

        setSelections({
          thisDevice: thisDevice.sort(sortFn),
          otherDevices: otherDevices.sort(sortFn),
        })
      } catch (error) {
        console.error('Failed to load selections:', error)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [user.uid])

  const handleUnfollow = async (competitionId: string, className: string, runnerName: string) => {
    const key = `${competitionId}-${className}-${runnerName}`
    setRemovingRunner(key)
    
    try {
      await removeSelection(user.uid, competitionId, className, runnerName)
      
      // Update local state
      setSelections((prev) => ({
        thisDevice: prev.thisDevice.filter(
          (s) => !(s.competitionId === competitionId && s.className === className && s.runnerName === runnerName)
        ),
        otherDevices: prev.otherDevices.filter(
          (s) => !(s.competitionId === competitionId && s.className === className && s.runnerName === runnerName)
        ),
      }))
    } catch (error) {
      console.error('Failed to unfollow runner:', error)
      alert('Failed to unfollow runner. Please try again.')
    } finally {
      setRemovingRunner(null)
    }
  }

  const groupByCompetitionClass = (selections: Selection[]) => {
    const groups = new Map<string, Selection[]>()
    
    selections.forEach((sel) => {
      const key = `${sel.competitionId}-${sel.className}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(sel)
    })

    return Array.from(groups.entries()).map(([, items]) => ({
      competitionId: items[0].competitionId,
      className: items[0].className,
      runners: items,
    }))
  }

  const getCompetitionName = (competitionId: string) => {
    const comp = competitions.find((c) => c.id.toString() === competitionId)
    return comp ? comp.name : `Competition #${competitionId}`
  }

  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div class="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-2xl font-semibold text-slate-900">Profile</h2>
          <button
            onClick={onClose}
            class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Account Information */}
        <section class="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 class="mb-3 text-lg font-semibold text-slate-900">Account</h3>
          <div class="space-y-2">
            <div>
              <span class="text-sm text-slate-500">Email:</span>
              <p class="font-medium text-slate-900">{user.email}</p>
            </div>
            <div>
              <span class="text-sm text-slate-500">User ID:</span>
              <p class="font-mono text-xs text-slate-600">{user.uid}</p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            class={`${buttonBase} mt-4 w-full bg-red-600 text-white hover:bg-red-700`}
          >
            Sign Out
          </button>
        </section>

        {/* Followed Runners */}
        <section>
          <h3 class="mb-3 text-lg font-semibold text-slate-900">Following</h3>
          
          {loading ? (
            <div class="flex items-center justify-center py-8">
              <div class="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-600"></div>
            </div>
          ) : (
            <>
              {/* This Device */}
              {selections.thisDevice.length > 0 && (
                <div class="mb-6">
                  <h4 class="mb-2 text-sm font-semibold text-emerald-700">
                    This Device ({selections.thisDevice.length})
                  </h4>
                  <div class="space-y-4">
                    {groupByCompetitionClass(selections.thisDevice).map((group) => (
                      <div
                        key={`${group.competitionId}-${group.className}`}
                        class="rounded-lg border border-emerald-200 bg-emerald-50 p-3"
                      >
                        <div class="mb-2 flex items-center justify-between">
                          <div>
                            <p class="text-sm font-semibold text-slate-900">
                              {getCompetitionName(group.competitionId)}
                            </p>
                            <p class="text-xs text-slate-600">{group.className}</p>
                          </div>
                          <span class="rounded-full bg-emerald-200 px-2 py-1 text-xs font-medium text-emerald-800">
                            {group.runners.length} runner{group.runners.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <ul class="mt-2 space-y-2">
                          {group.runners.map((runner) => {
                            const key = `${runner.competitionId}-${runner.className}-${runner.runnerName}`
                            const isRemoving = removingRunner === key
                            return (
                              <li
                                key={runner.runnerName}
                                class="flex items-center justify-between gap-2 rounded p-2 hover:bg-emerald-100"
                              >
                                <div class="flex-1">
                                  <span class="text-sm font-medium text-slate-700">{runner.runnerName}</span>
                                  {runner.startTime && (
                                    <span class="ml-2 text-xs text-slate-500">
                                      {new Date(runner.startTime).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleUnfollow(runner.competitionId, runner.className, runner.runnerName)}
                                  disabled={isRemoving}
                                  class="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50"
                                  title="Unfollow runner"
                                >
                                  {isRemoving ? (
                                    <div class="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                                  ) : (
                                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  )}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Devices */}
              {selections.otherDevices.length > 0 && (
                <div>
                  <h4 class="mb-2 text-sm font-semibold text-slate-700">
                    Other Devices ({selections.otherDevices.length})
                  </h4>
                  <div class="space-y-4">
                    {groupByCompetitionClass(selections.otherDevices).map((group) => (
                      <div
                        key={`${group.competitionId}-${group.className}`}
                        class="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div class="mb-2 flex items-center justify-between">
                          <div>
                            <p class="text-sm font-semibold text-slate-900">
                              {getCompetitionName(group.competitionId)}
                            </p>
                            <p class="text-xs text-slate-600">{group.className}</p>
                          </div>
                          <span class="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                            {group.runners.length} runner{group.runners.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <ul class="mt-2 space-y-2">
                          {group.runners.map((runner) => {
                            const key = `${runner.competitionId}-${runner.className}-${runner.runnerName}`
                            const isRemoving = removingRunner === key
                            return (
                              <li
                                key={runner.runnerName}
                                class="flex items-center justify-between gap-2 rounded p-2 hover:bg-slate-100"
                              >
                                <div class="flex-1">
                                  <span class="text-sm font-medium text-slate-700">{runner.runnerName}</span>
                                  {runner.startTime && (
                                    <span class="ml-2 text-xs text-slate-500">
                                      {new Date(runner.startTime).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleUnfollow(runner.competitionId, runner.className, runner.runnerName)}
                                  disabled={isRemoving}
                                  class="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50"
                                  title="Unfollow runner"
                                >
                                  {isRemoving ? (
                                    <div class="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                                  ) : (
                                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  )}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selections.thisDevice.length === 0 && selections.otherDevices.length === 0 && (
                <p class="py-8 text-center text-sm text-slate-500">
                  You're not following any runners yet.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
