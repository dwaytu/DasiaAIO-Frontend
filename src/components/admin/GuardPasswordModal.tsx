import { FC, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import SentinelModal from '../shared/SentinelModal'

export interface GuardPasswordTarget {
  id: string
  full_name?: string
  username?: string
  email?: string
  role?: string
}

interface GuardPasswordModalProps {
  user: GuardPasswordTarget | null
  onClose: () => void
  onSuccess?: () => Promise<void> | void
}

const PASSWORD_LENGTH = 16
const PASSWORD_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'

function generateTemporaryPassword(): string {
  const values = new Uint32Array(PASSWORD_LENGTH)
  window.crypto.getRandomValues(values)
  const password = Array.from(values, (value) => PASSWORD_CHARACTERS[value % PASSWORD_CHARACTERS.length]).join('')
  return `aA1!${password.slice(0, 12)}`
}

const GuardPasswordModal: FC<GuardPasswordModalProps> = ({ user, onClose, onSuccess }) => {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setPassword(generateTemporaryPassword())
    setConfirmation('')
    setError('')
    setSuccess(false)
    setCopied(false)
  }, [user])

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy was not available. Select the password and copy it manually.')
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (password.length < 12) {
      setError('Use at least 12 characters.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }

    try {
      setSaving(true)
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/users/${user?.id}/password`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ password }),
        },
        'Failed to set the temporary password',
      )
      await onSuccess?.()
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set the temporary password')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <SentinelModal
      open={!!user}
      onClose={onClose}
      title="Set temporary password"
      subtitle={`Guard account: ${user.full_name || user.username || user.email || 'Guard'}`}
      size="sm"
    >
      {success ? (
        <div className="space-y-4">
          <div className="soc-alert-success flex items-start gap-3 text-sm" role="status">
            <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>Password updated. Give this temporary password to the guard. They must choose a new password after signing in.</p>
          </div>
          <div className="rounded border border-warning-border bg-warning-bg p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-warning-text">Temporary password</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary">{password}</code>
              <button type="button" onClick={() => void copyPassword()} className="soc-btn soc-btn-neutral shrink-0" aria-label="Copy temporary password">
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={onClose} className="soc-btn soc-btn-primary">Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="soc-alert-warning flex items-start gap-3 text-sm">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>This creates a one-time handoff password. The guard will be required to replace it after signing in.</p>
          </div>

          {error ? <div className="soc-alert-error text-sm" role="alert">{error}</div> : null}

          <div>
            <label htmlFor="guard-temporary-password" className="soc-form-label">Temporary password</label>
            <div className="flex gap-2">
              <input
                id="guard-temporary-password"
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="soc-form-control min-w-0 flex-1 font-mono"
              />
              <button type="button" onClick={() => { setPassword(generateTemporaryPassword()); setConfirmation('') }} className="soc-btn soc-btn-neutral shrink-0" aria-label="Generate another temporary password">
                <RefreshCw size={16} aria-hidden="true" />
                Generate
              </button>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
          </div>

          <div>
            <label htmlFor="guard-temporary-password-confirm" className="soc-form-label">Confirm temporary password</label>
            <input
              id="guard-temporary-password-confirm"
              type="text"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="soc-form-control w-full font-mono"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="soc-btn soc-btn-neutral" disabled={saving}>Cancel</button>
            <button type="submit" className="soc-btn soc-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Set temporary password'}
            </button>
          </div>
        </form>
      )}
    </SentinelModal>
  )
}

export default GuardPasswordModal
