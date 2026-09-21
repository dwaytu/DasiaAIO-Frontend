import { FC } from 'react'
import type { User } from '../../context/AuthContext'
import AccountSettingsSections from './AccountSettingsSections'
import SettingsDashboard from './SettingsDashboard'

type SuperadminSettingsProps = {
  user: User
  compact?: boolean
}

export const SuperadminSettings: FC<SuperadminSettingsProps> = ({ user, compact = false }) => {
  return (
    <SettingsDashboard
      title="Superadmin Settings"
      description="Manage device alerts, account security, and display preferences."
      compact={compact}
    >
      <AccountSettingsSections user={user} />
    </SettingsDashboard>
  )
}

export default SuperadminSettings
