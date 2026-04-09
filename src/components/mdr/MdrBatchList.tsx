import { FC, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'

interface MdrBatchListProps {
  onSelectBatch: (batchId: string) => void
  refreshKey?: number
}

interface MdrImportBatch {
  id: string
  filename: string
  report_month: string
  branch?: string | null
  uploaded_by: string
  status: string
  total_rows?: number | null
  matched_rows?: number | null
  new_rows?: number | null
  ambiguous_rows?: number | null
  error_rows?: number | null
  created_at: string
}

interface PaginatedResponse<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

const PAGE_SIZE = 20

function toNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'committed':
      return 'bg-success/10 text-success'
    case 'reviewing':
      return 'bg-warning/10 text-warning'
    case 'rejected':
      return 'bg-danger/10 text-danger'
    default:
      return 'bg-accent/10 text-text-primary'
  }
}

const MdrBatchList: FC<MdrBatchListProps> = ({ onSelectBatch, refreshKey = 0 }) => {
  const [items, setItems] = useState<MdrImportBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    const abortController = new AbortController()

    async function loadBatches(): Promise<void> {
      setLoading(true)
      setError('')

      try {
        const response = await fetchJsonOrThrow<PaginatedResponse<MdrImportBatch>>(
          `${API_BASE_URL}/api/mdr/batches?page=${page}&pageSize=${PAGE_SIZE}`,
          {
            headers: getAuthHeaders(),
            signal: abortController.signal,
          },
          'Unable to load MDR batch history.',
        )

        if (cancelled || abortController.signal.aborted) return

        setItems(response.items ?? [])
        setTotal(response.total ?? 0)
      } catch (fetchError) {
        if (cancelled || abortController.signal.aborted) return
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Unable to load MDR batch history.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadBatches()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [page, refreshKey])

  const totalPages = useMemo(() => {
    if (total <= 0) return 1
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [total])

  return (
    <section className="space-y-4 rounded border border-border bg-surface-elevated p-4 md:p-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">MDR Batch History</h2>
        <p className="text-sm text-text-secondary">Review uploaded batches and open staging review pages.</p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 rounded border border-border bg-surface p-3 text-sm text-text-primary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading MDR batch history...
        </div>
      ) : null}

      {error ? (
        <div className="rounded border border-danger bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded border border-border bg-surface p-6 text-center text-sm text-text-secondary">
          No MDR import batches found.
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded border border-border bg-surface">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Workbook</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2">Uploaded By</th>
                <th className="px-3 py-2">Rows</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((batch) => (
                <tr key={batch.id} className="border-b border-border text-sm text-text-primary">
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold uppercase ${statusBadgeClass(batch.status)}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{batch.filename}</div>
                    <div className="text-xs text-text-secondary">
                      {batch.report_month}
                      {batch.branch ? ` | ${batch.branch}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{formatDateTime(batch.created_at)}</td>
                  <td className="px-3 py-3 text-text-secondary">{batch.uploaded_by}</td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-text-secondary">
                      total {toNumber(batch.total_rows)}
                      {' | '}matched {toNumber(batch.matched_rows)}
                      {' | '}new {toNumber(batch.new_rows)}
                      {' | '}ambiguous {toNumber(batch.ambiguous_rows)}
                      {' | '}error {toNumber(batch.error_rows)}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="soc-btn min-h-11"
                      onClick={() => onSelectBatch(batch.id)}
                    >
                      View Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="soc-btn min-h-11"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="soc-btn min-h-11"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}

export default MdrBatchList
