import { FC } from 'react'
import type { User } from '../../context/AuthContext'
import AccountSettingsSections from './AccountSettingsSections'
import SettingsDashboard from './SettingsDashboard'

type AdminSettingsProps = {
  user: User
  compact?: boolean
}

export const AdminSettings: FC<AdminSettingsProps> = ({ user, compact = false }) => {
  return (
    <SettingsDashboard
      title="Admin Settings"
      description="Manage device alerts, account security, and display preferences."
      compact={compact}
    >
      <AccountSettingsSections user={user} />
    </SettingsDashboard>
  )
}

export default AdminSettings
