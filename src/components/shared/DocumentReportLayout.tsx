import type { ReactNode } from 'react'
import { Bell, Download, Printer, RefreshCw } from 'lucide-react'

interface DocumentReportFilters {
  status: string
  windowDays: string
}

interface Props {
  title: string
  summary: Array<{ label: string; value: number }>
  total: number
  page: number
  totalPages: number
  statusOptions: string[][]
  filters: DocumentReportFilters
  notice: string
  error: string
  onFilterChange: (filters: DocumentReportFilters) => void
  onApply: () => void
  onClear: () => void
  onExport: () => void
  onSyncAlerts: () => void
  onRefresh: () => void
  onPageChange: (page: number) => void
  children: ReactNode
}

const toolbarButton = 'soc-btn inline-flex min-h-11 items-center justify-center gap-2 px-3'
const filterControl = 'soc-form-control mt-1 min-h-11 w-full'

export default function DocumentReportLayout({
  title, summary, total, page, totalPages, statusOptions, filters, notice, error,
  onFilterChange, onApply, onClear, onExport, onSyncAlerts, onRefresh, onPageChange, children,
}: Props) {
  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="soc-alert-error print:hidden">{error}</p> : null}
      {notice ? <p role="status" className="rounded border border-success-border bg-success-bg p-3 text-sm text-success-text print:hidden">{notice}</p> : null}

      <dl aria-label="Compliance summary" className="grid grid-cols-3 gap-x-3 gap-y-3 rounded-lg border border-border-subtle bg-surface px-4 py-3 sm:gap-x-4 sm:px-5 xl:grid-cols-5 print:hidden">
        {summary.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-medium text-text-secondary">{label}</dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="documents-print-report table-glass min-w-0 rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div>
            <h2 className="text-lg font-bold text-text-primary">{title}</h2>
            <p className="text-sm text-text-secondary">{total} matching {total === 1 ? 'record' : 'records'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Report actions">
            <button type="button" onClick={onRefresh} className={toolbarButton}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
            <button type="button" onClick={() => window.print()} className={toolbarButton}><Printer size={16} aria-hidden="true" /> Print</button>
            <button type="button" onClick={onExport} className={toolbarButton}><Download size={16} aria-hidden="true" /> CSV</button>
            <button type="button" onClick={onSyncAlerts} className={toolbarButton}><Bell size={16} aria-hidden="true" /> Sync alerts</button>
          </div>
        </div>

        <form
          aria-label="Report filters"
          className="my-4 grid max-w-3xl grid-cols-2 items-end gap-3 border-b border-border-subtle pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] print:hidden"
          onSubmit={(event) => { event.preventDefault(); onApply() }}
        >
          <label className="text-xs font-semibold text-text-secondary">Compliance status
            <select value={filters.status} onChange={(event) => onFilterChange({ ...filters, status: event.target.value })} className={filterControl}>
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-text-secondary">Expiration window (days)
            <input type="number" required min="1" max="365" value={filters.windowDays} onChange={(event) => onFilterChange({ ...filters, windowDays: event.target.value })} className={filterControl} />
          </label>
          <div className="col-span-2 flex items-end gap-2 lg:col-auto">
            <button type="submit" className="soc-btn-primary min-h-11 px-4">Apply</button>
            <button type="button" onClick={onClear} className={toolbarButton}>Clear</button>
          </div>
        </form>

        {children}

        {totalPages > 1 || page > 1 ? (
          <nav aria-label="Report pages" className="mt-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={toolbarButton}>Previous</button>
            <span className="text-sm text-text-secondary">Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className={toolbarButton}>Next</button>
          </nav>
        ) : null}
      </section>
    </div>
  )
}
