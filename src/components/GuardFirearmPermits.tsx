import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import Sidebar from './Sidebar'
import Header from './Header'

interface Permit {
  id: string
  guardId: string
  firearmId: string
  permitType: string
  issuedDate: string
  expiryDate: string
  status: string
  [key: string]: any
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const GuardFirearmPermits: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || 'permits'
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
    fetchPermits()
  }, [])

  const fetchPermits = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/guard-firearm-permits`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setPermits(data.permits || [])
      }
    } catch (err) {
      logError('Error fetching permits:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date()
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
      case 'expired': return 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
      case 'pending': return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
      default: return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
    }
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <Sidebar
        items={navItems}
        activeView={currentView}
        onNavigate={handleNavigate}
        onLogoClick={() => onViewChange?.('dashboard')}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex min-w-0 min-h-0 flex-col w-full overflow-hidden">
        <Header title="Guard Firearm Permits" badgeLabel="Permits" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading permits...</div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden w-full animate-fade-in">
            <section className="flex flex-col flex-1 min-h-0 rounded-2xl overflow-hidden table-glass">
              <div className="flex-shrink-0 px-6 py-5 border-b border-border-subtle">
                <h2 className="text-xl font-bold text-text-primary">Active Permits ({permits.length})</h2>
              </div>
              {permits.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Guard ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Firearm ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Issued Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Expiry Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permits.map((p) => (
                        <tr key={p.id} className={`border-b border-border hover:bg-surface-hover ${isExpired(p.expiryDate) ? 'bg-danger-bg' : ''}`}>
                          <td className="px-4 py-3 text-text-primary">{p.guardId}</td>
                          <td className="px-4 py-3 text-text-primary">{p.firearmId}</td>
                          <td className="px-4 py-3 text-text-primary">{p.permitType}</td>
                          <td className="px-4 py-3 text-text-primary">{new Date(p.issuedDate).toLocaleDateString()}</td>
                          <td className={`px-4 py-3 ${isExpired(p.expiryDate) ? 'text-danger-text font-semibold' : 'text-text-primary'}`}>
                            {new Date(p.expiryDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-text-secondary py-8 italic">No permits found</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default GuardFirearmPermits

