import { Role, normalizeRole } from '../types/auth'

export type Permission =
  | 'manage_users'
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
  return rolePermissions[role].includes(permission)
}
