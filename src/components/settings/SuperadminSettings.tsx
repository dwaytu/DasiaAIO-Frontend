import { FC, useEffect, useState } from 'react'
import type { User } from '../../context/AuthContext'
import NotificationSettingsSection from './NotificationSettingsSection'
import SettingsDashboard from './SettingsDashboard'
import { defaultNotificationSettings, loadRoleSettings, NotificationSettings, saveRoleSettings } from './settingsStorage'
import { useRoleSettingsRole } from './useRoleSettings'

type SuperadminSettingsProps = {
  user: User
}

export const SuperadminSettings: FC<SuperadminSettingsProps> = ({ user }) => {
  const role = useRoleSettingsRole(user.role)
  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    loadRoleSettings(role, 'notifications', defaultNotificationSettings),
  )

  useEffect(() => {
    saveRoleSettings(role, 'notifications', notifications)
  }, [notifications, role])

  return (
    <SettingsDashboard
      title="Superadmin Settings"
      description="Reserve space for future system-wide governance controls while keeping notification delivery preferences available today."
    >
      <NotificationSettingsSection settings={notifications} onChange={setNotifications} />
      <section className="command-panel p-4 md:p-6">
        <h2 className="text-xl font-bold text-text-primary md:text-2xl">Superadmin Settings</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Additional controls are planned for a later wave. This MVP keeps notifications available without adding privileged backend endpoints.
        </p>
      </section>
    </SettingsDashboard>
  )
}

export default SuperadminSettings