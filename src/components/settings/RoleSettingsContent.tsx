import { FC } from 'react'
import type { User } from '../../context/AuthContext'
import GuardSettings from './GuardSettings'
import SupervisorSettings from './SupervisorSettings'
import AdminSettings from './AdminSettings'
import SuperadminSettings from './SuperadminSettings'
import { useRoleSettingsRole } from './useRoleSettings'

type RoleSettingsContentProps = {
  user: User
}

export const RoleSettingsContent: FC<RoleSettingsContentProps> = ({ user }) => {
  const role = useRoleSettingsRole(user.role)

  if (role === 'superadmin') return <SuperadminSettings user={user} />
  if (role === 'admin') return <AdminSettings user={user} />
  if (role === 'supervisor') return <SupervisorSettings user={user} />
  return <GuardSettings user={user} />
}

export default RoleSettingsContent