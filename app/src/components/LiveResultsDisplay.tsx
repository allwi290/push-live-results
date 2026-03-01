import { useEffect } from 'preact/hooks'
import { getStatusText } from '../utils/statusUtils'
import { ElapsedClock } from './ElapsedClock'
import type { ResultEntry } from '../types/live-results'

type LiveResultsDisplayProps = {
  results: ResultEntry[]
  competitionDate?: string
  competitionTimediff?: number
  focusedRunnerName?: string
  focusTrigger?: number
}

/**
 * Convert a runner's start time (centiseconds since midnight) to a UTC
 * timestamp in milliseconds.
 *
 * `timediff` is the number of hours the competition timezone is ahead of CET.
 * CET = UTC+1, so competition UTC offset = 1 + timediff.
 */
function getStartTimestamp(
  competitionDate: string,
  startCentiseconds: number,
  timediff: number,
): number {
  const [year, month, day] = competitionDate.split('-').map(Number)
  const midnightUtc = Date.UTC(year, month - 1, day)
  const offsetHours = 1 + timediff // competition timezone as UTC offset
  const midnightCompInUtc = midnightUtc - offsetHours * 3600_000
  return midnightCompInUtc + startCentiseconds * 10
}

function hasStarted(
  competitionDate: string | undefined,
  startCentiseconds: number,
  timediff: number,
): boolean {
  if (!competitionDate) return false
  return Date.now() >= getStartTimestamp(competitionDate, startCentiseconds, timediff)
}

/**
 * Return a human-readable progress message based on radio control data.
 */
function getProgressMessage(
  totalControls: number | undefined,
  passedControls: number | undefined,
): string {
  const total = totalControls ?? 0
  const passed = passedControls ?? 0

  if (total === 0) {
    return 'Started \u2014 waiting for finish'
  }

  if (total === 1) {
    if (passed === 0) {
      return 'Started \u2014 waiting for radio control'
    }
    return 'Passed radio control \u2014 waiting for finish'
  }

  // Multiple controls
  if (passed === 0) {
    return `Started \u2014 waiting for radio control 1 of ${total}`
  }

  if (passed >= total) {
    return 'Passed all radio controls \u2014 waiting for finish'
  }

  return `Passed radio control ${passed} of ${total} \u2014 waiting for control ${passed + 1} of ${total}`
}

export function LiveResultsDisplay({
  results,
  competitionDate,
  competitionTimediff = 0,
  focusedRunnerName,
  focusTrigger,
}: LiveResultsDisplayProps) {
  useEffect(() => {
    if (!focusedRunnerName || results.length === 0) return

    const sectionElement = document.getElementById('live-results-section')
    sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    const targetRunnerName = focusedRunnerName.trim().toLowerCase()
    const focusedElement = document.querySelector<HTMLElement>(
      `[data-runner-name="${CSS.escape(targetRunnerName)}"]`
    )

    focusedElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusedRunnerName, focusTrigger, results])

  // In-forest: status 9 or 10 whose start time has already passed
  const inForest = results
    .filter(
      (r) =>
        (r.status === 9 || r.status === 10) &&
        hasStarted(competitionDate, r.start, competitionTimediff),
    )
    .sort((a, b) => b.progress - a.progress || a.start - b.start)

  // Waiting to start: status 9 or 10 whose start time has NOT passed yet
  const waiting = results
    .filter(
      (r) =>
        (r.status === 9 || r.status === 10) &&
        !hasStarted(competitionDate, r.start, competitionTimediff),
    )
    .sort((a, b) => a.start - b.start)

  // Finished / error statuses (everything except 9/10)
  const finished = results
    .filter((r) => r.status !== 9 && r.status !== 10)
    .sort((a, b) => a.status - b.status)

  return (
    <section id="live-results-section" class="rounded-2xl bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Live results</h2>
        <span class="text-xs text-slate-500">Updated as data arrives</span>
      </div>
      <div class="mt-3 space-y-2">
        {/* ---------- In-forest runners ---------- */}
        {inForest.length > 0 && (
          <h3 class="text-xs font-medium uppercase tracking-wider text-emerald-700">
            In forest ({inForest.length})
          </h3>
        )}
        {inForest.map((result) => {
          const isFocused =
            focusedRunnerName?.trim().toLowerCase() ===
            result.name.trim().toLowerCase()
          const startTs = competitionDate
            ? getStartTimestamp(competitionDate, result.start, competitionTimediff)
            : null

          return (
            <article
              key={result.name}
              data-runner-name={result.name.trim().toLowerCase()}
              class={`rounded-xl border px-3 py-3 ${
                isFocused
                  ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                  : 'border-emerald-100 bg-emerald-50/50'
              }`}
            >
              <div class="flex items-center justify-between text-sm">
                <div>
                  <p class="font-semibold">{result.name}</p>
                  <p class="text-xs text-slate-500">{result.club || '—'}</p>
                  {result.className && (
                    <p class="text-xs text-slate-400">{result.className}</p>
                  )}
                </div>
                <div class="text-right">
                  {startTs && (
                    <p class="text-lg font-semibold text-emerald-700">
                      <ElapsedClock startTimestamp={startTs} />
                    </p>
                  )}
                </div>
              </div>
              <p class="mt-1 text-xs text-emerald-600">
                {getProgressMessage(
                  typeof result.totalControls === 'number' ? result.totalControls : undefined,
                  typeof result.passedControls === 'number' ? result.passedControls : undefined
                )}
              </p>
            </article>
          )
        })}

        {/* ---------- Waiting to start ---------- */}
        {waiting.length > 0 && (
          <h3 class="pt-2 text-xs font-medium uppercase tracking-wider text-amber-700">
            Waiting to start ({waiting.length})
          </h3>
        )}
        {waiting.map((result) => {
          const isFocused =
            focusedRunnerName?.trim().toLowerCase() ===
            result.name.trim().toLowerCase()
          return (
            <article
              key={result.name}
              data-runner-name={result.name.trim().toLowerCase()}
              class={`rounded-xl border px-3 py-3 ${
                isFocused
                  ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                  : 'border-amber-100 bg-amber-50/50'
              }`}
            >
              <div class="flex items-center justify-between text-sm">
                <div>
                  <p class="font-semibold">{result.name}</p>
                  <p class="text-xs text-slate-500">{result.club || '—'}</p>
                  {result.className && (
                    <p class="text-xs text-slate-400">{result.className}</p>
                  )}
                </div>
                <div class="text-right text-xs text-amber-600">
                  <p>Not started yet</p>
                </div>
              </div>
            </article>
          )
        })}

        {/* ---------- Finished / error runners ---------- */}
        {finished.length > 0 && (inForest.length > 0 || waiting.length > 0) && (
          <h3 class="pt-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Finished ({finished.length})
          </h3>
        )}
        {finished.map((result) => {
          const statusText = getStatusText(result.status)
          const isOK = result.status === 0
          const inProgress = result.progress < 100
          const isFocused =
            focusedRunnerName?.trim().toLowerCase() ===
            result.name.trim().toLowerCase()
          return (
            <article
              key={result.name}
              data-runner-name={result.name.trim().toLowerCase()}
              class={`rounded-xl border px-3 py-3 ${
                isFocused
                  ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div class="flex items-center justify-between text-sm">
                <div>
                  <p class="font-semibold">{result.name}</p>
                  <p class="text-xs text-slate-500">{result.club || '—'}</p>
                  <p class="text-xs text-slate-400">{result.className}</p>
                </div>
                <div class="text-right text-xs text-slate-600">
                  {isOK ? <p>Pos {result.place}</p> : <p>{statusText}</p>}
                </div>
              </div>
              {isOK && (
                <>
                  <div class="mt-2 grid grid-cols-2 text-xs text-slate-600">
                    <span>Result: {result.result}</span>
                    <span class="text-right">{result.timeplus}</span>
                  </div>
                  {inProgress && (
                    <p class="mt-1 text-[11px] text-slate-400">
                      Progress: {result.progress}%
                    </p>
                  )}
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
  )
}
