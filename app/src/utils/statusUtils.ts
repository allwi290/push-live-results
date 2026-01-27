export function getStatusText(status: number): string {
  const statusMap: Record<number, string> = {
    0: 'OK',
    1: 'Did not start',
    2: 'Did not finished',
    3: 'Missing punch',
    4: 'Disqualified',
    5: 'Over max time',
    9: 'Not Started',
    10: 'Not Started',
    11: 'Walk Over',
    12: 'Moved Up',
  }
  return statusMap[status] || 'Unknown'
}
