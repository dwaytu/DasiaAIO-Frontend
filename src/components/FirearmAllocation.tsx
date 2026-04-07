import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'

interface Allocation {
  id: string
  guardId: string
  firearmId: string
  allocationDate: string
  status: string
  [key: string]: any
}

interface Guard {
  id: string
  full_name: string
}

interface Firearm {
  id: string
  serialNumber: string
  model: string
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const FirearmAllocation: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [showAllocateForm, setShowAllocateForm] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [newAllocation, setNewAllocation] = useState({
    guardId: '',
    firearmId: '',
  })
  const currentView = activeView || 'allocation'

  useEffect(() => {
    initializeData()
  }, [])

  const initializeData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchAllocations(),
        fetchGuards(),
        fetchFirearms()
      ])
    } catch (err) {
      logError('Error initializing data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllocations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearm-allocations`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        throw new Error('Failed to fetch allocations')
      }
      const data = await response.json()
      setAllocations(data.allocations || [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch allocations')
      logError('Error fetching allocations:', err)
    }
  }

  const fetchGuards = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        throw new Error('Failed to fetch guards')
      }
      const data = await response.json()
      // Handle both array and object responses
      const guardsList = Array.isArray(data) ? data : (data.users || data || [])
      setGuards(guardsList.filter((u: any) => u.role === 'guard'))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch guards')
      logError('Error fetching guards:', err)
    }
  }

  const fetchFirearms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearms`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        throw new Error('Failed to fetch firearms')
      }
      const data = await response.json()
      // Handle both array and object responses
      const firearmsList = Array.isArray(data) ? data : (data.firearms || data || [])
      setFirearms(firearmsList)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch firearms')
      logError('Error fetching firearms:', err)
    }
  }

  const allocateFirearm = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearm-allocation/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          guardId: newAllocation.guardId,
          firearmId: newAllocation.firearmId,
        }),
      })
      if (!response.ok) throw new Error('Failed to allocate firearm')
      setSuccess('Firearm allocated successfully!')
      setNewAllocation({ guardId: '', firearmId: '' })
      setShowAllocateForm(false)
      fetchAllocations()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to allocate firearm')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'returned': return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
      case 'pending': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      default: return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
    }
  }

  return (
    <OperationalShell
      user={user}
      title="ALLOCATION"
      navItems={getSidebarNav(user.role)}
      activeView={currentView}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading allocations...</div>
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {error && <div className="mb-4 p-4 bg-danger-bg border border-danger-border rounded text-danger-text">{error}</div>}
            {success && <div className="mb-4 p-4 bg-success-bg border border-success-border rounded text-success-text">{success}</div>}
            
            <section className="table-glass rounded p-6 md:p-8 w-full mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <h2 className="text-2xl font-bold text-text-primary mb-4 md:mb-0">Firearm Allocations ({allocations.length})</h2>
                <button
                  onClick={() => setShowAllocateForm(!showAllocateForm)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded transition duration-200"
                >
                  {showAllocateForm ? 'Cancel' : '+ Allocate Firearm'}
                </button>
              </div>

              {showAllocateForm && (
                <form onSubmit={allocateFirearm} className="bg-surface-elevated p-6 rounded mb-6 border border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Guard</label>
                      <select
                        value={newAllocation.guardId}
                        onChange={(e) => setNewAllocation({ ...newAllocation, guardId: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        <option value="">Select a guard</option>
                        {guards.map((g) => (
                          <option key={g.id} value={g.id}>{g.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Firearm</label>
                      <select
                        value={newAllocation.firearmId}
                        onChange={(e) => setNewAllocation({ ...newAllocation, firearmId: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        <option value="">Select a firearm</option>
                        {firearms.map((f) => (
                          <option key={f.id} value={f.id}>{f.serialNumber} - {f.model}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded transition duration-200"
                  >
                    {loading ? 'Allocating...' : 'Allocate Firearm'}
                  </button>
                </form>
              )}

              {allocations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Guard ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Firearm ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Allocation Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a) => (
                        <tr key={a.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary">{a.guardId}</td>
                          <td className="px-4 py-3 text-text-primary">{a.firearmId}</td>
                          <td className="px-4 py-3 text-text-primary">{new Date(a.allocationDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(a.status)}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-text-secondary py-8 italic">No allocations found</p>
              )}
            </section>
          </div>
        )}
    </OperationalShell>
  )
}

export default FirearmAllocation

