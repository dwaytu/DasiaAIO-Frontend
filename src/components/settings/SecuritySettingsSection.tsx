import { FC, useState } from 'react'
import { KeyRound } from 'lucide-react'
import ChangePasswordDialog from '../shared/ChangePasswordDialog'

type SecuritySettingsSectionProps = { userId: string }

const SecuritySettingsSection: FC<SecuritySettingsSectionProps> = ({ userId }) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [message, setMessage] = useState('')
  return (
    <section className="command-panel p-4 md:p-6" aria-labelledby="security-settings-title">
      <h2 id="security-settings-title" className="text-xl font-bold text-text-primary md:text-2xl">Security</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">Manage the password that protects this account.</p>
      <div className="mt-4 flex flex-col gap-3 rounded border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
          <div><p className="font-semibold text-text-primary">Change password</p><p className="mt-1 text-sm leading-5 text-text-secondary">Use your current password to set a new one.</p></div>
        </div>
        <button type="button" onClick={() => setDialogOpen(true)} className="soc-btn soc-btn-neutral min-h-11 shrink-0">Change Password</button>
      </div>
      {message ? <p className="mt-3 text-sm text-success-text" role="status">{message}</p> : null}
      <ChangePasswordDialog userId={userId} open={dialogOpen} onClose={() => setDialogOpen(false)} onSuccess={() => setMessage('Password changed successfully.')} />
    </section>
  )
}

export default SecuritySettingsSection
