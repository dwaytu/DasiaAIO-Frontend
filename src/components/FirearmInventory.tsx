import { useState, useEffect, FC } from 'react'
import { Shield } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import { getSidebarNav } from '../config/navigation'

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
  const currentView = activeView || 'firearms'

  useEffect(() => {
    fetchFirearms()
  }, [])

  const fetchFirearms = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/firearms`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        // Backend returns array directly, not wrapped in object
        const firearmsList = Array.isArray(data) ? data : (data.firearms || [])
        setFirearms(firearmsList)
      }
    } catch (err) {
      logError('Error fetching firearms:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'deployed': return 'bg-info-bg text-info-text ring-1 ring-info-border'
      case 'maintenance': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      case 'lost': return 'bg-danger-bg text-danger-text ring-1 ring-danger-border'
      default: return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
    }
  }

  return (
    <OperationalShell
      user={user}
      title="FIREARMS"
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
          <div className="flex-1 p-4 md:p-8">
            <LoadingSkeleton variant="table" />
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            
            <section className="table-glass rounded p-4 md:p-8 w-full mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <h2 className="text-2xl font-bold text-text-primary mb-4 md:mb-0">All Firearms ({firearms.length})</h2>
              </div>

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
                <EmptyState icon={Shield} title="No firearms registered" subtitle="Use the Management panel to register firearms" />
              )}
            </section>
          </div>
        )}
    </OperationalShell>
  )
}

export default FirearmInventory

