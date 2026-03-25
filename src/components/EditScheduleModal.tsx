import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'

interface Shift {
  id: string
  guard_id: string
  guard_name?: string
  guard_username: string
  client_site: string
  start_time: string
  end_time: string
  status: string
}

interface User {
  id: string
  username: string
  full_name?: string
  role: string
}

interface EditScheduleModalProps {
  shift: Shift | null
  onClose: () => void
  onSave: () => Promise<void>
  onDelete: () => Promise<void>
}

const EditScheduleModal: FC<EditScheduleModalProps> = ({ shift, onClose, onSave, onDelete }) => {
  const [guards, setGuards] = useState<User[]>([])
  const [formData, setFormData] = useState({
    guardId: shift?.guard_id || '',
    clientSite: shift?.client_site || '',
    date: shift?.start_time ? new Date(shift.start_time).toISOString().split('T')[0] : '',
    startTime: shift?.start_time ? new Date(shift.start_time).toTimeString().slice(0, 5) : '',
    endTime: shift?.end_time ? new Date(shift.end_time).toTimeString().slice(0, 5) : '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchGuards()
  }, [])

  const fetchGuards = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!response.ok) throw new Error('Failed to fetch guards')
      
      const data = await response.json()
      setGuards(data.users.filter((u: User) => u.role === 'guard' || u.role === 'user'))
    } catch (err) {
      logError('Error fetching guards:', err)
    }
  }

  if (!shift) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      const token = localStorage.getItem('token')
      
      // Combine date and time into RFC3339 format
      const startDateTime = `${formData.date}T${formData.startTime}:00Z`
      const endDateTime = `${formData.date}T${formData.endTime}:00Z`

      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts/${shift.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          guard_id: formData.guardId,
          client_site: formData.clientSite,
          start_time: startDateTime,
          end_time: endDateTime
        })
      })

      if (!response.ok) {
        let errorMsg = 'Failed to update shift'
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorData.message || errorMsg
        } catch {
          // If response is not JSON, try to get text
          try {
            const text = await response.text()
            errorMsg = text || errorMsg
          } catch {
            errorMsg = `Server error: ${response.status} ${response.statusText}`
          }
        }
        throw new Error(errorMsg)
      }

      await onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shift')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts/${shift.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) {
        let errorMsg = 'Failed to delete shift'
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorData.message || errorMsg
        } catch {
          // If response is not JSON, try to get text
          try {
            const text = await response.text()
            errorMsg = text || errorMsg
          } catch {
            errorMsg = `Server error: ${response.status} ${response.statusText}`
          }
        }
        throw new Error(errorMsg)
      }

      await onDelete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete shift')
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-text-primary">Edit Schedule</h2>
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

        {showDeleteConfirm ? (
          <div className="p-6 space-y-4">
            <p className="text-gray-700">Are you sure you want to delete this shift?</p>
            <div className="flex gap-3">
              <button 
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition-colors"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label htmlFor="guardId" className="block text-sm font-semibold text-gray-700 mb-1">Guard</label>
              <select
                id="guardId"
                name="guardId"
                value={formData.guardId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="">Select a guard</option>
                {guards.map(guard => (
                  <option key={guard.id} value={guard.id}>
                    {guard.full_name || guard.username} (@{guard.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="clientSite" className="block text-sm font-semibold text-gray-700 mb-1">Client Site</label>
              <input
                type="text"
                id="clientSite"
                name="clientSite"
                value={formData.clientSite}
                onChange={handleChange}
                required
                placeholder="Enter client site"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="startTime" className="block text-sm font-semibold text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-semibold text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
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
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                Delete
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
        )}
      </div>
    </div>
  )
}

export default EditScheduleModal
