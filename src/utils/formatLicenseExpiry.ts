export function formatLicenseExpiry(value: string | null | undefined, today: Date): string | null {
  if (!value) return null
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const expiry = new Date(dateOnly ? `${value}T00:00:00` : value)
  if (Number.isNaN(expiry.getTime())) return null

  const dateLabel = expiry.toLocaleDateString()
  const expiryDay = expiry.getDate()
  const todayDay = today.getDate()
  const monthDifference = (expiry.getFullYear() - today.getFullYear()) * 12 + expiry.getMonth() - today.getMonth()
  const expired = dateOnly
    ? monthDifference < 0 || (monthDifference === 0 && expiryDay < todayDay)
    : expiry <= today
  if (expired) return `${dateLabel} (Expired)`
  if (monthDifference === 0 && expiryDay === todayDay) return `${dateLabel} (Expires today)`

  const lastDayOfExpiryMonth = new Date(expiry.getFullYear(), expiry.getMonth() + 1, 0).getDate()
  const anniversaryDay = Math.min(todayDay, lastDayOfExpiryMonth)
  const wholeMonths = monthDifference - Number(expiryDay < anniversaryDay)
  if (wholeMonths < 1) return `${dateLabel} (Less than 1 month)`

  const years = Math.floor(wholeMonths / 12)
  const months = wholeMonths % 12
  const duration = [
    years ? `${years} ${years === 1 ? 'year' : 'years'}` : '',
    months ? `${months} ${months === 1 ? 'month' : 'months'}` : '',
  ].filter(Boolean).join(', ')
  return `${dateLabel} (${duration})`
}
