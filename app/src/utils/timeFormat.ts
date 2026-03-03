/**
 * Format centiseconds (hundredths of a second) into mm:ss or h:mm:ss.
 * E.g. 85900 → "14:19", 360000 → "1:00:00".
 * Returns the value as-is if it is already a string.
 */
export function formatCentiseconds(value: string | number): string {
  // If the string is already formatted (contains ":"), return as-is.
  // If it's a numeric string (e.g. "24018"), parse it as a number first.
  if (typeof value === 'string') {
    if (value.includes(':')) {
      return value
    }
    return formatCentiseconds(parseInt(value, 10))
  }
  const totalSeconds = Math.floor(Math.abs(value) / 100)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`
}

/**
 * Format a timeplus value (time behind leader) with a "+" prefix.
 * E.g. 8100 → "+1:21", 0 → "+0:00".
 * Returns the value as-is if it is already a string (e.g. "+").
 */
export function formatTimeplus(value: string | number): string {
  return `+${formatCentiseconds(value)}`
}

/**
 * Format split time values in a splits record.
 * Numeric control-code keys (e.g. "1065") get their values formatted;
 * metadata keys (e.g. "1065_status", "1065_place") are left unchanged.
 */
export function formatSplitTimes(
  splits: Record<string, string | number>,
): Record<string, string | number> {
  const formatted: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(splits)) {
    if (/^\d+$/.test(key) && typeof value === 'number' && value > 0) {
      formatted[key] = formatCentiseconds(value)
    } else {
      formatted[key] = value
    }
  }
  return formatted
}
