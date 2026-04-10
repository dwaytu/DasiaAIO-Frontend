import { FC } from 'react'
import type { User } from '../../context/AuthContext'
import { getSidebarNav } from '../../config/navigation'
import OperationalShell from '../layout/OperationalShell'
import { useRoleSettingsRole } from './useRoleSettings'
import RoleSettingsContent from './RoleSettingsContent'

type SettingsViewProps = {
  user: User
  onLogout: () => void
  onViewChange: (view: string) => void
}

export const SettingsView: FC<SettingsViewProps> = ({ user, onLogout, onViewChange }) => {
  const role = useRoleSettingsRole(user.role)
  const homeView = role === 'guard' ? 'overview' : 'dashboard'
  const navItems = getSidebarNav(user.role, { homeView })

  return (
    <OperationalShell
      user={user}
      title="Settings"
      badgeLabel="Settings"
      navItems={navItems}
      activeView="settings"
      onNavigate={onViewChange}
      onLogout={onLogout}
      mobileMenuOpen={false}
      onMenuOpen={() => undefined}
      onMenuClose={() => undefined}
      onLogoClick={() => onViewChange(homeView)}
    >
      <RoleSettingsContent user={user} onViewChange={onViewChange} />
    </OperationalShell>
  )
}

export default SettingsView