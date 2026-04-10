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
  onClose: () => void
  onSave: (updatedUser: Partial<User>) => Promise<void>
}

const EditUserModal: FC<EditUserModalProps> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
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
      await onSave({
        full_name: formData.fullName,
        phone_number: formData.phoneNumber,
        license_number: formData.licenseNumber,
        license_issued_date: formData.licenseIssuedDate,
        license_expiry_date: formData.licenseExpiryDate,
        address: formData.address,
      })
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
            className="inline-flex min-h-11 items-center justify-center rounded border border-border px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded border border-info-border bg-info-bg px-4 py-2 text-sm font-semibold text-info-text transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)] disabled:opacity-60"
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
