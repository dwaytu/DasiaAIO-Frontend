import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'

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

  useEffect(() => {
    fetchPermits()
  }, [])

  const fetchPermits = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/guard-firearm-permits`, {
        headers: getAuthHeaders()
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

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date()
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'expired': return 'bg-danger-bg text-danger-text ring-1 ring-danger-border'
      case 'pending': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      default: return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
    }
  }

  return (
    <OperationalShell
      user={user}
      title="PERMITS"
      navItems={getSidebarNav(user.role)}
      activeView={activeView || 'permits'}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading permits...</div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden w-full animate-fade-in">
            <section className="flex flex-col flex-1 min-h-0 rounded overflow-hidden table-glass">
              <div className="flex-shrink-0 px-6 py-5 border-b border-border-subtle">
                <h2 className="text-xl font-bold text-text-primary">Active Permits ({permits.length})</h2>
              </div>
              {permits.length > 0 ? (
                <div className="soc-scroll-area flex-1 min-h-0 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Guard ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Firearm ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Issued Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Expiry Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
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
    </OperationalShell>
  )
}

export default GuardFirearmPermits

