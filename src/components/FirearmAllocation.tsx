import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'

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
  const navItems = [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'calendar', label: 'Calendar' },
    { view: 'analytics', label: 'Analytics' },
    { view: 'trips', label: 'Trip Management' },
    { view: 'schedule', label: 'Schedule' },
    { view: 'missions', label: 'Missions' },
    { view: 'performance', label: 'Performance' },
    { view: 'merit', label: 'Merit Scores' },
    { view: 'firearms', label: 'Firearms' },
    { view: 'allocation', label: 'Allocation' },
    { view: 'permits', label: 'Permits' },
    { view: 'maintenance', label: 'Maintenance' },
    { view: 'armored-cars', label: 'Armored Cars' }
  ]

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
      console.error('Error initializing data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllocations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearm-allocations`)
      if (!response.ok) {
        throw new Error('Failed to fetch allocations')
      }
      const data = await response.json()
      setAllocations(data.allocations || [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch allocations')
      console.error('Error fetching allocations:', err)
    }
  }

  const fetchGuards = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`)
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
      console.error('Error fetching guards:', err)
    }
  }

  const fetchFirearms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearms`)
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
      console.error('Error fetching firearms:', err)
    }
  }

  const allocateFirearm = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearm-allocation/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'returned': return 'bg-gray-100 text-gray-800'
      case 'pending': return 'bg-amber-100 text-amber-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex min-h-screen w-screen bg-gray-100 font-sans">
      <Sidebar
        items={navItems}
        activeView={currentView}
        onNavigate={handleNavigate}
        onLogoClick={() => onViewChange?.('dashboard')}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header title="Firearm Allocation" badgeLabel="Allocation" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading allocations...</div>
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
            {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">{success}</div>}
            
            <section className="bg-white p-4 md:p-8 rounded-xl shadow-sm w-full mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">Firearm Allocations ({allocations.length})</h2>
                <button
                  onClick={() => setShowAllocateForm(!showAllocateForm)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  {showAllocateForm ? 'Cancel' : '+ Allocate Firearm'}
                </button>
              </div>

              {showAllocateForm && (
                <form onSubmit={allocateFirearm} className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Guard</label>
                      <select
                        value={newAllocation.guardId}
                        onChange={(e) => setNewAllocation({ ...newAllocation, guardId: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        <option value="">Select a guard</option>
                        {guards.map((g) => (
                          <option key={g.id} value={g.id}>{g.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Firearm</label>
                      <select
                        value={newAllocation.firearmId}
                        onChange={(e) => setNewAllocation({ ...newAllocation, firearmId: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition duration-200"
                  >
                    {loading ? 'Allocating...' : 'Allocate Firearm'}
                  </button>
                </form>
              )}

              {allocations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Guard ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Firearm ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Allocation Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a) => (
                        <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{a.guardId}</td>
                          <td className="px-4 py-3 text-gray-700">{a.firearmId}</td>
                          <td className="px-4 py-3 text-gray-700">{new Date(a.allocationDate).toLocaleDateString()}</td>
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
                <p className="text-center text-gray-400 py-8 italic">No allocations found</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default FirearmAllocation
