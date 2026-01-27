import { getStatusText } from '../utils/statusUtils'
import type { ResultEntry } from '../types/live-results'

type LiveResultsDisplayProps = {
  results: ResultEntry[]
}

export function LiveResultsDisplay({ results }: LiveResultsDisplayProps) {
  return (
    <section class="rounded-2xl bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Live results</h2>
        <span class="text-xs text-slate-500">Updated as data arrives</span>
      </div>
      <div class="mt-3 space-y-2">
        {results
          .filter((a) => a.status !== 9 && a.status !== 10)
          .sort((a, b) => a.status - b.status)
          .map((result) => {
            const statusText = getStatusText(result.status)
            const isOK = result.status === 0
            const inProgress = result.progress < 100
            return (
              <article
                key={result.name}
                class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
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
