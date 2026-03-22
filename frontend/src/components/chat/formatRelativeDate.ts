export function formatRelativeDate(value: string, now: Date = new Date()): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'just now'

  const diffMs = now.valueOf() - date.valueOf()
  if (diffMs <= 0) return 'just now'

  if (isSameCalendarDay(date, now)) {
    const totalMinutes = Math.floor(diffMs / 60000)
    if (totalMinutes < 1) return 'just now'
    if (totalMinutes < 60) {
      return `${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'} ago`
    }

    const totalHours = Math.floor(diffMs / 3600000)
    return `${totalHours} ${totalHours === 1 ? 'hour' : 'hours'} ago`
  }

  if (isYesterday(date, now)) {
    return 'yesterday'
  }

  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now)
  yesterday.setHours(0, 0, 0, 0)
  yesterday.setDate(yesterday.getDate() - 1)

  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  )
}
