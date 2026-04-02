export type NotificationSettings = {
  push: boolean
  email: boolean
  inApp: boolean
}

export type SupervisorAlertSettings = {
  approvalQueue: boolean
  incidentEscalations: boolean
}

export const defaultNotificationSettings: NotificationSettings = {
  push: false,
  email: false,
  inApp: true,
}

export const defaultSupervisorAlertSettings: SupervisorAlertSettings = {
  approvalQueue: false,
  incidentEscalations: true,
}

export function getRoleSettingsStorageKey(role: string, category: string): string {
  return `settings.${role}.${category}`
}

export function loadRoleSettings<T>(role: string, category: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = localStorage.getItem(getRoleSettingsStorageKey(role, category))
    if (!raw) return fallback

    return { ...fallback, ...(JSON.parse(raw) as T) }
  } catch {
    return fallback
  }
}

export function saveRoleSettings<T>(role: string, category: string, value: T): void {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(getRoleSettingsStorageKey(role, category), JSON.stringify(value))
}