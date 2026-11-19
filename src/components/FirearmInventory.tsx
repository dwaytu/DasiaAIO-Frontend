import { useState, useEffect, useRef, FC } from 'react'
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
import FirearmCustodyReviewAction, { applyFirearmCustodyReview } from './shared/FirearmCustodyReviewAction'
import { useFirearmInventorySummary } from '../hooks/useFirearmInventorySummary'

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
  custodyReviewApprovedAt?: string | null
  updatedAt?: string
  mdrBatchId?: string | null
  mdrRowRef?: string | null
  sourceGuardText?: string | null
  directGuardMatch?: boolean
  [key: string]: any
}

const PAGE_SIZE = 25

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
  const { summary, pendingReviewCount, summaryUnavailable, refreshSummary } = useFirearmInventorySummary()
  const [loading, setLoading] = useState<boolean>(true)
  const [readWarning, setReadWarning] = useState<string>('')
  const [stockConfirmation, setStockConfirmation] = useState('')
  const stockConfirmationRef = useRef<HTMLParagraphElement>(null)
  const [inventoryRevision, setInventoryRevision] = useState(0)
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
    void refreshSummary()
    return () => controller.abort()
  }, [currentPage, search, stateFilter, refreshSummary, inventoryRevision])

  useEffect(() => {
    if (stockConfirmation) stockConfirmationRef.current?.focus()
  }, [stockConfirmation, inventoryRevision])

  const fetchFirearms = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(currentPage),
        page_size: String(PAGE_SIZE),
        ...(stateFilter ? { state: stateFilter } : {}),
        ...(search ? { search } : {}),
      })
      const data = await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearms?${params.toString()}`, {
        headers: getAuthHeaders(),
        signal,
        cache: 'no-store',
      }, 'Unable to load firearm inventory')
      if (signal?.aborted) return
      const firearmsList = Array.isArray(data) ? data : (data.firearms || [])
      const matchingTotal = typeof data?.total === 'number' ? data.total : firearmsList.length
      setFirearms(firearmsList)
      setTotal(matchingTotal)
      setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(matchingTotal / PAGE_SIZE))))
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
      case 'available': return 'border-success-border bg-success-bg text-success-text'
      case 'deployed': return 'border-info-border bg-info-bg text-info-text'
      case 'maintenance': return 'border-warning-border bg-warning-bg text-warning-text'
      case 'lost': return 'border-danger-border bg-danger-bg text-danger-text'
      default: return 'border-border-subtle bg-surface-elevated text-text-secondary'
    }
  }

  const statusLabel = (firearm: Firearm) => {
    if (firearm.custodyReview) return 'Custody review'
    if (firearm.activeCustody) return 'Active custody'
    if (firearm.status === 'available') return 'Available'
    return firearm.status
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
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
        {loading && !stockConfirmation ? (
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

              {stockConfirmation ? (
                <p ref={stockConfirmationRef} tabIndex={-1} role="status" className="mt-4 rounded border border-success-border bg-success-bg p-3 text-sm text-success-text">
                  {stockConfirmation}
                </p>
              ) : null}
              {readWarning ? (
                <div className="mt-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status">
                  {readWarning}
                </div>
              ) : null}
              {summaryUnavailable ? (
                <p className="mt-4 text-sm text-warning-text" role="status">Firearm inventory totals could not be refreshed.</p>
              ) : null}

              <div className="mt-4">
                <OperationalSummaryBand
                  items={[
                    { label: 'Total firearms', value: totalCount, detail: 'In this inventory', tone: 'info', icon: Shield },
                    { label: 'Available', value: availableCount, detail: 'Ready to assign', tone: 'success', icon: CircleCheck },
                    { label: 'Active custody', value: activeCustodyCount, detail: 'Verified current firearm issues', tone: 'info', icon: ClipboardCheck },
                    { label: 'Pending custody reviews', value: pendingReviewCount ?? 'Unavailable', detail: 'Documentation approvals remaining', tone: (pendingReviewCount ?? 0) > 0 ? 'warning' : 'neutral', icon: Search },
                    { label: 'Maintenance', value: maintenanceCount, detail: 'Unavailable for assignment', tone: maintenanceCount > 0 ? 'warning' : 'neutral', icon: Wrench },
                  ]}
                />
              </div>

              {summary?.custodyReviewFirearms ? (
                <div className="mt-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status">
                  {summary.custodyReviewFirearms} imported firearm {summary.custodyReviewFirearms === 1 ? 'record has' : 'records have'} no verified active custody record.
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

              {loading ? (
                <div className="mt-5"><LoadingSkeleton variant="table" /></div>
              ) : firearms.length > 0 ? (
                <div className="mt-5 overflow-x-auto" aria-label="Firearm inventory register">
                  <table className="w-full min-w-[760px] border-collapse">
                    <caption className="sr-only">Registered firearms and their current operational status.</caption>
                    <thead className="sticky top-0 z-10 h-11 border-b border-border-subtle bg-surface-elevated/60 text-xs font-semibold uppercase tracking-wider text-text-tertiary backdrop-blur-xs">
                      <tr>
                        <th scope="col" className="px-4 py-3.5 text-left">Serial Number</th>
                        <th scope="col" className="px-4 py-3.5 text-left">Model</th>
                        <th scope="col" className="px-4 py-3.5 text-left">Manufacturer</th>
                        <th scope="col" className="px-4 py-3.5 text-left">Caliber</th>
                        <th scope="col" className="px-4 py-3.5 text-left">License Expiry</th>
                        <th scope="col" className="px-4 py-3.5 text-left">Status</th>
                        <th scope="col" className="px-4 py-3.5 text-left">Verification</th>
                        <th scope="col" className="px-4 py-3.5 text-left">Last Maintenance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firearms.map((f) => (
                        <tr key={f.id} className="border-b border-border-subtle/80 transition-colors hover:bg-surface-hover/50">
                          <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{f.serialNumber}</td>
                          <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{f.model}</td>
                          <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{normalizeManufacturer(f.make)}</td>
                          <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{f.caliber}</td>
                          <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{f.licenseExpiryDate ? new Date(f.licenseExpiryDate).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-4 py-3.5 align-middle text-sm text-text-primary">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${f.custodyReview ? 'border-warning-border bg-warning-bg text-warning-text' : getStatusBadgeColor(f.status)}`}>
                              {statusLabel(f)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-middle text-sm text-text-primary">
                            {f.custodyReview ? (
                              <div>
                                <p className="font-medium text-warning-text">No verified active custody record</p>
                                <p className="mt-1 text-xs">Imported status: {f.status}. Active custody: No.</p>
                                <p className="mt-1 text-xs">MDR source: {f.mdrRowRef || 'Not linked'}{f.sourceGuardText ? `; source guard: ${f.sourceGuardText}` : ''}. Direct guard match: {f.directGuardMatch ? 'Yes' : 'No'}.</p>
                                <div className="mt-2">
                                  <FirearmCustodyReviewAction firearm={f} viewerRole={user.role} onApproved={(result) => {
                                    setFirearms((items) => applyFirearmCustodyReview(items, f, result, stateFilter === 'custody_review'))
                                    if (result.returnedToStock) {
                                      setStockConfirmation(`Firearm ${f.serialNumber} confirmed in stock and marked available.`)
                                      setInventoryRevision((revision) => revision + 1)
                                    } else {
                                      void refreshSummary()
                                    }
                                  }} />
                                </div>
                              </div>
                            ) : f.activeCustody ? 'Verified active custody' : 'No active custody'}
                          </td>
                          <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{f.lastMaintenance ? new Date(f.lastMaintenance).toLocaleDateString() : 'N/A'}</td>
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
              {!loading && total > 0 ? <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between"><p>Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, total)} of {total} firearms</p><div className="flex items-center gap-2"><button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="soc-btn soc-btn-neutral" aria-label="Previous firearm page"><ChevronLeft size={16} aria-hidden="true" />Previous</button><span className="min-w-24 text-center font-semibold text-text-primary" aria-live="polite">Page {currentPage} of {pageCount}</span><button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} className="soc-btn soc-btn-neutral" aria-label="Next firearm page">Next<ChevronRight size={16} aria-hidden="true" /></button></div></div> : null}
            </section>
          </div>
        )}
    </OperationalShell>
  )
}

export default FirearmInventory

