import { useEffect, useMemo, useState, type FC, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Download, FileText, Filter, Printer, RefreshCw } from 'lucide-react'
import OperationalShell from './layout/OperationalShell'
import LoadingSkeleton from './shared/LoadingSkeleton'
import type { User } from '../context/AuthContext'
import { API_BASE_URL } from '../config'
import { getSidebarNav } from '../config/navigation'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'

interface Props {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface DtrRecord {
  shiftId: string
  attendanceId?: string | null
  guardId: string
  guardName: string
  clientSite: string
  scheduledStart: string
  scheduledEnd: string
  actualCheckIn?: string | null
  actualCheckOut?: string | null
  lateMinutes?: number | null
  totalHours?: number | null
  status: 'scheduled' | 'checked_in' | 'completed' | 'absent' | 'no_show' | string
}

interface DtrResponse {
  total: number
  page: number
  pageSize: number
  items: DtrRecord[]
}

interface DtrFilters {
  guardId: string
  from: string
  to: string
  site: string
  status: string
}

const EMPTY_FILTERS: DtrFilters = { guardId: '', from: '', to: '', site: '', status: '' }
const PAGE_SIZE = 50

function buildDtrUrl(filters: DtrFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (filters.guardId.trim()) params.set('guardId', filters.guardId.trim())
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.site.trim()) params.set('site', filters.site.trim())
  if (filters.status) params.set('status', filters.status)
  return `${API_BASE_URL}/api/attendance/dtr?${params.toString()}`
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function formatHours(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)} h` : '-'
}

function statusClass(status: string): string {
  switch (status) {
    case 'completed': return 'border-success-border bg-success-bg text-success-text'
    case 'checked_in': return 'border-info-border bg-info-bg text-info-text'
    case 'no_show': return 'border-danger-border bg-danger-bg text-danger-text'
    case 'absent': return 'border-warning-border bg-warning-bg text-warning-text'
    default: return 'border-border-subtle bg-surface-elevated text-text-secondary'
  }
}

function csvCell(value: unknown): string {
  const normalized = value == null ? '' : String(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

function downloadCsv(items: DtrRecord[]): void {
  const header = ['Guard', 'Guard ID', 'Site', 'Scheduled Start', 'Scheduled End', 'Check In', 'Check Out', 'Late Minutes', 'Total Hours', 'Status']
  const rows = items.map((item) => [
    item.guardName,
    item.guardId,
    item.clientSite,
    formatDateTime(item.scheduledStart),
    formatDateTime(item.scheduledEnd),
    formatDateTime(item.actualCheckIn),
    formatDateTime(item.actualCheckOut),
    item.lateMinutes ?? '',
    item.totalHours ?? '',
    item.status,
  ])
  const content = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `sentinel-dtr-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const DtrReport: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [filters, setFilters] = useState<DtrFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<DtrFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [report, setReport] = useState<DtrResponse>({ total: 0, page: 1, pageSize: PAGE_SIZE, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportNotice, setExportNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    void fetchJsonOrThrow<DtrResponse>(
      buildDtrUrl(appliedFilters, page),
      { headers: getAuthHeaders(), signal: controller.signal },
      'Failed to load DTR report',
    ).then(setReport).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Unable to load attendance records. Check your connection and try again.')
      setReport((previous) => ({ ...previous, items: [], total: 0 }))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    return () => controller.abort()
  }, [appliedFilters, page])

  const totalPages = Math.max(1, Math.ceil(report.total / report.pageSize))
  const rangeLabel = useMemo(() => {
    if (report.total === 0) return 'No records'
    const start = (report.page - 1) * report.pageSize + 1
    const end = Math.min(report.page * report.pageSize, report.total)
    return `${start}-${end} of ${report.total}`
  }, [report.page, report.pageSize, report.total])

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters(filters)
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const homeView = user.role === 'guard' ? 'overview' : 'dashboard'
  const navItems = getSidebarNav(user.role, { homeView })

  return (
    <OperationalShell
      user={user}
      title="DTR REPORT"
      navItems={navItems}
      activeView={activeView || 'dtr'}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.(homeView)}
    >
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <section className="soc-surface print:hidden mb-4 p-4 md:p-5">
          <OperationalPageHeader
            eyebrow="Attendance records"
            title="Daily Time Record"
            description="Review guard attendance, check-in/check-out records, and working hours for the selected period."
            icon={FileText}
            status={<span className="soc-status-neutral">{rangeLabel}</span>}
            actions={(
              <>
              <button type="button" onClick={() => window.print()} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Print DTR report">
                <Printer className="h-4 w-4" aria-hidden="true" /> Print
              </button>
              <button type="button" onClick={() => { downloadCsv(report.items); setExportNotice('Current report page exported as CSV.') }} disabled={report.items.length === 0} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3 disabled:opacity-50" title="Export current page as CSV">
                <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
              </button>
              </>
            )}
          />

          <div className="mt-4">
            <OperationalSummaryBand
              items={[
                { label: 'Matching records', value: report.total, detail: 'Across all result pages', tone: 'info', icon: FileText },
                { label: 'Showing now', value: report.items.length, detail: rangeLabel, tone: 'neutral', icon: Filter },
              ]}
            />
          </div>

          <form onSubmit={submitFilters} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <p className="md:col-span-2 xl:col-span-6 text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">Filter records</p>
            <p className="md:col-span-2 xl:col-span-6 text-xs text-text-secondary">Leave a filter blank to include all records. Apply filters to update the displayed period.</p>
            <label className="space-y-1 text-xs font-semibold text-text-secondary">
              Guard ID
              <input value={filters.guardId} onChange={(event) => setFilters({ ...filters, guardId: event.target.value })} className="soc-input w-full" placeholder="Optional guard ID" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-text-secondary">
              From
              <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="soc-input w-full" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-text-secondary">
              To
              <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="soc-input w-full" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-text-secondary">
              Site
              <input value={filters.site} onChange={(event) => setFilters({ ...filters, site: event.target.value })} className="soc-input w-full" placeholder="Search site" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-text-secondary">
              Status
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="soc-input w-full">
                <option value="">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="checked_in">Checked in</option>
                <option value="completed">Completed</option>
                <option value="absent">Absent</option>
                <option value="no_show">No-show</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="soc-btn-primary inline-flex min-h-10 flex-1 items-center justify-center gap-2 px-3">
                <Filter className="h-4 w-4" aria-hidden="true" /> Apply
              </button>
              <button type="button" onClick={clearFilters} className="soc-btn min-h-10 px-3">Clear</button>
            </div>
          </form>
        </section>

        {loading ? <LoadingSkeleton variant="table" /> : (
          <section className="soc-surface p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-text-primary">DTR Entries</h3>
                <p className="text-sm text-text-secondary">{rangeLabel}</p>
              </div>
              <button type="button" onClick={() => setAppliedFilters({ ...appliedFilters })} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Refresh DTR report">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
              </button>
            </div>

            {error && <p role="alert" className="mb-3 rounded border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">{error}</p>}
            {exportNotice && <p role="status" className="mb-3 rounded border border-success-border bg-success-bg px-3 py-2 text-sm text-success-text">{exportNotice}</p>}
            {report.items.length === 0 && !error ? (
              <div className="rounded border border-border-subtle bg-surface-elevated px-4 py-10 text-center text-sm text-text-secondary">No attendance records were found for the selected filters. Adjust the period, site, guard, or status and try again.</div>
            ) : (
              <div className="dtr-print-table-wrap overflow-x-auto">
                <table className="dtr-print-table w-full min-w-[1100px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                      <th className="px-3 py-3">Guard</th><th className="px-3 py-3">Site</th><th className="px-3 py-3">Scheduled</th><th className="px-3 py-3">Check in</th><th className="px-3 py-3">Check out</th><th className="px-3 py-3">Late</th><th className="px-3 py-3">Hours</th><th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((item) => (
                      <tr key={item.shiftId} className="border-b border-border-subtle text-text-primary last:border-0">
                        <td className="px-3 py-3"><div className="font-semibold">{item.guardName}</div><div className="text-xs text-text-tertiary">{item.guardId}</div></td>
                        <td className="px-3 py-3">{item.clientSite}</td>
                        <td className="px-3 py-3 whitespace-nowrap"><div>{formatDateTime(item.scheduledStart)}</div><div className="text-xs text-text-tertiary">to {formatDateTime(item.scheduledEnd)}</div></td>
                        <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(item.actualCheckIn)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(item.actualCheckOut)}</td>
                        <td className="px-3 py-3">{typeof item.lateMinutes === 'number' ? `${item.lateMinutes} min` : '-'}</td>
                        <td className="px-3 py-3">{formatHours(item.totalHours)}</td>
                        <td className="px-3 py-3"><span className={`dtr-print-status inline-flex rounded-full border px-2 py-1 text-xs font-semibold uppercase ${statusClass(item.status)}`}>{item.status.replace('_', ' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2 print:hidden">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="soc-btn inline-flex min-h-10 items-center gap-1 px-3 disabled:opacity-50"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous</button>
              <span className="px-2 text-sm text-text-secondary">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="soc-btn inline-flex min-h-10 items-center gap-1 px-3 disabled:opacity-50">Next <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          </section>
        )}
      </div>
    </OperationalShell>
  )
}

export default DtrReport
