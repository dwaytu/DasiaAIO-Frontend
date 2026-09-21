export function formatInboxTimestamp(value: string, now = Date.now()): string {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Date unavailable'

  const elapsed = Math.max(0, now - timestamp)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  if (hours < 48) return 'Yesterday'

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatBusinessDate(value: string): string {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return value

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getComplianceExpiryLabel(title: string, message: string): string | null {
  const dateMatch = message.match(/expiry date:\s*(\d{4}-\d{2}-\d{2})/i)
  if (!dateMatch) return null

  const prefix = /expired/i.test(title) ? 'Expired' : 'Expires'
  return `${prefix} ${formatBusinessDate(dateMatch[1])}`
}
