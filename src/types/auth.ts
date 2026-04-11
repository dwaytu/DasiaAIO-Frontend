export const ROLES = ['superadmin', 'admin', 'supervisor', 'guard', 'user'] as const

export type LegacyRole = typeof ROLES[number]
export type Role = Exclude<LegacyRole, 'user'>

function normalizeRoleInput(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function isLegacyRole(value: unknown): value is LegacyRole {
  const normalized = normalizeRoleInput(value)
  return normalized != null && (ROLES as readonly string[]).includes(normalized)
}

export function normalizeRole(role: unknown): Role {
  const normalized = normalizeRoleInput(role)
  if (normalized == null || !(ROLES as readonly string[]).includes(normalized)) {
    return 'guard'
  }

  return normalized === 'user' ? 'guard' : (normalized as Role)
}

export function isElevatedRole(role: unknown): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'superadmin' || normalized === 'admin' || normalized === 'supervisor'
}

export function hasTrackingEndpointAccess(role: unknown): boolean {
  if (!isLegacyRole(role)) return false

  const normalized = normalizeRole(role)
  return normalized === 'guard' || isElevatedRole(normalized)
}

export function canManageTrackingSites(role: unknown): boolean {
  return isElevatedRole(role)
}
