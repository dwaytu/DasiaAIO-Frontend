import { FC, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { Role } from '../../types/auth'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import SentinelModal from '../shared/SentinelModal'

interface CreateGuardAccountModalProps {
  isOpen: boolean
  onClose: () => void
  viewerRole: Role | null
  onCreated?: () => Promise<void> | void
}

type FormState = {
  fullName: string
  guardNumber: string
  username: string
  email: string
  password: string
  phoneNumber: string
  licenseNumber: string
  licenseIssuedDate: string
  licenseExpiryDate: string
  address: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

const VIEWER_CAN_CREATE_GUARD: Record<Role, boolean> = {
  superadmin: true,
  admin: true,
  supervisor: true,
  guard: false,
}

const initialState = (): FormState => {
  const today = new Date().toISOString().slice(0, 10)
  return {
    fullName: '',
    guardNumber: '',
    username: '',
    email: '',
    password: '',
    phoneNumber: '',
    licenseNumber: '',
    licenseIssuedDate: today,
    licenseExpiryDate: '',
    address: '',
  }
}

const sanitizeToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const buildSuggestedUsername = (fullName: string, guardNumber: string) => {
  const nameToken = sanitizeToken(fullName)
  const guardToken = sanitizeToken(guardNumber)
  if (nameToken && guardToken) return `${nameToken}_${guardToken}`
  if (nameToken) return nameToken
  if (guardToken) return `guard_${guardToken}`
  return ''
}

const CreateGuardAccountModal: FC<CreateGuardAccountModalProps> = ({
  isOpen,
  onClose,
  viewerRole,
  onCreated,
}) => {
  const canCreate = viewerRole != null && VIEWER_CAN_CREATE_GUARD[viewerRole]
  const [form, setForm] = useState<FormState>(() => initialState())
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [usernameCustomized, setUsernameCustomized] = useState(false)
  const [emailCustomized, setEmailCustomized] = useState(false)
  const fullNameRef = useRef<HTMLInputElement>(null)

  const modalDescription = useMemo(
    () =>
      'Use MDR roster details to create a login-ready guard account (full name, guard number, phone, and license data).',
    [],
  )

  useEffect(() => {
    if (!isOpen) return
    setForm(initialState())
    setErrors({})
    setSubmitError('')
    setUsernameCustomized(false)
    setEmailCustomized(false)
    window.setTimeout(() => fullNameRef.current?.focus(), 0)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || usernameCustomized) return
    const suggested = buildSuggestedUsername(form.fullName, form.guardNumber)
    setForm((prev) => ({ ...prev, username: suggested }))
  }, [form.fullName, form.guardNumber, isOpen, usernameCustomized])

  useEffect(() => {
    if (!isOpen || emailCustomized) return
    const username = sanitizeToken(form.username)
    setForm((prev) => ({ ...prev, email: username ? `${username}@sentinel.local` : '' }))
  }, [form.username, emailCustomized, isOpen])

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validate = () => {
    const nextErrors: FormErrors = {}

    if (!form.fullName.trim()) nextErrors.fullName = 'Full name is required.'
    if (!form.username.trim()) nextErrors.username = 'Username is required.'
    if (!/^[A-Za-z0-9_]{3,}$/.test(form.username.trim())) {
      nextErrors.username = 'Username must be at least 3 chars and use letters, numbers, underscores.'
    }
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!form.password) nextErrors.password = 'Password is required.'
    if (form.password.length < 8) nextErrors.password = 'Password must be at least 8 characters.'
    if (!form.phoneNumber.trim()) nextErrors.phoneNumber = 'Phone number is required.'
    if (!form.licenseNumber.trim()) nextErrors.licenseNumber = 'License number is required.'
    if (!form.licenseIssuedDate) nextErrors.licenseIssuedDate = 'License issue date is required.'
    if (!form.licenseExpiryDate) nextErrors.licenseExpiryDate = 'License expiry date is required.'

    if (form.licenseIssuedDate && form.licenseExpiryDate) {
      const issuedAt = new Date(form.licenseIssuedDate).getTime()
      const expiryAt = new Date(form.licenseExpiryDate).getTime()
      if (!Number.isNaN(issuedAt) && !Number.isNaN(expiryAt) && expiryAt < issuedAt) {
        nextErrors.licenseExpiryDate = 'Expiry must be on/after issued date.'
      }
    }

    return nextErrors
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError('')

    if (!canCreate) {
      setSubmitError('Your role cannot create guard accounts.')
      return
    }

    const validation = validate()
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }

    setSubmitting(true)
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/users`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            phoneNumber: form.phoneNumber.trim(),
            role: 'guard',
            licenseNumber: form.licenseNumber.trim(),
            licenseIssuedDate: new Date(form.licenseIssuedDate).toISOString(),
            licenseExpiryDate: new Date(form.licenseExpiryDate).toISOString(),
            address: form.address.trim() || null,
          }),
        },
        'Failed to create guard account',
      )

      if (onCreated) await Promise.resolve(onCreated())
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create guard account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SentinelModal
      open={isOpen}
      title="Create Guard Account"
      onClose={() => {
        if (!submitting) onClose()
      }}
      widthClassName="max-w-2xl"
      closeOnOverlayClick={!submitting}
      closeOnEsc={!submitting}
    >
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm text-text-secondary">{modalDescription}</p>

        {!canCreate ? (
          <div className="rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
            Your role cannot create guard accounts.
          </div>
        ) : null}

        {submitError ? (
          <div className="rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">{submitError}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Full Name</span>
            <input
              ref={fullNameRef}
              type="text"
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
            {errors.fullName ? <span className="text-xs text-danger-text">{errors.fullName}</span> : null}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Guard Number (MDR)</span>
            <input
              type="text"
              value={form.guardNumber}
              onChange={(e) => setField('guardNumber', e.target.value)}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Username</span>
            <input
              type="text"
              value={form.username}
              onChange={(e) => {
                setUsernameCustomized(true)
                setField('username', e.target.value)
              }}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
            {errors.username ? <span className="text-xs text-danger-text">{errors.username}</span> : null}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                setEmailCustomized(true)
                setField('email', e.target.value)
              }}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
            {errors.email ? <span className="text-xs text-danger-text">{errors.email}</span> : null}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
            {errors.password ? <span className="text-xs text-danger-text">{errors.password}</span> : null}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Phone Number</span>
            <input
              type="text"
              value={form.phoneNumber}
              onChange={(e) => setField('phoneNumber', e.target.value)}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
            {errors.phoneNumber ? <span className="text-xs text-danger-text">{errors.phoneNumber}</span> : null}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">License Number</span>
            <input
              type="text"
              value={form.licenseNumber}
              onChange={(e) => setField('licenseNumber', e.target.value)}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
            {errors.licenseNumber ? <span className="text-xs text-danger-text">{errors.licenseNumber}</span> : null}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">License Issued Date</span>
            <input
              type="date"
              value={form.licenseIssuedDate}
              onChange={(e) => setField('licenseIssuedDate', e.target.value)}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
            {errors.licenseIssuedDate ? <span className="text-xs text-danger-text">{errors.licenseIssuedDate}</span> : null}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">License Expiry Date</span>
            <input
              type="date"
              value={form.licenseExpiryDate}
              onChange={(e) => setField('licenseExpiryDate', e.target.value)}
              className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              disabled={submitting}
            />
            {errors.licenseExpiryDate ? <span className="text-xs text-danger-text">{errors.licenseExpiryDate}</span> : null}
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Address (Optional)</span>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            className="w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
            disabled={submitting}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded border border-border-subtle bg-background px-4 py-2 text-sm font-semibold text-text-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 rounded border border-info-border bg-info-bg px-4 py-2 text-sm font-semibold text-info-text disabled:opacity-60"
            disabled={submitting || !canCreate}
          >
            {submitting ? 'Creating...' : 'Create Guard Account'}
          </button>
        </div>
      </form>
    </SentinelModal>
  )
}

export default CreateGuardAccountModal
