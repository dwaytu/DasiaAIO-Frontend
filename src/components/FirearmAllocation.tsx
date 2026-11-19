import { useEffect, useState, FC } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, PackageCheck, Plus, Search, ShieldCheck, Users, X } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'
import SentinelModal from './shared/SentinelModal'
import GuardSearchSelect, { type GuardSearchOption } from './shared/GuardSearchSelect'

const PAGE_SIZE = 15
const ORIGIN_LABELS = {
  application: '',
  imported: 'Imported',
  presentation: '',
  unknown: '',
} as const

type RecordOrigin = keyof typeof ORIGIN_LABELS

interface Allocation {
  id: string
  guardId: string
  firearmId: string
  allocationDate: string
  returnDate?: string | null
  status: string
  guardName?: string
  firearmSerialNumber?: string
  firearmModel?: string
  mdrBatchId?: string | null
  recordOrigin?: RecordOrigin
}

interface Firearm { id: string; serialNumber: string; model: string; status?: string }
interface AllocationSummary {
  totalFirearms: number
  availableFirearms: number
  activeCustody: number
  custodyReviewFirearms: number
  maintenanceFirearms?: number
  returnedAllocations: number
  totalAllocationRecords: number
  eligibleGuards: number | null
  activeApprovedGuards: number
  guardsWithActivePermit: number
  guardsWithValidFirearmsTraining: number
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const emptySummary: AllocationSummary = {
  totalFirearms: 0,
  availableFirearms: 0,
  activeCustody: 0,
  custodyReviewFirearms: 0,
  returnedAllocations: 0,
  totalAllocationRecords: 0,
  eligibleGuards: null,
  activeApprovedGuards: 0,
  guardsWithActivePermit: 0,
  guardsWithValidFirearmsTraining: 0,
}

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : '-'
const allocationStatusLabel = (status: string) => {
  if (status.toLowerCase() === 'returned') return 'Returned'
  if (status.toLowerCase() === 'imported') return 'Import record'
  if (status.toLowerCase() === 'active') return 'Active'
  return 'Unverified'
}

const FirearmAllocation: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [summary, setSummary] = useState<AllocationSummary>(emptySummary)
  const [summaryAvailable, setSummaryAvailable] = useState(false)
  const [guards, setGuards] = useState<GuardSearchOption[]>([])
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState(true)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAllocateForm, setShowAllocateForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [returningId, setReturningId] = useState<string | null>(null)
  const [returnCandidate, setReturnCandidate] = useState<Allocation | null>(null)
  const [newAllocation, setNewAllocation] = useState({ guardId: '', firearmId: '' })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalAllocations, setTotalAllocations] = useState(0)
  const currentView = activeView || 'allocation'
  const pageCount = Math.max(1, Math.ceil(totalAllocations / PAGE_SIZE))
  const firstVisible = totalAllocations === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastVisible = Math.min(currentPage * PAGE_SIZE, totalAllocations)
  const availableFirearms = firearms.filter((firearm) => firearm.status?.toLowerCase() === 'available')
  const selectedGuard = newAllocation.guardId ? guards.find((guard) => guard.id === newAllocation.guardId) : undefined
  const eligibleCount = summary.eligibleGuards
  const availableCount = summary.availableFirearms
  const allocationBlockedReason = !summaryAvailable
    ? 'Issuance summary is unavailable.'
    : eligibleCount === null
      ? 'Issuance eligibility is unavailable.'
      : availableCount === 0
        ? 'No firearms are currently available for allocation.'
        : eligibleCount === 0
          ? 'No guards currently meet the issuance requirements.'
          : ''
  const eligibilityExplanation = eligibleCount === 0 && summary.activeApprovedGuards > 0
    ? `Among ${summary.activeApprovedGuards} active, approved guards, ${summary.guardsWithActivePermit} have a current firearm permit and ${summary.guardsWithValidFirearmsTraining} have valid firearms-handling training. New issuance requires both records for the same guard.`
    : ''

  useEffect(() => {
    const controller = new AbortController()
    void initializeData(controller.signal)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetchAllocations(controller.signal)
    return () => controller.abort()
  }, [currentPage, search, statusFilter, startDate, endDate])

  const initializeData = async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      await Promise.all([fetchSummaryAndGuards(signal), fetchAvailableFirearms(signal)])
      setError('')
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load firearm allocation data')
        logError('Error initializing firearm allocation:', err)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const fetchSummary = async (signal?: AbortSignal) => {
    const data = await fetchJsonOrThrow<AllocationSummary>(
      `${API_BASE_URL}/api/firearm-allocations/summary`,
      { headers: getAuthHeaders(), signal },
      'Failed to load firearm allocation summary',
    )
    if (!signal?.aborted) {
      setSummary(data)
      setSummaryAvailable(true)
    }
    return data
  }

  const fetchSummaryAndGuards = async (signal?: AbortSignal) => {
    const data = await fetchSummary(signal)
    if (!signal?.aborted && data.eligibleGuards !== null) {
      await fetchEligibleGuards(signal)
    }
  }

  const fetchEligibleGuards = async (signal?: AbortSignal) => {
    const data = await fetchJsonOrThrow<{ guards?: GuardSearchOption[] }>(
      `${API_BASE_URL}/api/firearm-allocations/eligible-guards?page=1&page_size=200`,
      { headers: getAuthHeaders(), signal },
      'Failed to load eligible guards',
    )
    if (!signal?.aborted) setGuards(data.guards || [])
  }

  const fetchAvailableFirearms = async (signal?: AbortSignal) => {
    const data = await fetchJsonOrThrow<{ firearms?: Firearm[] }>(
      `${API_BASE_URL}/api/firearms?page=1&page_size=200`,
      { headers: getAuthHeaders(), signal },
      'Failed to load firearms',
    )
    if (!signal?.aborted) setFirearms(data.firearms || [])
  }

  const fetchAllocations = async (signal?: AbortSignal) => {
    setRegisterLoading(true)
    try {
      const params = new URLSearchParams({ page: String(currentPage), page_size: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      const data = await fetchJsonOrThrow<{ allocations?: Allocation[], total?: number }>(
        `${API_BASE_URL}/api/firearm-allocations?${params.toString()}`,
        { headers: getAuthHeaders(), signal },
        'Failed to load firearm allocations',
      )
      if (signal?.aborted) return
      setAllocations(data.allocations || [])
      setTotalAllocations(data.total || 0)
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load firearm allocations')
        logError('Error fetching firearm allocations:', err)
      }
    } finally {
      if (!signal?.aborted) setRegisterLoading(false)
    }
  }

  const refreshAllocationData = async () => {
    await Promise.all([fetchSummaryAndGuards(), fetchAvailableFirearms(), fetchAllocations()])
  }

  const allocateFirearm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (allocationBlockedReason) {
      setError(allocationBlockedReason)
      return
    }
    if (!selectedGuard) {
      setError('Select an eligible guard from the results.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/firearm-allocation/issue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ guardId: selectedGuard.id, firearmId: newAllocation.firearmId }),
        },
        'Unable to allocate firearm',
      )
      setSuccess('Firearm allocated successfully.')
      setNewAllocation({ guardId: '', firearmId: '' })
      setShowAllocateForm(false)
      await refreshAllocationData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to allocate firearm')
    } finally {
      setLoading(false)
    }
  }

  const confirmReturnFirearm = async () => {
    if (!returnCandidate) return
    setReturningId(returnCandidate.id)
    setError('')
    setSuccess('')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/firearm-allocation/return`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ allocationId: returnCandidate.id }),
        },
        'Unable to return firearm',
      )
      setSuccess('Firearm returned successfully and is now available.')
      setReturnCandidate(null)
      await Promise.all([
        fetchAllocations(),
        Promise.all([fetchSummary(), fetchAvailableFirearms()]).catch((err) => {
          logError('Error refreshing firearm counts after return:', err)
        }),
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to return firearm')
    } finally {
      setReturningId(null)
    }
  }

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault()
    setCurrentPage(1)
    setSearch(searchInput.trim())
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatusFilter('')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
  }

  const statusClass = (status: string) => {
    if (status.toLowerCase() === 'active') return 'bg-info-bg text-info-text ring-1 ring-info-border'
    if (status.toLowerCase() === 'returned') return 'bg-success-bg text-success-text ring-1 ring-success-border'
    return 'soc-status-neutral'
  }

  const renderAllocationRow = (allocation: Allocation) => {
    const isActive = allocation.status.toLowerCase() === 'active'
    const originLabel = ORIGIN_LABELS[allocation.recordOrigin ?? 'unknown']

    return (
      <tr key={allocation.id} className="border-b border-border hover:bg-surface-hover">
        <td className="px-4 py-3 text-text-primary">
          {allocation.guardName || 'Unknown guard'}
          {originLabel ? <p className="text-xs text-text-secondary">{originLabel}</p> : null}
        </td>
        <td className="px-4 py-3 text-text-primary">
          {[allocation.firearmSerialNumber, allocation.firearmModel].filter(Boolean).join(' - ') || 'Unknown firearm'}
        </td>
        <td className="px-4 py-3 text-text-secondary">{formatDate(allocation.returnDate)}</td>
        <td className="px-4 py-3">
          <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${statusClass(allocation.status)}`}>
            {allocationStatusLabel(allocation.status)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {isActive ? (
            <button
              type="button"
              onClick={() => setReturnCandidate(allocation)}
              disabled={returningId === allocation.id}
              className="soc-btn inline-flex min-h-11 items-center gap-2 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              {returningId === allocation.id ? 'Returning...' : 'Return'}
            </button>
          ) : <span className="text-xs text-text-tertiary">No action</span>}
        </td>
      </tr>
    )
  }

  return (
    <OperationalShell user={user} title="ALLOCATION" navItems={getSidebarNav(user.role)} activeView={currentView} onNavigate={(view) => onViewChange?.(view)} onLogout={onLogout} mobileMenuOpen={mobileMenuOpen} onMenuOpen={() => setMobileMenuOpen(true)} onMenuClose={() => setMobileMenuOpen(false)} onLogoClick={() => onViewChange?.('dashboard')}>
      {loading ? <div className="flex flex-1 items-center justify-center text-center text-info-text">Loading firearm allocation data...</div> : (
        <div className="flex-1 w-full overflow-y-auto px-2 py-4 sm:px-4 md:p-8 animate-fade-in">
          <section className="soc-surface animate-section-enter mb-5 p-4 md:p-5">
            <OperationalPageHeader eyebrow="Asset custody" title="Firearm allocations" description="Eligibility shows who qualifies today. The register includes earlier allocations and imported records." icon={ShieldCheck} status={summaryAvailable ? <span className={summary.activeCustody > 0 ? 'soc-chip status-warning' : 'soc-chip status-success'}>{summary.activeCustody > 0 ? summary.activeCustody + ' register entries marked active' : 'No active custody entries'}</span> : undefined} actions={<button type="button" onClick={() => setShowAllocateForm((open) => !open)} disabled={Boolean(allocationBlockedReason)} title={allocationBlockedReason || 'Allocate firearm'} className={showAllocateForm ? 'soc-btn soc-btn-neutral inline-flex min-h-10 items-center gap-2 px-3 disabled:cursor-not-allowed disabled:opacity-60' : 'soc-btn-primary inline-flex min-h-10 items-center gap-2 px-3 disabled:cursor-not-allowed disabled:opacity-60'}>{showAllocateForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{showAllocateForm ? 'Close form' : 'Allocate firearm'}</button>} />
            {allocationBlockedReason ? <p className="mt-3 text-sm text-warning-text" role="status">{allocationBlockedReason}</p> : null}
            {eligibilityExplanation ? <p className="mt-2 text-sm text-text-secondary" role="status">{eligibilityExplanation}</p> : null}
            {summary.custodyReviewFirearms > 0 ? <div className="mt-3 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status">{summary.custodyReviewFirearms} firearm record{summary.custodyReviewFirearms === 1 ? '' : 's'} require custody review and are excluded from active custody and the allocation selector.</div> : null}
            {error ? <div role="alert" className="mt-4 rounded border border-danger-border bg-danger-bg p-4 text-danger-text">{error}</div> : null}
            {success ? <div role="status" className="mt-4 rounded border border-success-border bg-success-bg p-4 text-success-text">{success}</div> : null}
          </section>

          {summaryAvailable && <div className="animate-section-enter mb-5"><OperationalSummaryBand items={[
            { label: 'Eligible for new issuance', value: eligibleCount ?? 'Unavailable', tone: (eligibleCount ?? 0) > 0 ? 'info' : 'warning', icon: Users },
            { label: 'Returned records', value: summary.returnedAllocations, tone: 'neutral', icon: CheckCircle2 },
            { label: 'Allocation records', value: summary.totalAllocationRecords, tone: 'neutral', icon: ClipboardCheck },
            { label: 'Available firearms', value: availableCount, tone: availableCount > 0 ? 'success' : 'warning', icon: PackageCheck },
            { label: 'Custody review', value: summary.custodyReviewFirearms, tone: summary.custodyReviewFirearms > 0 ? 'warning' : 'neutral', icon: ClipboardCheck },
            { label: 'Maintenance', value: summary.maintenanceFirearms || 0, tone: 'neutral', icon: ShieldCheck },
          ]} /></div>}

          <SentinelModal open={showAllocateForm} onClose={() => { if (!loading) setShowAllocateForm(false) }} title="Allocate firearm" subtitle="Select one eligible guard and one available firearm.">
            <form onSubmit={allocateFirearm} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <GuardSearchSelect
                  id="allocation-guard"
                  label="Eligible guard"
                  guards={guards}
                  value={newAllocation.guardId}
                  onChange={(guardId) => setNewAllocation((current) => ({ ...current, guardId }))}
                  emptyMessage="No eligible guards are available for firearm allocation."
                  clearSelectionOnEdit
                  required
                />
                <div>
                  <label htmlFor="allocation-firearm" className="soc-form-label">Available firearm</label>
                  <select id="allocation-firearm" value={newAllocation.firearmId} onChange={(event) => setNewAllocation({ ...newAllocation, firearmId: event.target.value })} className="soc-form-control w-full" required>
                    <option value="">Select an available firearm</option>
                    {availableFirearms.map((firearm) => <option key={firearm.id} value={firearm.id}>{[firearm.serialNumber, firearm.model].filter(Boolean).join(' - ')}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading || Boolean(allocationBlockedReason) || !selectedGuard} className="soc-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Allocating...' : 'Allocate firearm'}
              </button>
            </form>
          </SentinelModal>

          <section className="table-glass animate-section-enter rounded p-4 md:p-6"><div className="mb-4 flex items-start gap-3 border-b border-border-subtle pb-4"><PackageCheck className="h-5 w-5 text-info-text" aria-hidden="true" /><div><h3 className="text-lg font-bold text-text-primary">Allocation register</h3><p className="text-sm text-text-secondary">Search custody records by guard, Guard ID, firearm serial number, or issue date.</p></div></div>
            <form onSubmit={applySearch} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5"><label className="md:col-span-2"><span className="sr-only">Search allocations</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="soc-form-control w-full pl-10" placeholder="Guard, Guard ID, or serial" /></div></label><select value={statusFilter} onChange={(event) => { setCurrentPage(1); setStatusFilter(event.target.value) }} className="soc-form-control" aria-label="Filter allocations by status"><option value="">All statuses</option><option value="active">Active</option><option value="returned">Returned</option><option value="imported">Imported records</option></select><input type="date" value={startDate} onChange={(event) => { setCurrentPage(1); setStartDate(event.target.value) }} className="soc-form-control" aria-label="Allocation date from" /><input type="date" value={endDate} onChange={(event) => { setCurrentPage(1); setEndDate(event.target.value) }} className="soc-form-control" aria-label="Allocation date to" /><div className="flex gap-2 md:col-start-4 md:col-span-2 md:justify-end"><button type="submit" className="soc-btn soc-btn-neutral">Search</button><button type="button" onClick={clearFilters} className="soc-btn soc-btn-neutral">Clear</button></div></form>
            {!registerLoading && allocations.length > 0 ? (
              <div className="overflow-x-auto">
                <table aria-label="Allocation register" className="w-full min-w-[840px] border-collapse">
                  <thead className="thead-glass">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Guard</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Firearm / serial</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Returned</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map(renderAllocationRow)}
                  </tbody>
                </table>
              </div>
            ) : null}
            {registerLoading ? (
              <p className="py-4 text-sm text-text-secondary" role="status">Loading allocation register...</p>
            ) : allocations.length === 0 ? (
              <p className="py-8 text-center text-text-secondary">
                No allocation records match the selected filters.
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between"><p>Showing <span className="font-semibold text-text-primary">{firstVisible}-{lastVisible}</span> of <span className="font-semibold text-text-primary">{totalAllocations}</span> records</p><div className="flex items-center gap-2"><button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="soc-btn soc-btn-neutral min-h-10 disabled:opacity-60" aria-label="Previous allocation page"><ChevronLeft size={16} aria-hidden="true" />Previous</button><span className="min-w-24 text-center font-semibold text-text-primary" aria-live="polite">Page {currentPage} of {pageCount}</span><button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} className="soc-btn soc-btn-neutral min-h-10 disabled:opacity-60" aria-label="Next allocation page">Next<ChevronRight size={16} aria-hidden="true" /></button></div></div>
          </section>
        </div>
      )}
      <SentinelModal open={Boolean(returnCandidate)} onClose={() => { if (!returningId) setReturnCandidate(null) }} title="Return firearm" subtitle={returnCandidate ? `Mark ${returnCandidate.firearmSerialNumber || 'this firearm'} as returned?` : undefined}><p className="text-sm text-text-secondary">Confirm you received the firearm back. This closes the active custody record and makes the firearm available for a future allocation.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReturnCandidate(null)} disabled={Boolean(returningId)} className="soc-btn soc-btn-neutral">Cancel</button><button type="button" onClick={() => void confirmReturnFirearm()} disabled={Boolean(returningId)} className="soc-btn-primary">{returningId ? 'Returning...' : 'Return firearm'}</button></div></SentinelModal>
    </OperationalShell>
  )
}

export default FirearmAllocation
