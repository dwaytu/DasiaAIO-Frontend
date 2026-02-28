import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'

interface Firearm {
  id: string
  serialNumber: string
  model: string
  caliber: string
  status: string
  lastMaintenance?: string
  [key: string]: any
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const FirearmInventory: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [showAddForm, setShowAddForm] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [newFirearm, setNewFirearm] = useState({
    serialNumber: '',
    model: '',
    caliber: '',
  })
  const currentView = activeView || 'firearms'
  const navItems = [
    { view: 'dashboard', label: 'Dashboard', group: 'MAIN MENU' },
    { view: 'calendar', label: 'Calendar', group: 'MAIN MENU' },
    { view: 'analytics', label: 'Analytics', group: 'MAIN MENU' },
    { view: 'trips', label: 'Trip Management', group: 'OPERATIONS' },
    { view: 'schedule', label: 'Schedule', group: 'OPERATIONS' },
    { view: 'missions', label: 'Missions', group: 'OPERATIONS' },
    { view: 'performance', label: 'Performance', group: 'OPERATIONS' },
    { view: 'merit', label: 'Merit Scores', group: 'OPERATIONS' },
    { view: 'firearms', label: 'Firearms', group: 'RESOURCES' },
    { view: 'allocation', label: 'Allocation', group: 'RESOURCES' },
    { view: 'permits', label: 'Permits', group: 'RESOURCES' },
    { view: 'maintenance', label: 'Maintenance', group: 'RESOURCES' },
    { view: 'armored-cars', label: 'Armored Cars', group: 'RESOURCES' },
  ]

  useEffect(() => {
    fetchFirearms()
  }, [])

  const fetchFirearms = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/firearms`)
      if (response.ok) {
        const data = await response.json()
        setFirearms(data.firearms || [])
      }
    } catch (err) {
      console.error('Error fetching firearms:', err)
    } finally {
      setLoading(false)
    }
  }

  const addFirearm = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: newFirearm.serialNumber,
          model: newFirearm.model,
          caliber: newFirearm.caliber,
        }),
      })
      if (!response.ok) throw new Error('Failed to add firearm')
      setSuccess('Firearm added successfully!')
      setNewFirearm({ serialNumber: '', model: '', caliber: '' })
      setShowAddForm(false)
      fetchFirearms()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add firearm')
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
      case 'available': return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
      case 'deployed': return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
      case 'maintenance': return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
      case 'lost': return 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
      default: return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
    }
  }

  return (
    <div className="flex h-screen w-screen bg-background font-sans">
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
        <Header title="Firearm Inventory" badgeLabel="Firearms" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading firearms...</div>
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
            {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">{success}</div>}
            
            <section className="table-glass rounded-2xl p-4 md:p-8 w-full mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <h2 className="text-2xl font-bold text-text-primary mb-4 md:mb-0">All Firearms ({firearms.length})</h2>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  {showAddForm ? 'Cancel' : '+ Add Firearm'}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={addFirearm} className="bg-surface-elevated p-6 rounded-lg mb-6 border border-border">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-text-secondary mb-2">Serial Number</label>
                      <input
                        type="text"
                        value={newFirearm.serialNumber}
                        onChange={(e) => setNewFirearm({ ...newFirearm, serialNumber: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter serial number"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-secondary mb-2">Model</label>
                      <input
                        type="text"
                        value={newFirearm.model}
                        onChange={(e) => setNewFirearm({ ...newFirearm, model: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter model"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-secondary mb-2">Caliber</label>
                      <input
                        type="text"
                        value={newFirearm.caliber}
                        onChange={(e) => setNewFirearm({ ...newFirearm, caliber: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., 9mm, .45 ACP"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition duration-200"
                  >
                    {loading ? 'Adding...' : 'Add Firearm'}
                  </button>
                </form>
              )}

              {firearms.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Serial Number</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Model</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Caliber</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Last Maintenance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firearms.map((f) => (
                        <tr key={f.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary">{f.serialNumber}</td>
                          <td className="px-4 py-3 text-text-primary">{f.model}</td>
                          <td className="px-4 py-3 text-text-primary">{f.caliber}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(f.status)}`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-primary">{f.lastMaintenance ? new Date(f.lastMaintenance).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-text-secondary py-8 italic">No firearms in inventory</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default FirearmInventory

