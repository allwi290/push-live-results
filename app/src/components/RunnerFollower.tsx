import { getStatusText } from '../utils/statusUtils'
import type { ResultEntry } from '../types/live-results'

const buttonBase =
  'rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]'

type Status = { kind: 'idle' | 'info' | 'error' | 'success'; message: string }

type RunnerFollowerProps = {
  results: ResultEntry[]
  loadingResults: boolean
  followed: string[]
  sortField: 'name' | 'secondary'
  sortDirection: 'asc' | 'desc'
  selectionMode: 'class' | 'club'
  user: { uid: string } | null
  status: Status
  onToggleRunner: (runnerName: string) => void
  onSortFieldChange: (field: 'name' | 'secondary') => void
  onSortDirectionToggle: () => void
}

const formatStartTime = (startHundredsOfSeconds: number): string => {
  const hours = Math.floor(startHundredsOfSeconds / 360000)
  const minutes = Math.floor((startHundredsOfSeconds % 360000) / 6000)
  const seconds = Math.floor((startHundredsOfSeconds % 6000) / 100)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function RunnerFollower({
  results,
  loadingResults,
  followed,
  sortField,
  sortDirection,
  selectionMode,
  user,
  status,
  onToggleRunner,
  onSortFieldChange,
  onSortDirectionToggle,
}: RunnerFollowerProps) {
  const handleSortClick = (field: 'name' | 'secondary') => {
    if (sortField === field) {
      onSortDirectionToggle()
    } else {
      onSortFieldChange(field)
    }
  }

  return (
    <section class="mb-4 rounded-2xl bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Follow runners</h2>
        <span class="text-xs text-slate-500">
          {followed.length} {followed.length === 1 ? 'runner' : 'runners'} followed
        </span>
      </div>
      <div class="mt-3 flex gap-2">
        <button
          class={`${buttonBase} flex-1 text-xs py-2 ${
            sortField === 'name'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-700'
          }`}
          onClick={() => handleSortClick('name')}
          disabled={!results.length || loadingResults}
        >
          Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          class={`${buttonBase} flex-1 text-xs py-2 ${
            sortField === 'secondary'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-700'
          }`}
          onClick={() => handleSortClick('secondary')}
          disabled={!results.length || loadingResults}
        >
          {selectionMode === 'class' ? 'Club' : 'Class'}{' '}
          {sortField === 'secondary' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
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
        {!loadingResults &&
          [...results]
            .sort((a, b) => {
              if (sortField === 'name') {
                return sortDirection === 'asc'
                  ? a.name.localeCompare(b.name)
                  : b.name.localeCompare(a.name)
              } else {
                const fieldA =
                  selectionMode === 'class' ? a.club || '' : a.className || ''
                const fieldB =
                  selectionMode === 'class' ? b.club || '' : b.className || ''

                const compare =
                  sortDirection === 'asc'
                    ? fieldA.localeCompare(fieldB)
                    : fieldB.localeCompare(fieldA)

                return compare !== 0 ? compare : a.name.localeCompare(b.name)
              }
            })
            .map((result) => {
              const checked = followed.includes(result.name)
              const isSelectable =
                (result.status === 0 && result.progress < 100) ||
                result.status === 9 ||
                result.status === 10
              const statusText = getStatusText(result.status)
              return (
                <button
                  key={result.name}
                  onClick={() => isSelectable && onToggleRunner(result.name)}
                  disabled={!isSelectable}
                  class={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${
                    !isSelectable
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50'
                      : checked
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  <div>
                    <p class="font-semibold">{result.name}</p>
                    {result.club && <p class="text-xs text-slate-500">{result.club}</p>}
                    {result.className && (
                      <p class="text-xs text-slate-400">{result.className}</p>
                    )}
                    {!isSelectable && (
                      <p class="text-xs text-slate-400">
                        {result.progress >= 100 ? 'Finished' : statusText}
                      </p>
                    )}
                    {isSelectable && (result.status === 9 || result.status === 10) && result.start !== undefined && (
                      <p class="text-xs text-emerald-600 font-medium">Starts: {formatStartTime(result.start)}</p>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!isSelectable}
                    aria-label={`Follow ${result.name}`}
                    class="h-4 w-4 rounded border-slate-300 text-emerald-600 disabled:opacity-50"
                    readOnly
                  />
                </button>
              )
            })}
        {!loadingResults && !results.length && (
          <p class="text-sm text-slate-500">
            {user
              ? 'Select a class or club to see runners.'
              : 'Sign in and select a class to follow runners.'}
          </p>
        )}
      </div>
      {status.message && (
        <p
          class={`mt-2 text-sm ${
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
    </section>
  )
}
