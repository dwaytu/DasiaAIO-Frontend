import { FC } from 'react'
import type { User } from '../../context/AuthContext'
import AccountSettingsSections from './AccountSettingsSections'
import SettingsDashboard from './SettingsDashboard'

type SupervisorSettingsProps = { user: User; compact?: boolean }

export const SupervisorSettings: FC<SupervisorSettingsProps> = ({ user, compact = false }) => (
  <SettingsDashboard title="Supervisor Settings" description="Manage device alerts, account security, and display preferences." compact={compact}>
    <AccountSettingsSections user={user} />
  </SettingsDashboard>
)

export default SupervisorSettings
