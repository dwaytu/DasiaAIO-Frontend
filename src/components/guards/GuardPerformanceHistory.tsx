import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import SentinelModal from '../shared/SentinelModal'

const historyTitles = {
  concerns: 'Performance concerns',
  shifts: 'Shift history',
  punctuality: 'Punctuality history',
  on_time: 'On-time check-ins',
  late: 'Late check-ins',
  no_show: 'Recorded no-shows and absences',
  evaluations: 'Evaluation history',
}

export type GuardHistoryCategory = keyof typeof historyTitles

interface HistoryRecord {
  id: string
  kind: 'shift' | 'punctuality' | 'evaluation'
  occurred_at: string | null
  site: string | null
  status: string | null
  check_in_time: string | null
  check_out_time: string | null
  minutes_late: number | null
  rating: number | null
  comment: string | null
  evaluator_name: string | null
}

interface HistoryPage {
  total: number
  pageSize: number
  items: HistoryRecord[]
}

const recordDate = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
})

const statusLabels: Record<string, string> = {
  checked_out: 'Checked out',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  on_time: 'On time',
  early: 'Early',
  late: 'Late',
  no_show: 'Recorded no-show',
  absent: 'Recorded absence',
  present: 'Present',
}

function HistoryEntry({ record }: { record: HistoryRecord }) {
  const isEvaluation = record.kind === 'evaluation'
  const isConcern = record.status === 'late' || record.status === 'no_show' || record.status === 'absent'
    || (record.rating !== null && record.rating < 3)
  const label = isEvaluation
    ? `Evaluation · ${record.rating?.toFixed(1)} / 5`
    : statusLabels[record.status ?? ''] || record.status || 'Shift record'

  return (
    <li className="space-y-2 rounded-lg border border-border-subtle bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={isConcern ? 'soc-status-warning' : 'soc-status-neutral'}>{label}</span>
        {record.occurred_at ? (
          <time dateTime={record.occurred_at} className="text-xs text-text-secondary">{recordDate.format(new Date(record.occurred_at))}</time>
        ) : <span className="text-xs text-text-secondary">Date unavailable</span>}
      </div>
      {record.site ? <p className="break-words text-sm font-semibold text-text-primary">{record.site}</p> : null}
      {record.check_in_time ? <p className="text-sm text-text-secondary">Checked in {recordDate.format(new Date(record.check_in_time))}</p> : null}
      {record.check_out_time ? <p className="text-sm text-text-secondary">Checked out {recordDate.format(new Date(record.check_out_time))}</p> : null}
      {record.status === 'late' && record.minutes_late !== null ? (
        <p className="text-sm text-text-secondary">{record.minutes_late} min late</p>
      ) : null}
      {isEvaluation ? (
        <p className="break-words text-sm text-text-secondary">{record.evaluator_name || 'Evaluator not identified'}</p>
      ) : null}
      {record.comment ? <p className="whitespace-pre-wrap break-words text-sm text-text-primary">{record.comment}</p> : null}
    </li>
  )
}

export default function GuardPerformanceHistory({ guardId, guardName, category, onClose }: {
  guardId: string
  guardName: string
  category: GuardHistoryCategory
  onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [history, setHistory] = useState<HistoryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ category, page: String(page) })
    setLoading(true)
    setError(false)
    void fetchJsonOrThrow<HistoryPage>(
      `${API_BASE_URL}/api/merit/history/${encodeURIComponent(guardId)}?${params}`,
      { headers: getAuthHeaders(), signal: controller.signal, cache: 'no-store' },
      'Failed to load guard history',
    ).then((result) => {
      if (!controller.signal.aborted) setHistory(result)
    }).catch(() => {
      if (!controller.signal.aborted) setError(true)
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [guardId, category, page, revision])

  const lastPage = history ? Math.max(1, Math.ceil(history.total / history.pageSize)) : 1

  return (
    <SentinelModal open onClose={onClose} title={historyTitles[category]} subtitle={guardName} size="lg">
      {category === 'concerns' ? (
        <p className="mb-4 text-sm text-text-secondary">Recorded late check-ins, absences, and evaluations below 3 out of 5.</p>
      ) : null}
      {error ? (
        <div className="space-y-3">
          <p className="text-sm text-danger-text" role="alert">Unable to load guard history.</p>
          <button type="button" className="soc-btn soc-btn-neutral min-h-11" onClick={() => setRevision((value) => value + 1)}>Retry</button>
        </div>
      ) : null}
      {loading ? <p className="text-sm text-text-secondary" role="status">Loading history…</p> : null}
      {!loading && !error && history ? (
        <div className="space-y-3">
          {history.items.length === 0 ? (
            <p className="text-sm text-text-secondary" role="status">No matching records.</p>
          ) : (
            <>
              <p className="text-xs text-text-secondary" role="status">{history.total} recorded {history.total === 1 ? 'entry' : 'entries'}</p>
              <ul className="space-y-3">
                {history.items.map((record) => <HistoryEntry key={`${record.kind}-${record.id}`} record={record} />)}
              </ul>
            </>
          )}
        </div>
      ) : null}
      {(lastPage > 1 || page > 1) ? (
        <nav className="mt-4 flex flex-wrap items-center justify-between gap-2" aria-label="History pages">
          <button type="button" className="soc-btn soc-btn-neutral min-h-11" disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span className="text-xs text-text-secondary">Page {page} of {Math.max(page, lastPage)}</span>
          <button type="button" className="soc-btn soc-btn-neutral min-h-11" disabled={page >= lastPage || loading || error}
            onClick={() => setPage((value) => value + 1)}>Next</button>
        </nav>
      ) : null}
    </SentinelModal>
  )
}
