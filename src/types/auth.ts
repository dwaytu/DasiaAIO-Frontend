export const ROLES = ['superadmin', 'admin', 'supervisor', 'guard', 'user'] as const

export type LegacyRole = typeof ROLES[number]
export type Role = Exclude<LegacyRole, 'user'>

export function isLegacyRole(value: unknown): value is LegacyRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function normalizeRole(role: unknown): Role {
  if (!isLegacyRole(role)) {
    return 'guard'
  }

  return role === 'user' ? 'guard' : role
}

export function isElevatedRole(role: unknown): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'superadmin' || normalized === 'admin' || normalized === 'supervisor'
}
