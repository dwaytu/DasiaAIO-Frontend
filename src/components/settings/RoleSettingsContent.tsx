import { FC } from 'react'
import type { User } from '../../context/AuthContext'
import GuardSettings from './GuardSettings'
import SupervisorSettings from './SupervisorSettings'
import AdminSettings from './AdminSettings'
import SuperadminSettings from './SuperadminSettings'
import { useRoleSettingsRole } from './useRoleSettings'

type RoleSettingsContentProps = {
  user: User
  compact?: boolean
}

export const RoleSettingsContent: FC<RoleSettingsContentProps> = ({ user, compact = false }) => {
  const role = useRoleSettingsRole(user.role)

  if (role === 'superadmin') return <SuperadminSettings user={user} compact={compact} />
  if (role === 'admin') return <AdminSettings user={user} compact={compact} />
  if (role === 'supervisor') return <SupervisorSettings user={user} compact={compact} />
  return <GuardSettings user={user} compact={compact} />
}

export default RoleSettingsContent