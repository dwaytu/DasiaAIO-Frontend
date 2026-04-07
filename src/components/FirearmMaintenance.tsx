import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'

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

  useEffect(() => {
    fetchMaintenances()
  }, [])

  const fetchMaintenances = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/firearm-maintenance`, {
        headers: getAuthHeaders()
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

  const isOverdue = (nextDate: string | undefined) => {
    if (!nextDate) return false
    return new Date(nextDate) < new Date()
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'pending': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      case 'scheduled': return 'bg-info-bg text-info-text ring-1 ring-info-border'
      default: return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
    }
  }

  return (
    <OperationalShell
      user={user}
      title="MAINTENANCE"
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
            <div className="text-indigo-600 text-lg font-medium">Loading maintenance records...</div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden w-full animate-fade-in">
            <section className="flex flex-col flex-1 min-h-0 rounded overflow-hidden table-glass">
              <div className="flex-shrink-0 px-6 py-5 border-b border-border-subtle">
                <h2 className="text-xl font-bold text-text-primary">Maintenance Records ({maintenances.length})</h2>
              </div>
              {maintenances.length > 0 ? (
                <div className="soc-scroll-area flex-1 min-h-0 overflow-auto">
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
                        <tr key={m.id} className={`border-b border-border hover:bg-surface-hover ${isOverdue(m.nextScheduledDate) ? 'bg-danger-bg' : ''}`}>
                          <td className="px-4 py-3 text-text-primary">{m.firearmId}</td>
                          <td className="px-4 py-3 text-text-primary">{m.maintenanceType}</td>
                          <td className="px-4 py-3 text-text-primary">{new Date(m.maintenanceDate).toLocaleDateString()}</td>
                          <td className={`px-4 py-3 ${isOverdue(m.nextScheduledDate) ? 'font-semibold text-danger-text' : 'text-text-primary'}`}>
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
    </OperationalShell>
  )
}

export default FirearmMaintenance

