import { useState, FC } from 'react'

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-text-primary">Edit User: {user.email}</h2>
          <button 
            className="text-3xl text-text-secondary hover:text-text-primary transition-colors w-8 h-8 flex items-center justify-center"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-300 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="Enter phone number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="licenseNumber" className="block text-sm font-semibold text-gray-700 mb-1">License Number</label>
            <input
              type="text"
              id="licenseNumber"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
              placeholder="Enter license number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="licenseIssuedDate" className="block text-sm font-semibold text-gray-700 mb-1">License Issued Date</label>
            <input
              type="date"
              id="licenseIssuedDate"
              name="licenseIssuedDate"
              value={formData.licenseIssuedDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="licenseExpiryDate" className="block text-sm font-semibold text-gray-700 mb-1">License Expiry Date</label>
            <input
              type="date"
              id="licenseExpiryDate"
              name="licenseExpiryDate"
              value={formData.licenseExpiryDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-1">Full Address</label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter complete address"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="submit" 
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              type="button" 
              className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg transition-colors text-sm"
              onClick={onClose} 
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditUserModal
