import { FC, useEffect, useState } from 'react'
import type { User } from '../../context/AuthContext'
import NotificationSettingsSection from './NotificationSettingsSection'
import SettingsDashboard from './SettingsDashboard'
import { defaultNotificationSettings, loadRoleSettings, NotificationSettings, saveRoleSettings } from './settingsStorage'
import { useRoleSettingsRole } from './useRoleSettings'

type GuardSettingsProps = {
  user: User
  compact?: boolean
}

export const GuardSettings: FC<GuardSettingsProps> = ({ user, compact = false }) => {
  const role = useRoleSettingsRole(user.role)
  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    loadRoleSettings(role, 'notifications', defaultNotificationSettings),
  )

  useEffect(() => {
    saveRoleSettings(role, 'notifications', notifications)
  }, [notifications, role])

  return (
    <SettingsDashboard
      title="Guard Settings"
      description="Manage how operational updates follow you through active shifts, recovery periods, and support workflows."
      compact={compact}
    >
      <NotificationSettingsSection settings={notifications} onChange={setNotifications} />
    </SettingsDashboard>
  )
}

export default GuardSettings