import { useEffect, useMemo, useState, type FC } from 'react'
import { Bell, Download, Filter, Printer, RefreshCw, ShieldCheck } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'
import { getSidebarNav } from '../config/navigation'

interface ComplianceItem {
  guardId: string
  guardNumber?: number | null
  guardName: string
  licenseNumber?: string | null
  licenseIssuedDate?: string | null
  licenseExpiryDate?: string | null
  licenseDaysRemaining?: number | null
  complianceStatus: string
}

interface ComplianceSummary {
  totalGuards: number
  expired: number
  expiringSoon: number
  noLicense: number
  compliant: number
}

interface ComplianceResponse {
  total: number
  page: number
  pageSize: number
  summary: ComplianceSummary
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
  ['no_license', 'No license'],
  ['compliant', 'Compliant'],
]

function formatDate(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function statusClass(status: string): string {
  if (status === 'expired' || status === 'no_license') return 'bg-danger-bg text-danger-text ring-1 ring-danger-border'
  if (status === 'expiring_soon') return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
  return 'bg-success-bg text-success-text ring-1 ring-success-border'
}

const GuardLicenseComplianceReport: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
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
      `${API_BASE_URL}/api/guards/compliance-report?${params.toString()}`,
      { headers: getAuthHeaders(), signal: controller.signal },
      'Unable to load guard license compliance report',
    )
      .then(setReport)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load guard license compliance report')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [appliedFilters, page, refreshKey])

  const totalPages = Math.max(1, Math.ceil((report?.total ?? 0) / (report?.pageSize ?? 50)))
  const summaryCards = useMemo(() => [
    ['Total guards', report?.summary.totalGuards ?? 0],
    ['Expired', report?.summary.expired ?? 0],
    ['Expiring soon', report?.summary.expiringSoon ?? 0],
    ['No license', report?.summary.noLicense ?? 0],
    ['Compliant', report?.summary.compliant ?? 0],
  ], [report])

  const applyFilters = () => {
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  const exportCsv = () => {
    const header = ['Guard', 'Guard number', 'License number', 'Issued', 'Expiry', 'Days remaining', 'Compliance status']
    const rows = (report?.items ?? []).map((item) => [
      item.guardName,
      item.guardNumber ?? '',
      item.licenseNumber ?? '',
      formatDate(item.licenseIssuedDate),
      formatDate(item.licenseExpiryDate),
      item.licenseDaysRemaining ?? '',
      item.complianceStatus,
    ])
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'guard-license-compliance-report.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const syncNotifications = async () => {
    setNotice('')
    try {
      const result = await fetchJsonOrThrow<{ created: number }>(
        `${API_BASE_URL}/api/guards/compliance-notifications`,
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ windowDays: Number(appliedFilters.windowDays) }),
        },
        'Unable to synchronize guard license notifications',
      )
      setNotice(`${result.created} guard license alert${result.created === 1 ? '' : 's'} created.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to synchronize guard license notifications')
    }
  }

  return (
    <OperationalShell
      user={user}
      title="GUARD LICENSE COMPLIANCE"
      navItems={getSidebarNav(user.role)}
      activeView={activeView || 'guard-compliance'}
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
            <OperationalPageHeader
              eyebrow="Personnel governance"
              title="Guard License Compliance"
              description="Review guard licenses and identify expired or approaching expiry records."
              icon={ShieldCheck}
              actions={
                <>
                <button type="button" onClick={() => window.print()} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Print guard license compliance report"><Printer size={16} /> Print</button>
                <button type="button" onClick={exportCsv} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Export guard license compliance report as CSV"><Download size={16} /> CSV</button>
                <button type="button" onClick={() => void syncNotifications()} className="soc-btn-primary inline-flex min-h-10 items-center gap-2 px-3" title="Notify supervisors and administrators"><Bell size={16} /> Sync alerts</button>
                </>
              }
            />
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

          <section className="print:hidden">
            <OperationalSummaryBand
              items={summaryCards.map(([label, value]) => ({ label: String(label), value, tone: label === 'Expired' || label === 'No license' ? 'danger' : label === 'Expiring soon' ? 'warning' : label === 'Compliant' ? 'success' : 'neutral' }))}
            />
          </section>

          <section className="table-glass rounded p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="soc-kicker">COMPLIANCE REGISTER</p><h3 className="text-lg font-bold text-text-primary">Guard license records</h3><p className="text-sm text-text-secondary">{report?.total ?? 0} matching record{report?.total === 1 ? '' : 's'}</p></div>
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3 print:hidden" title="Refresh guard license compliance report"><RefreshCw size={16} /> Refresh</button>
            </div>
            {report?.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead className="thead-glass"><tr>{['Guard', 'License number', 'Issued', 'Expiry', 'Compliance'].map((heading) => <th key={heading} className="border-b-2 border-border px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">{heading}</th>)}</tr></thead>
                  <tbody>{report.items.map((item) => <tr key={item.guardId} className="border-b border-border hover:bg-surface-hover">
                    <td className="px-3 py-3"><p className="font-semibold text-text-primary">{item.guardName}</p><p className="text-xs text-text-secondary">{item.guardNumber ? `Guard #${item.guardNumber}` : 'Guard number not provided'}</p></td>
                    <td className="px-3 py-3 text-text-primary">{item.licenseNumber || 'Not provided'}</td>
                    <td className="px-3 py-3 text-text-primary">{formatDate(item.licenseIssuedDate)}</td>
                    <td className="px-3 py-3 text-text-primary">{item.licenseExpiryDate ? `${formatDate(item.licenseExpiryDate)} (${item.licenseDaysRemaining ?? 0}d)` : 'Not provided'}</td>
                    <td className="px-3 py-3"><span className={`inline-block rounded px-2 py-1 text-xs font-semibold uppercase ${statusClass(item.complianceStatus)}`}>{item.complianceStatus.replace('_', ' ')}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
            ) : <EmptyState icon={ShieldCheck} title="No guard license records" subtitle="No guards match the selected compliance filters." />}
            <div className="mt-5 flex items-center justify-end gap-3 print:hidden"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="soc-btn min-h-10 px-3 disabled:opacity-50">Previous</button><span className="text-sm text-text-secondary">Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="soc-btn min-h-10 px-3 disabled:opacity-50">Next</button></div>
          </section>
        </div>
      )}
    </OperationalShell>
  )
}

export default GuardLicenseComplianceReport
