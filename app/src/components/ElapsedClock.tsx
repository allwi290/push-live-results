import { useState, useEffect } from 'preact/hooks'

type ElapsedClockProps = {
  startTimestamp: number // UTC milliseconds since epoch
}

function formatElapsed(ms: number): string {
  if (ms < 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const mm = minutes.toString().padStart(2, '0')
  const ss = seconds.toString().padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

export function ElapsedClock({ startTimestamp }: ElapsedClockProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const elapsed = now - startTimestamp

  return <span class="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
}
