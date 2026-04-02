import { FC, useEffect, useState } from 'react'
import { User } from '../../App'
import NotificationSettingsSection from './NotificationSettingsSection'
import SettingsDashboard from './SettingsDashboard'
import { defaultNotificationSettings, loadRoleSettings, NotificationSettings, saveRoleSettings } from './settingsStorage'
import { useRoleSettingsRole } from './useRoleSettings'

type GuardSettingsProps = {
  user: User
}

export const GuardSettings: FC<GuardSettingsProps> = ({ user }) => {
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
    >
      <NotificationSettingsSection settings={notifications} onChange={setNotifications} />
    </SettingsDashboard>
  )
}

export default GuardSettings