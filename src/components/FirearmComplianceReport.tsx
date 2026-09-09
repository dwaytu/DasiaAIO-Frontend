import { useEffect, useMemo, useState, type FC } from 'react'
import { Bell, Download, Filter, Printer, RefreshCw, ShieldCheck } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import { getSidebarNav } from '../config/navigation'

interface ComplianceItem {
  firearmId: string
  serialNumber: string
  model: string
  caliber: string
  firearmStatus: string
  holderId?: string | null
  holderName?: string | null
  allocationId?: string | null
  allocationDate?: string | null
  expectedReturnDate?: string | null
  permitId?: string | null
  permitType?: string | null
  permitExpiryDate?: string | null
  permitStatus?: string | null
  permitDaysRemaining?: number | null
  maintenanceId?: string | null
  maintenanceType?: string | null
  maintenanceDate?: string | null
  maintenanceStatus?: string | null
  complianceStatus: string
}

interface ComplianceResponse {
  total: number
  page: number
  pageSize: number
  summary: Record<string, number>
  items: ComplianceItem[]
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const STATUS_OPTIONS = [
  ['all', 'All records'],
  ['expired', 'Expired'],
  ['expiring_soon', 'Expiring soon'],
  ['no_permit', 'No valid permit'],
  ['maintenance', 'Under maintenance'],
  ['allocated', 'Allocated'],
  ['unallocated', 'Unallocated'],
  ['compliant', 'Compliant'],
]

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function statusClass(status: string): string {
  if (status === 'expired' || status === 'no_permit') return 'bg-danger-bg text-danger-text ring-1 ring-danger-border'
  if (status === 'expiring_soon' || status === 'maintenance') return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
  return 'bg-success-bg text-success-text ring-1 ring-success-border'
}

const FirearmComplianceReport: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [filters, setFilters] = useState({ status: 'all', windowDays: '30' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [report, setReport] = useState<ComplianceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      windowDays: appliedFilters.windowDays,
      page: String(page),
      pageSize: '50',
    })
    if (appliedFilters.status !== 'all') params.set('status', appliedFilters.status)

    setLoading(true)
    setError('')
    void fetchJsonOrThrow<ComplianceResponse>(
      `${API_BASE_URL}/api/firearms/compliance-report?${params.toString()}`,
      { headers: getAuthHeaders(), signal: controller.signal },
      'Unable to load firearm compliance report',
    )
      .then(setReport)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load firearm compliance report')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [appliedFilters, page, refreshKey])

  const totalPages = Math.max(1, Math.ceil((report?.total ?? 0) / (report?.pageSize ?? 50)))
  const summaryCards = useMemo(() => [
    ['Total firearms', report?.summary.totalFirearms ?? 0],
    ['Expired', report?.summary.expired ?? 0],
    ['Expiring soon', report?.summary.expiringSoon ?? 0],
    ['No valid permit', report?.summary.noPermit ?? 0],
    ['Maintenance', report?.summary.maintenance ?? 0],
  ], [report])

  const applyFilters = () => {
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  const exportCsv = () => {
    const header = ['Serial number', 'Model', 'Caliber', 'Firearm status', 'Holder', 'Permit status', 'Permit expiry', 'Compliance status']
    const rows = (report?.items ?? []).map((item) => [
      item.serialNumber,
      item.model,
      item.caliber,
      item.firearmStatus,
      item.holderName || item.holderId || 'Unallocated',
      item.permitStatus || 'No permit',
      formatDate(item.permitExpiryDate),
      item.complianceStatus,
    ])
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'firearm-compliance-report.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const syncNotifications = async () => {
    setNotice('')
    try {
      const result = await fetchJsonOrThrow<{ created: number }>(
        `${API_BASE_URL}/api/firearms/compliance-notifications`,
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ windowDays: Number(appliedFilters.windowDays) }),
        },
        'Unable to synchronize compliance notifications',
      )
      setNotice(`${result.created} compliance notification${result.created === 1 ? '' : 's'} created.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to synchronize compliance notifications')
    }
  }

  return (
    <OperationalShell
      user={user}
      title="FIREARM COMPLIANCE"
      navItems={getSidebarNav(user.role)}
      activeView={activeView || 'firearm-compliance'}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >
      {loading && !report ? (
        <div className="flex-1 p-4 md:p-8"><LoadingSkeleton variant="table" /></div>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-8 print:p-0">
          <section className="table-glass rounded p-4 md:p-6 print:hidden">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="soc-kicker">ASSET GOVERNANCE</p>
                <h2 className="text-2xl font-black uppercase tracking-wide text-text-primary">Firearm Compliance</h2>
                <p className="mt-1 text-sm text-text-secondary">Inventory, custody, permits, maintenance, and expiration visibility in one report.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => window.print()} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Print compliance report"><Printer size={16} /> Print</button>
                <button type="button" onClick={exportCsv} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Export compliance report as CSV"><Download size={16} /> CSV</button>
                <button type="button" onClick={() => void syncNotifications()} className="soc-btn-primary inline-flex min-h-10 items-center gap-2 px-3" title="Notify supervisors and administrators"><Bell size={16} /> Sync alerts</button>
              </div>
            </div>
            {notice ? <p className="mt-4 rounded border border-success-border bg-success-bg p-3 text-sm text-success-text">{notice}</p> : null}
            {error ? <p role="alert" className="mt-4 rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">{error}</p> : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="text-xs font-semibold text-text-secondary">Compliance status
                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-sm text-text-primary">
                  {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-text-secondary">Expiration window (days)
                <input type="number" min="1" max="365" value={filters.windowDays} onChange={(event) => setFilters({ ...filters, windowDays: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-sm text-text-primary" />
              </label>
              <div className="flex items-end gap-2">
                <button type="button" onClick={applyFilters} className="soc-btn-primary inline-flex min-h-10 flex-1 items-center justify-center gap-2 px-3"><Filter size={16} /> Apply</button>
                <button type="button" onClick={() => { setFilters({ status: 'all', windowDays: '30' }); setPage(1); setAppliedFilters({ status: 'all', windowDays: '30' }) }} className="soc-btn min-h-10 px-3">Clear</button>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
            {summaryCards.map(([label, value]) => <div key={label} className="soc-kpi-card"><p className="soc-kpi-label">{label}</p><p className="soc-kpi-value">{value}</p></div>)}
          </section>

          <section className="table-glass rounded p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="soc-kicker">COMPLIANCE REGISTER</p><h3 className="text-lg font-bold text-text-primary">Firearm records</h3><p className="text-sm text-text-secondary">{report?.total ?? 0} matching record{report?.total === 1 ? '' : 's'}</p></div>
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3 print:hidden" title="Refresh compliance report"><RefreshCw size={16} /> Refresh</button>
            </div>
            {report?.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead className="thead-glass"><tr>{['Firearm', 'Custody', 'Permit', 'Maintenance', 'Compliance'].map((heading) => <th key={heading} className="border-b-2 border-border px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">{heading}</th>)}</tr></thead>
                  <tbody>{report.items.map((item) => <tr key={item.firearmId} className="border-b border-border hover:bg-surface-hover">
                    <td className="px-3 py-3"><p className="font-semibold text-text-primary">{item.serialNumber}</p><p className="text-xs text-text-secondary">{item.model} · {item.caliber}</p><p className="text-xs text-text-secondary">Status: {item.firearmStatus}</p></td>
                    <td className="px-3 py-3 text-text-primary">{item.holderName || item.holderId || 'Unallocated'}<p className="text-xs text-text-secondary">{item.expectedReturnDate ? `Return ${formatDate(item.expectedReturnDate)}` : 'No return date'}</p></td>
                    <td className="px-3 py-3 text-text-primary">{item.permitType || 'No permit'}<p className="text-xs text-text-secondary">{item.permitExpiryDate ? `${formatDate(item.permitExpiryDate)} (${item.permitDaysRemaining ?? 0}d)` : '—'}</p></td>
                    <td className="px-3 py-3 text-text-primary">{item.maintenanceType || 'None'}<p className="text-xs text-text-secondary">{item.maintenanceDate ? formatDate(item.maintenanceDate) : '—'}</p></td>
                    <td className="px-3 py-3"><span className={`inline-block rounded px-2 py-1 text-xs font-semibold uppercase ${statusClass(item.complianceStatus)}`}>{item.complianceStatus.replace('_', ' ')}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
            ) : <EmptyState icon={ShieldCheck} title="No compliance records" subtitle="No firearms match the selected compliance filters." />}
            <div className="mt-5 flex items-center justify-end gap-3 print:hidden"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="soc-btn min-h-10 px-3 disabled:opacity-50">Previous</button><span className="text-sm text-text-secondary">Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="soc-btn min-h-10 px-3 disabled:opacity-50">Next</button></div>
          </section>
        </div>
      )}
    </OperationalShell>
  )
}

export default FirearmComplianceReport
