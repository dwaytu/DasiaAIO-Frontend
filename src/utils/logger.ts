const AUTH_NOISE_PATTERNS = [
  'invalid or expired token',
  'invalidtoken',
  'session expired',
  'please log in again',
  'jwt',
]

function normalizeErrorMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error.toLowerCase()
  if (error instanceof Error) return error.message.toLowerCase()
  return String(error).toLowerCase()
}

export function isExpectedAuthNoise(error: unknown): boolean {
  const message = normalizeErrorMessage(error)
  if (!message) return false
  return AUTH_NOISE_PATTERNS.some((pattern) => message.includes(pattern))
}

export function logError(context: string, error: unknown): void {
  if (isExpectedAuthNoise(error)) return
  console.error(context, error)
}
