import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { formatLicenseExpiry } from '../utils/formatLicenseExpiry'
import DocumentReportLayout from './shared/DocumentReportLayout'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'

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
  if (status === 'expired' || status === 'no_permit') return 'border-danger-border bg-danger-bg text-danger-text'
  if (status === 'expiring_soon' || status === 'maintenance') return 'border-warning-border bg-warning-bg text-warning-text'
  return 'border-success-border bg-success-bg text-success-text'
}

export default function FirearmComplianceReport() {
  const [filters, setFilters] = useState({ status: 'all', windowDays: '30' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [report, setReport] = useState<ComplianceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
      .then((result) => {
        if (!controller.signal.aborted) setReport(result)
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load firearm compliance report')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [appliedFilters, page, refreshKey])

  const today = new Date()
  const totalPages = Math.max(1, Math.ceil((report?.total ?? 0) / (report?.pageSize ?? 50)))
  const summary = [
    { label: 'Total firearms', value: report?.summary.totalFirearms ?? 0 },
    { label: 'Expired', value: report?.summary.expired ?? 0 },
    { label: 'Expiring soon', value: report?.summary.expiringSoon ?? 0 },
    { label: 'No valid permit', value: report?.summary.noPermit ?? 0 },
    { label: 'Maintenance', value: report?.summary.maintenance ?? 0 },
  ]

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

  if (loading && !report) return <LoadingSkeleton variant="table" />

  return (
    <DocumentReportLayout
      title="Firearm records"
      summary={summary}
      total={report?.total ?? 0}
      page={page}
      totalPages={totalPages}
      statusOptions={STATUS_OPTIONS}
      filters={filters}
      notice={notice}
      error={error}
      onFilterChange={setFilters}
      onApply={applyFilters}
      onClear={() => {
        const defaults = { status: 'all', windowDays: '30' }
        setFilters(defaults)
        setAppliedFilters(defaults)
        setPage(1)
      }}
      onExport={exportCsv}
      onSyncAlerts={() => void syncNotifications()}
      onRefresh={() => setRefreshKey((value) => value + 1)}
      onPageChange={setPage}
    >
      {report?.items.length ? (
        <div className="overflow-x-auto print:overflow-visible" tabIndex={0} role="region" aria-label="Firearm records table">
        <table className="w-full min-w-[46rem] print:min-w-0 border-collapse text-sm">
          <thead className="sticky top-0 z-10 h-11 border-b border-border-subtle bg-surface-elevated/60 text-xs font-semibold uppercase tracking-wider text-text-tertiary backdrop-blur-xs"><tr>{['Firearm', 'Custody', 'Permit', 'Maintenance', 'Compliance'].map((heading) => <th key={heading} scope="col" className="px-4 py-3.5 text-left">{heading}</th>)}</tr></thead>
          <tbody>{report.items.map((item) => <tr key={item.firearmId} className="border-b border-border-subtle/80 transition-colors hover:bg-surface-hover/50">
            <td className="px-4 py-3.5 align-middle text-sm text-text-primary"><p className="font-semibold text-text-primary">{item.serialNumber}</p><p className="text-xs text-text-secondary">{item.model} · {item.caliber}</p><p className="text-xs text-text-secondary">Status: {item.firearmStatus}</p></td>
            <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{item.holderName || item.holderId || 'Unallocated'}<p className="text-xs text-text-secondary">{item.expectedReturnDate ? `Return ${formatDate(item.expectedReturnDate)}` : 'No return date'}</p></td>
            <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{item.permitType || 'No permit'}<p className="text-xs text-text-secondary">{formatLicenseExpiry(item.permitExpiryDate, today) ?? '—'}</p></td>
            <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{item.maintenanceType || 'None'}<p className="text-xs text-text-secondary">{item.maintenanceDate ? formatDate(item.maintenanceDate) : '—'}</p></td>
            <td className="px-4 py-3.5 align-middle text-sm text-text-primary"><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass(item.complianceStatus)}`}>{item.complianceStatus.replace('_', ' ')}</span></td>
          </tr>)}</tbody>
        </table>
        </div>
      ) : <EmptyState icon={ShieldCheck} title="No compliance records" subtitle="No firearms match the selected compliance filters." />}
    </DocumentReportLayout>
  )
}
