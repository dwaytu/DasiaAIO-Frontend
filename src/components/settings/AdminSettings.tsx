import { FC, useEffect, useState } from 'react'
import type { User } from '../../context/AuthContext'
import NotificationSettingsSection from './NotificationSettingsSection'
import SettingsDashboard from './SettingsDashboard'
import { defaultNotificationSettings, loadRoleSettings, NotificationSettings, saveRoleSettings } from './settingsStorage'
import { useRoleSettingsRole } from './useRoleSettings'

type AdminSettingsProps = {
  user: User
  compact?: boolean
}

export const AdminSettings: FC<AdminSettingsProps> = ({ user, compact = false }) => {
  const role = useRoleSettingsRole(user.role)
  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    loadRoleSettings(role, 'notifications', defaultNotificationSettings),
  )

  useEffect(() => {
    saveRoleSettings(role, 'notifications', notifications)
  }, [notifications, role])

  return (
    <SettingsDashboard
      title="Admin Settings"
      description="Keep the notification MVP consistent while reserving room for later administrative governance controls."
      compact={compact}
    >
      <NotificationSettingsSection settings={notifications} onChange={setNotifications} />
      <section className="command-panel p-4 md:p-6">
        <h2 className="text-xl font-bold text-text-primary md:text-2xl">Admin Settings</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Additional controls are planned for a later wave. This MVP keeps notifications available without introducing a new backend contract.
        </p>
      </section>
    </SettingsDashboard>
  )
}

export default AdminSettings