import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { getAuthHeaders } from '../utils/api'

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
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: getAuthHeaders()
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
      // Combine date and time into RFC3339 format
      const startDateTime = `${formData.date}T${formData.startTime}:00Z`
      const endDateTime = `${formData.date}T${formData.endTime}:00Z`

      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts/${shift.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
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
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts/${shift.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
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
    <div className="soc-modal-backdrop" onClick={onClose}>
      <div className="soc-modal-panel mx-4 w-full max-w-md rounded bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-bold text-text-primary">Edit Schedule</h2>
          <button 
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-3xl text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="soc-alert-error mx-6 mt-4 text-sm">
            {error}
          </div>
        )}

        {showDeleteConfirm ? (
          <div className="space-y-4 p-6">
            <p className="text-text-secondary">Are you sure you want to delete this shift?</p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded bg-red-600 py-2 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="soc-btn-secondary flex-1 rounded py-2 font-semibold"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label htmlFor="guardId" className="mb-1 block text-sm font-semibold text-text-secondary">Guard</label>
              <select
                id="guardId"
                name="guardId"
                value={formData.guardId}
                onChange={handleChange}
                required
                className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
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
              <label htmlFor="clientSite" className="mb-1 block text-sm font-semibold text-text-secondary">Client Site</label>
              <input
                type="text"
                id="clientSite"
                name="clientSite"
                value={formData.clientSite}
                onChange={handleChange}
                required
                placeholder="Enter client site"
                className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
              />
            </div>

            <div>
              <label htmlFor="date" className="mb-1 block text-sm font-semibold text-text-secondary">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="startTime" className="mb-1 block text-sm font-semibold text-text-secondary">Start Time</label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                  className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
                />
              </div>

              <div>
                <label htmlFor="endTime" className="mb-1 block text-sm font-semibold text-text-secondary">End Time</label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  required
                  className="w-full rounded border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                type="submit" 
                className="soc-btn-primary flex-1 rounded py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                type="button" 
                className="flex-1 rounded bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                Delete
              </button>
              <button 
                type="button" 
                className="soc-btn-secondary flex-1 rounded py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
