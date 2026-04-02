import { useMemo } from 'react'
import { normalizeRole } from '../../types/auth'

export type SupportedSettingsRole = 'guard' | 'supervisor' | 'admin' | 'superadmin'

export function resolveSettingsRole(roleInput: unknown): SupportedSettingsRole {
  const role = normalizeRole(roleInput)

  if (role === 'superadmin' || role === 'admin' || role === 'supervisor') {
    return role
  }

  return 'guard'
}

export function useRoleSettingsRole(roleInput: unknown): SupportedSettingsRole {
  return useMemo(() => resolveSettingsRole(roleInput), [roleInput])
}