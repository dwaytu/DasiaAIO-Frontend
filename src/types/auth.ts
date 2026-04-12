export const ROLES = ['superadmin', 'admin', 'supervisor', 'guard', 'user'] as const

export type LegacyRole = typeof ROLES[number]
export type Role = Exclude<LegacyRole, 'user'>
const PRODUCT_ROLES = ['superadmin', 'admin', 'supervisor', 'guard'] as const

function normalizeRoleInput(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function isLegacyRole(value: unknown): value is LegacyRole {
  const normalized = normalizeRoleInput(value)
  return normalized != null && (ROLES as readonly string[]).includes(normalized)
}

export function normalizeRole(role: unknown): Role | null {
  const normalized = normalizeRoleInput(role)
  if (normalized == null) {
    return null
  }

  // Backward compatibility for pre-migration sessions that still store `user`.
  if (normalized === 'user') {
    return 'guard'
  }

  if (!(PRODUCT_ROLES as readonly string[]).includes(normalized)) {
    return null
  }

  return normalized as Role
}

export function isElevatedRole(role: unknown): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'superadmin' || normalized === 'admin' || normalized === 'supervisor'
}

export function hasTrackingEndpointAccess(role: unknown): boolean {
  const normalized = normalizeRole(role)
  if (normalized == null) return false

  return normalized === 'guard' || isElevatedRole(normalized)
}

export function canProduceTrackingHeartbeat(role: unknown): boolean {
  const normalized = normalizeRole(role)
  if (normalized == null) return false

  return normalized === 'guard' || normalized === 'supervisor'
}

export function canManageTrackingSites(role: unknown): boolean {
  return isElevatedRole(role)
}
