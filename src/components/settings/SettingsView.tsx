import { FC } from 'react'
import { User } from '../../App'
import { getSidebarNav } from '../../config/navigation'
import OperationalShell from '../layout/OperationalShell'
import GuardSettings from './GuardSettings'
import SupervisorSettings from './SupervisorSettings'
import AdminSettings from './AdminSettings'
import SuperadminSettings from './SuperadminSettings'
import { useRoleSettingsRole } from './useRoleSettings'

type SettingsViewProps = {
  user: User
  onLogout: () => void
  onViewChange: (view: string) => void
}

export const SettingsView: FC<SettingsViewProps> = ({ user, onLogout, onViewChange }) => {
  const role = useRoleSettingsRole(user.role)
  const homeView = role === 'guard' ? 'overview' : 'dashboard'
  const navItems = getSidebarNav(user.role, { homeView })

  const content = role === 'superadmin'
    ? <SuperadminSettings user={user} />
    : role === 'admin'
      ? <AdminSettings user={user} />
      : role === 'supervisor'
        ? <SupervisorSettings user={user} />
        : <GuardSettings user={user} />

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
      {content}
    </OperationalShell>
  )
}

export default SettingsView