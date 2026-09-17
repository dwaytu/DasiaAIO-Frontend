import { FC, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import SentinelModal from '../shared/SentinelModal'

interface RequiredPasswordChangeModalProps {
  userId: string
  onComplete: () => void
  onLogout: () => Promise<void>
}

const RequiredPasswordChangeModal: FC<RequiredPasswordChangeModalProps> = ({ userId, onComplete, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (newPassword.length < 12) {
      setError('Use at least 12 characters.')
      return
    }
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.')
      return
    }

    try {
      setSaving(true)
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/users/${userId}/password/change`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        'Failed to change password',
      )
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SentinelModal
      open
      onClose={() => undefined}
      title="Create your new password"
      subtitle="Your temporary password must be replaced before you can continue."
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="soc-alert-warning flex items-start gap-3 text-sm">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>Ask your supervisor or administrator for the temporary password if you do not have it.</p>
        </div>
        {error ? <div className="soc-alert-error text-sm" role="alert">{error}</div> : null}
        <div>
          <label htmlFor="current-password" className="soc-form-label">Temporary password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="soc-form-control w-full"
            required
          />
        </div>
        <div>
          <label htmlFor="new-password" className="soc-form-label">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="soc-form-control w-full"
            required
          />
          <p className="mt-1 text-xs text-text-tertiary">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
        </div>
        <div>
          <label htmlFor="confirm-new-password" className="soc-form-label">Confirm new password</label>
          <input
            id="confirm-new-password"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="soc-form-control w-full"
            required
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="soc-btn soc-btn-neutral" disabled={saving} onClick={() => void onLogout()}>
            Log out
          </button>
          <button type="submit" className="soc-btn soc-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save new password'}
          </button>
        </div>
      </form>
    </SentinelModal>
  )
}

export default RequiredPasswordChangeModal
