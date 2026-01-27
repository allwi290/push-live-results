import type { Competition } from '../types/live-results'

export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayOnly = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate(),
  )

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Today'
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }
}

export function groupCompetitionsByDate(
  competitions: Competition[],
): { label: string; competitions: Competition[] }[] {
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
  const otherDates = Object.keys(groups)
    .filter((key) => !order.includes(key))
    .sort()
  const sortedKeys = [...order.filter((key) => groups[key]), ...otherDates]

  return sortedKeys.map((label) => ({
    label,
    competitions: groups[label],
  }))
}
