import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import Sidebar from './Sidebar'
import Header from './Header'

interface Maintenance {
  id: string
  firearmId: string
  maintenanceType: string
  maintenanceDate: string
  nextScheduledDate?: string
  status: string
  notes?: string
  [key: string]: any
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const FirearmMaintenance: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || 'maintenance'
  const navItems = [
    { view: 'dashboard', label: 'Dashboard', group: 'MAIN MENU' },
    { view: 'approvals', label: 'Approvals', group: 'MAIN MENU' },
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
    fetchMaintenances()
  }, [])

  const fetchMaintenances = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/firearm-maintenance`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setMaintenances(data.maintenances || [])
      }
    } catch (err) {
      logError('Error fetching maintenance records:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  const isOverdue = (nextDate: string | undefined) => {
    if (!nextDate) return false
    return new Date(nextDate) < new Date()
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
      case 'pending': return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
      case 'scheduled': return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
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
        <Header title="Firearm Maintenance" badgeLabel="Maintenance" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading maintenance records...</div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden w-full animate-fade-in">
            <section className="flex flex-col flex-1 min-h-0 rounded-2xl overflow-hidden table-glass">
              <div className="flex-shrink-0 px-6 py-5 border-b border-border-subtle">
                <h2 className="text-xl font-bold text-text-primary">Maintenance Records ({maintenances.length})</h2>
              </div>
              {maintenances.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Firearm ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Maintenance Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Next Scheduled</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenances.map((m) => (
                        <tr key={m.id} className={`border-b border-border hover:bg-surface-hover ${isOverdue(m.nextScheduledDate) ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 text-text-primary">{m.firearmId}</td>
                          <td className="px-4 py-3 text-text-primary">{m.maintenanceType}</td>
                          <td className="px-4 py-3 text-text-primary">{new Date(m.maintenanceDate).toLocaleDateString()}</td>
                          <td className={`px-4 py-3 ${isOverdue(m.nextScheduledDate) ? 'text-red-700 font-semibold' : 'text-text-primary'}`}>
                            {m.nextScheduledDate ? new Date(m.nextScheduledDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(m.status)}`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-primary">{m.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-text-secondary py-8 italic">No maintenance records found</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default FirearmMaintenance

