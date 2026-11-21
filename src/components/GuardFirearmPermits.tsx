import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'
import { MANILA_TIME_ZONE } from '../utils/scheduleDateTime'

interface Permit {
  id: string
  guardId: string
  firearmId: string | null
  permitType: string
  issuedDate: string
  expiryDate: string
  status: string
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
  const [readWarning, setReadWarning] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setReadWarning('')
    setPermits([])
    const permitsPath = user.role === 'guard'
      ? `/api/guard-firearm-permits/${encodeURIComponent(user.id)}`
      : '/api/guard-firearm-permits'
    void fetchJsonOrThrow<{ permits: Permit[] }>(`${API_BASE_URL}${permitsPath}`, {
      headers: getAuthHeaders(), signal: controller.signal,
    }, 'Unable to load permit list').then((data) => {
      if (!controller.signal.aborted) setPermits(data.permits || [])
    }).catch((err) => {
      if (controller.signal.aborted) return
      logError('Error fetching permits:', err)
      setReadWarning('Permit records are temporarily unavailable.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [user.id, user.role])

  const searchTerm = search.trim().toLowerCase()
  const now = Date.now()
  const matchingPermits = permits.map((permit) => {
    const status = permit.status.trim().toLowerCase()
    const expired = status === 'active' && Date.parse(permit.expiryDate) <= now
    return { ...permit, status: expired ? 'expired' : status }
  }).filter((permit) => (
    (!statusFilter || permit.status === statusFilter) &&
    [permit.guardId, permit.firearmId, permit.permitType].some((value) => value?.toLowerCase().includes(searchTerm))
  ))

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'expired': return 'bg-danger-bg text-danger-text ring-1 ring-danger-border'
      case 'pending': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      default: return 'soc-status-neutral'
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
            <div className="text-info-text text-lg font-medium">Loading permits...</div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden w-full animate-fade-in">
            {readWarning ? (
              <div role="alert" className="mb-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text">
                {readWarning}
              </div>
            ) : null}
            <section className="flex flex-col flex-1 min-h-0 rounded overflow-hidden table-glass">
              <div className="shrink-0 px-6 py-5 border-b border-border-subtle">
                <h2 className="text-xl font-bold text-text-primary">Permit records</h2>
                <p className="mt-1 text-sm text-text-secondary">Look up recorded permits and check their status and expiry dates.</p>
                {!readWarning && permits.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-text-primary">
                      Search permits
                      <input type="search" className="soc-form-control min-h-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Guard ID, firearm ID, or permit type" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-primary">
                      Status
                      <select className="soc-form-control min-h-11" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="pending">Pending</option>
                        <option value="revoked">Revoked</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
              {readWarning ? null : matchingPermits.length > 0 ? (
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
                      {matchingPermits.map((p) => (
                        <tr key={p.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary">{p.guardId}</td>
                          <td className="px-4 py-3 text-text-primary">{p.firearmId || '—'}</td>
                          <td className="px-4 py-3 text-text-primary">{p.permitType}</td>
                          <td className="px-4 py-3 text-text-primary">{new Date(p.issuedDate).toLocaleDateString('en-PH', { timeZone: MANILA_TIME_ZONE })}</td>
                          <td className={`px-4 py-3 ${p.status === 'expired' ? 'text-danger-text font-semibold' : 'text-text-primary'}`}>
                            {new Date(p.expiryDate).toLocaleDateString('en-PH', { timeZone: MANILA_TIME_ZONE })}
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
                <p className="text-center text-text-secondary py-8 italic">{permits.length ? 'No permits match these filters.' : 'No permits found.'}</p>
              )}
            </section>
          </div>
        )}
    </OperationalShell>
  )
}

export default GuardFirearmPermits

