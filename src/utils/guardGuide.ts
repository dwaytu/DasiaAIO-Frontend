const STORAGE_PREFIX = 'sentinel.guard-guide.v1'

export type GuardGuidePreference = 'dismissed' | 'completed'

export function guardGuideStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

export function getGuardGuidePreference(userId: string): GuardGuidePreference | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(guardGuideStorageKey(userId))
  return value === 'dismissed' || value === 'completed' ? value : null
}

export function saveGuardGuidePreference(userId: string, preference: GuardGuidePreference): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(guardGuideStorageKey(userId), preference)
}
