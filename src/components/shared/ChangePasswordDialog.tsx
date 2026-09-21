import { FormEvent, useRef, useState } from 'react'
import SentinelModal from './SentinelModal'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'

type ChangePasswordDialogProps = {
  userId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const ChangePasswordDialog = ({ userId, open, onClose, onSuccess }: ChangePasswordDialogProps) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const currentPasswordRef = useRef<HTMLInputElement>(null)

  const close = () => {
    if (saving) return
    setError('')
    onClose()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!currentPassword) {
      setError('Enter your current password.')
      currentPasswordRef.current?.focus()
      return
    }
    if (newPassword.length < 12) {
      setError('Use at least 12 characters for the new password.')
      return
    }
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.')
      return
    }

    setSaving(true)
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/users/${userId}/password/change`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        'Unable to change password.',
      )
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      onSuccess()
      onClose()
    } catch {
      setError('Unable to change password. Check your current password and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SentinelModal
      open={open}
      onClose={close}
      title="Change Password"
      subtitle="Update the password used to access your SENTINEL account."
      size="sm"
      dismissible={!saving}
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        {error ? <p className="soc-alert-error text-sm" role="alert">{error}</p> : null}
        <div>
          <label htmlFor="settings-current-password" className="soc-form-label">Current password</label>
          <input
            ref={currentPasswordRef}
            id="settings-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="soc-form-control w-full"
            aria-invalid={Boolean(error && !currentPassword)}
            required
          />
        </div>
        <div>
          <label htmlFor="settings-new-password" className="soc-form-label">New password</label>
          <input
            id="settings-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="soc-form-control w-full"
            required
          />
          <p className="mt-1 text-xs leading-5 text-text-secondary">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
        </div>
        <div>
          <label htmlFor="settings-confirm-password" className="soc-form-label">Confirm new password</label>
          <input
            id="settings-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="soc-form-control w-full"
            required
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} disabled={saving} className="soc-btn soc-btn-neutral min-h-11 disabled:cursor-not-allowed disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="soc-btn soc-btn-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Changing password...' : 'Change Password'}
          </button>
        </div>
      </form>
    </SentinelModal>
  )
}

export default ChangePasswordDialog
