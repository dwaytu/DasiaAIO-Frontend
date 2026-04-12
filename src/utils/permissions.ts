import { Role, normalizeRole } from '../types/auth'

export type Permission =
  | 'manage_users'
  | 'view_audit_logs'
  | 'approve_guards'
  | 'view_analytics'
  | 'manage_firearms'
  | 'manage_allocations'
  | 'manage_permits'
  | 'manage_maintenance'
  | 'manage_armored_cars'
  | 'view_guard_workspace'

const rolePermissions: Record<Role, Permission[]> = {
  superadmin: [
    'manage_users',
    'view_audit_logs',
    'approve_guards',
    'view_analytics',
    'manage_firearms',
    'manage_allocations',
    'manage_permits',
    'manage_maintenance',
    'manage_armored_cars',
    'view_guard_workspace',
  ],
  admin: [
    'manage_users',
    'approve_guards',
    'view_analytics',
    'manage_firearms',
    'manage_allocations',
    'manage_permits',
    'manage_maintenance',
    'manage_armored_cars',
    'view_guard_workspace',
  ],
  supervisor: [
    'approve_guards',
    'view_analytics',
    'manage_firearms',
    'manage_allocations',
    'manage_permits',
    'manage_maintenance',
    'manage_armored_cars',
    'view_guard_workspace',
  ],
  guard: ['view_guard_workspace'],
}

export function can(roleInput: unknown, permission: Permission): boolean {
  const role = normalizeRole(roleInput)
  if (role == null) return false

  return rolePermissions[role].includes(permission)
}

export function canAny(roleInput: unknown, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(roleInput, permission))
}

export function canAll(roleInput: unknown, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(roleInput, permission))
}
