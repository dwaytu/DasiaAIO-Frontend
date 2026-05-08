import { useEffect, useState, FC } from 'react'
import SentinelModal from './shared/SentinelModal'

interface User {
  id: string
  email: string
  username: string
  role: string
  full_name?: string
  phone_number?: string
  license_number?: string
  license_issued_date?: string
  license_expiry_date?: string
  address?: string
}

interface EditUserModalProps {
  user: User | null
  viewerRole: string
  onClose: () => void
  onSave: (updatedUser: Partial<User>) => Promise<void>
}

const normalizeRole = (role?: string) => {
  const normalized = (role || '').trim().toLowerCase()
  return normalized === 'user' ? 'guard' : normalized
}

const EditUserModal: FC<EditUserModalProps> = ({ user, viewerRole, onClose, onSave }) => {
  const normalizedViewerRole = normalizeRole(viewerRole)
  const normalizedTargetRole = normalizeRole(user?.role)
  const canEditCredentials =
    normalizedViewerRole === 'superadmin' ||
    ((normalizedViewerRole === 'admin' || normalizedViewerRole === 'supervisor') && normalizedTargetRole === 'guard')
  const [formData, setFormData] = useState({
    email: user?.email || '',
    username: user?.username || '',
    fullName: user?.full_name || '',
    phoneNumber: user?.phone_number || '',
    licenseNumber: user?.license_number || '',
    licenseIssuedDate: user?.license_issued_date ? user.license_issued_date.split('T')[0] : '',
    licenseExpiryDate: user?.license_expiry_date ? user.license_expiry_date.split('T')[0] : '',
    address: user?.address || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setFormData({
      email: user?.email || '',
      username: user?.username || '',
      fullName: user?.full_name || '',
      phoneNumber: user?.phone_number || '',
      licenseNumber: user?.license_number || '',
      licenseIssuedDate: user?.license_issued_date ? user.license_issued_date.split('T')[0] : '',
      licenseExpiryDate: user?.license_expiry_date ? user.license_expiry_date.split('T')[0] : '',
      address: user?.address || '',
    })
    setError('')
  }, [user])

  if (!user) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload: Partial<User> & {
        fullName?: string
        phoneNumber?: string
        licenseNumber?: string
        licenseIssuedDate?: string
        licenseExpiryDate?: string
        address?: string
        email?: string
        username?: string
      } = {
        full_name: formData.fullName,
        phone_number: formData.phoneNumber,
        license_number: formData.licenseNumber,
        license_issued_date: formData.licenseIssuedDate,
        license_expiry_date: formData.licenseExpiryDate,
        address: formData.address,
      }

      if (canEditCredentials) {
        payload.email = formData.email
        payload.username = formData.username
      }

      await onSave(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SentinelModal
      open={!!user}
      onClose={onClose}
      title={`Edit User: ${user.email}`}
      size="md"
    >
      {error && (
        <div className="soc-alert-error mb-4 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-text-secondary">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email"
              disabled={!canEditCredentials}
              className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-semibold text-text-secondary">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              disabled={!canEditCredentials}
              className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        {!canEditCredentials ? (
          <p className="text-xs text-text-tertiary">
            Superadmin can edit email and username for all users. Admin and supervisor can edit guard credentials only.
          </p>
        ) : null}

        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-semibold text-text-secondary">Full Name</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Enter full name"
            className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
          />
        </div>

        <div>
          <label htmlFor="phoneNumber" className="mb-1 block text-sm font-semibold text-text-secondary">Phone Number</label>
          <input
            type="tel"
            id="phoneNumber"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="Enter phone number"
            className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
          />
        </div>

        <div>
          <label htmlFor="licenseNumber" className="mb-1 block text-sm font-semibold text-text-secondary">License Number</label>
          <input
            type="text"
            id="licenseNumber"
            name="licenseNumber"
            value={formData.licenseNumber}
            onChange={handleChange}
            placeholder="Enter license number"
            className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
          />
        </div>

        <div>
          <label htmlFor="licenseIssuedDate" className="mb-1 block text-sm font-semibold text-text-secondary">License Issued Date</label>
          <input
            type="date"
            id="licenseIssuedDate"
            name="licenseIssuedDate"
            value={formData.licenseIssuedDate}
            onChange={handleChange}
            className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
          />
        </div>

        <div>
          <label htmlFor="licenseExpiryDate" className="mb-1 block text-sm font-semibold text-text-secondary">License Expiry Date</label>
          <input
            type="date"
            id="licenseExpiryDate"
            name="licenseExpiryDate"
            value={formData.licenseExpiryDate}
            onChange={handleChange}
            className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
          />
        </div>

        <div>
          <label htmlFor="address" className="mb-1 block text-sm font-semibold text-text-secondary">Full Address</label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter complete address"
            rows={2}
            className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded border border-border px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded border border-info-border bg-info-bg px-4 py-2 text-sm font-semibold text-info-text transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring) disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </SentinelModal>
  )
}

export default EditUserModal
