import { FC } from 'react'
import type { User } from '../../context/AuthContext'
import AppearanceSettingsSection from './AppearanceSettingsSection'
import NotificationSettingsSection from './NotificationSettingsSection'
import SecuritySettingsSection from './SecuritySettingsSection'

const AccountSettingsSections: FC<{ user: User }> = ({ user }) => (
  <><NotificationSettingsSection userId={user.id} /><SecuritySettingsSection userId={user.id} /><AppearanceSettingsSection /></>
)

export default AccountSettingsSections
