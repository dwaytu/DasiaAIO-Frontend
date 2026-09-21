import { FC } from 'react'
import type { User } from '../../context/AuthContext'
import AccountSettingsSections from './AccountSettingsSections'
import SettingsDashboard from './SettingsDashboard'

type GuardSettingsProps = {
  user: User
  compact?: boolean
}

export const GuardSettings: FC<GuardSettingsProps> = ({ user, compact = false }) => {
  return (
    <SettingsDashboard
      title="Guard Settings"
      description="Manage device alerts, account security, and display preferences."
      compact={compact}
    >
      <AccountSettingsSections user={user} />
    </SettingsDashboard>
  )
}

export default GuardSettings
