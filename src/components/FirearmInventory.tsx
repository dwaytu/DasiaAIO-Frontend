import { useState, useEffect, FC } from 'react'
import { Shield, Wrench, CircleCheck, ClipboardCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import { getSidebarNav } from '../config/navigation'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'

interface Firearm {
  id: string
  serialNumber: string
  model: string
  caliber: string
  status: string
  make?: string | null
  licenseExpiryDate?: string | null
  lastMaintenance?: string
  activeCustody?: boolean
  custodyReview?: boolean
  mdrBatchId?: string | null
  mdrRowRef?: string | null
  sourceGuardText?: string | null
  directGuardMatch?: boolean
  [key: string]: any
}

interface FirearmSummary {
  totalFirearms: number
  availableFirearms: number
  allocatedFirearms: number
  maintenanceFirearms: number
  activeCustody: number
  custodyReviewFirearms: number
}

const normalizeManufacturer = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return 'Not specified'
  if (normalized === 'armscor' || normalized === 'amscor') return 'Armscor'
  if (normalized === 's&w') return 'Smith & Wesson'
  return value?.trim() || 'Not specified'
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const FirearmInventory: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [summary, setSummary] = useState<FirearmSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [readWarning, setReadWarning] = useState<string>('')
  const [stateFilter, setStateFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || 'firearms'

  useEffect(() => {
    const controller = new AbortController()
    void fetchFirearms(controller.signal)
    return () => controller.abort()
  }, [currentPage, search, stateFilter])

  const fetchFirearms = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const [data, summaryData] = await Promise.all([
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearms?${new URLSearchParams({
          page: String(currentPage),
          page_size: '25',
          ...(stateFilter ? { state: stateFilter } : {}),
          ...(search ? { search } : {}),
        }).toString()}`, {
          headers: getAuthHeaders(),
          signal,
        }, 'Unable to load firearm inventory'),
        fetchJsonOrThrow<FirearmSummary>(`${API_BASE_URL}/api/firearm-allocations/summary`, {
          headers: getAuthHeaders(),
          signal,
        }, 'Unable to load firearm inventory summary'),
      ])
      if (signal?.aborted) return
      const firearmsList = Array.isArray(data) ? data : (data.firearms || [])
      setFirearms(firearmsList)
      setTotal(typeof data?.total === 'number' ? data.total : firearmsList.length)
      setSummary(summaryData)
      setReadWarning('')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (signal?.aborted) return
      logError('Error fetching firearms:', err)
      setReadWarning('Firearm inventory is temporarily unavailable. Reads are degraded; write actions remain server-protected.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'deployed': return 'bg-info-bg text-info-text ring-1 ring-info-border'
      case 'maintenance': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      case 'lost': return 'bg-danger-bg text-danger-text ring-1 ring-danger-border'
      default: return 'soc-status-neutral'
    }
  }

  const statusLabel = (firearm: Firearm) => {
    if (firearm.custodyReview) return 'Custody review'
    if (firearm.activeCustody) return 'Active custody'
    return firearm.status
  }

  const pageCount = Math.max(1, Math.ceil(total / 25))
  const applySearch = (event: React.FormEvent) => {
    event.preventDefault()
    setCurrentPage(1)
    setSearch(searchInput.trim())
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setStateFilter('')
    setCurrentPage(1)
  }

  const totalCount = summary?.totalFirearms ?? firearms.length
  const availableCount = summary?.availableFirearms ?? firearms.filter((firearm) => firearm.status?.toLowerCase() === 'available').length
  const activeCustodyCount = summary?.activeCustody ?? firearms.filter((firearm) => firearm.activeCustody).length
  const custodyReviewCount = summary?.custodyReviewFirearms ?? firearms.filter((firearm) => firearm.custodyReview).length
  const maintenanceCount = summary?.maintenanceFirearms ?? firearms.filter((firearm) => firearm.status?.toLowerCase() === 'maintenance').length

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
            
            <section className="soc-surface p-4 md:p-5">
              <OperationalPageHeader
                eyebrow="Resource register"
                title="Firearm Inventory"
                description="Separate current inventory status from verified custody before assigning or servicing a firearm."
                icon={Shield}
                status={<span className="soc-status-neutral">{totalCount} registered firearm{totalCount === 1 ? '' : 's'}</span>}
              />

              {readWarning ? (
                <div className="mt-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status">
                  {readWarning}
                </div>
              ) : null}

              <div className="mt-4">
                <OperationalSummaryBand
                  items={[
                    { label: 'Total firearms', value: totalCount, detail: 'In this inventory', tone: 'info', icon: Shield },
                    { label: 'Available', value: availableCount, detail: 'Ready to assign', tone: 'success', icon: CircleCheck },
                    { label: 'Active custody', value: activeCustodyCount, detail: 'Verified current firearm issues', tone: 'info', icon: ClipboardCheck },
                    { label: 'Custody review', value: custodyReviewCount, detail: 'No verified active custody record', tone: custodyReviewCount > 0 ? 'warning' : 'neutral', icon: Search },
                    { label: 'Maintenance', value: maintenanceCount, detail: 'Unavailable for assignment', tone: maintenanceCount > 0 ? 'warning' : 'neutral', icon: Wrench },
                  ]}
                />
              </div>

              {summary?.custodyReviewFirearms ? (
                <div className="mt-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status">
                  {summary.custodyReviewFirearms} imported firearm record{summary.custodyReviewFirearms === 1 ? '' : 's'} have no verified active custody record. They are not included in active custody.
                </div>
              ) : null}

              <form onSubmit={applySearch} className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]" role="search">
                <label className="relative">
                  <span className="sr-only">Search firearm inventory</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="soc-form-control w-full pl-10" placeholder="Serial, manufacturer, or model" />
                </label>
                <select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setCurrentPage(1) }} className="soc-form-control" aria-label="Filter firearm inventory state">
                  <option value="">All inventory</option><option value="available">Available</option><option value="active_custody">Active custody</option><option value="custody_review">Custody review</option><option value="maintenance">Maintenance</option>
                </select>
                <button type="submit" className="soc-btn soc-btn-neutral">Search</button>
                <button type="button" onClick={clearFilters} className="soc-btn soc-btn-neutral">Clear</button>
              </form>

              {firearms.length > 0 ? (
                <div className="mt-5 overflow-x-auto" aria-label="Firearm inventory register">
                  <table className="w-full min-w-[760px] border-collapse">
                    <caption className="sr-only">Registered firearms and their current operational status.</caption>
                    <thead className="thead-glass">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Serial Number</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Model</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Manufacturer</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Caliber</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">License Expiry</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Verification</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Last Maintenance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firearms.map((f) => (
                        <tr key={f.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary">{f.serialNumber}</td>
                          <td className="px-4 py-3 text-text-primary">{f.model}</td>
                          <td className="px-4 py-3 text-text-secondary">{normalizeManufacturer(f.make)}</td>
                          <td className="px-4 py-3 text-text-primary">{f.caliber}</td>
                          <td className="px-4 py-3 text-text-primary">{f.licenseExpiryDate ? new Date(f.licenseExpiryDate).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${f.custodyReview ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' : getStatusBadgeColor(f.status)}`}>
                              {statusLabel(f)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary">
                            {f.custodyReview ? <div><p className="font-medium text-warning-text">No verified active custody record</p><p className="mt-1 text-xs">Imported status: {f.status}. Active custody: No.</p><p className="mt-1 text-xs">MDR source: {f.mdrRowRef || 'Not linked'}{f.sourceGuardText ? `; source guard: ${f.sourceGuardText}` : ''}. Direct guard match: {f.directGuardMatch ? 'Yes' : 'No'}.</p></div> : f.activeCustody ? 'Verified active custody' : 'No active custody'}
                          </td>
                          <td className="px-4 py-3 text-text-primary">{f.lastMaintenance ? new Date(f.lastMaintenance).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState icon={Shield} title={search || stateFilter ? 'No firearms match the selected filters' : 'No firearms registered'} subtitle={search || stateFilter ? 'Try a different search or inventory state.' : 'Use the Management panel to register firearms'} />
                </div>
              )}
              {total > 0 ? <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between"><p>Showing {((currentPage - 1) * 25) + 1}-{Math.min(currentPage * 25, total)} of {total} firearms</p><div className="flex items-center gap-2"><button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="soc-btn soc-btn-neutral" aria-label="Previous firearm page"><ChevronLeft size={16} aria-hidden="true" />Previous</button><span className="min-w-24 text-center font-semibold text-text-primary" aria-live="polite">Page {currentPage} of {pageCount}</span><button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} className="soc-btn soc-btn-neutral" aria-label="Next firearm page">Next<ChevronRight size={16} aria-hidden="true" /></button></div></div> : null}
            </section>
          </div>
        )}
    </OperationalShell>
  )
}

export default FirearmInventory

