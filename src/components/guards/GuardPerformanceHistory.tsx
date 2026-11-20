import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
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
export interface GuardEvaluationDraft {
  rating: number
  comment: string
}

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

export default function GuardPerformanceHistory({
  guardId, guardName, category, onClose, onSaveEvaluation, startEvaluationOpen = false,
}: {
  guardId: string
  guardName: string
  category: GuardHistoryCategory
  onClose: () => void
  onSaveEvaluation?: (evaluation: GuardEvaluationDraft) => Promise<string>
  startEvaluationOpen?: boolean
}) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [history, setHistory] = useState<HistoryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [addingEvaluation, setAddingEvaluation] = useState(startEvaluationOpen)
  const [evaluationDraft, setEvaluationDraft] = useState<GuardEvaluationDraft>({ rating: 5, comment: '' })
  const [savingEvaluation, setSavingEvaluation] = useState(false)
  const [evaluationStatus, setEvaluationStatus] = useState<{ message: string; failed: boolean } | null>(null)
  const formId = useId()
  const ratingRef = useRef<HTMLSelectElement>(null)
  const addEvaluationRef = useRef<HTMLButtonElement>(null)
  const canAddEvaluation = category === 'evaluations' && Boolean(onSaveEvaluation)

  useEffect(() => {
    if (canAddEvaluation) {
      const target = addingEvaluation ? ratingRef : addEvaluationRef
      target.current?.focus()
    }
  }, [addingEvaluation, canAddEvaluation])

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

  const submitEvaluation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onSaveEvaluation || savingEvaluation) return
    setEvaluationStatus(null)
    setSavingEvaluation(true)
    try {
      const message = await onSaveEvaluation(evaluationDraft)
      setEvaluationDraft({ rating: 5, comment: '' })
      setAddingEvaluation(false)
      setEvaluationStatus({ message, failed: false })
      setPage(1)
      setRevision((value) => value + 1)
    } catch (error) {
      setEvaluationStatus({
        message: error instanceof Error ? error.message : 'Unable to submit the evaluation. Try again.',
        failed: true,
      })
    } finally {
      setSavingEvaluation(false)
    }
  }

  return (
    <SentinelModal open onClose={onClose} title={historyTitles[category]} subtitle={guardName} size="lg" closeDisabled={savingEvaluation}>
      {canAddEvaluation ? (
        <div className="mb-4 space-y-3">
          {evaluationStatus ? (
            <p role={evaluationStatus.failed ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${
              evaluationStatus.failed ? 'border-danger-border bg-danger-bg text-danger-text' : 'border-success-border bg-success-bg text-success-text'
            }`}>{evaluationStatus.message}</p>
          ) : null}
          {addingEvaluation ? (
            <form onSubmit={submitEvaluation} className="space-y-4 rounded-lg border border-border-subtle bg-surface p-4">
              <h3 className="font-semibold text-text-primary">Add evaluation</h3>
              <div>
                <label className="soc-form-label" htmlFor={`${formId}-rating`}>Rating (1–5 stars)</label>
                <select id={`${formId}-rating`} ref={ratingRef} className="soc-form-control min-h-11 w-full" value={evaluationDraft.rating}
                  disabled={savingEvaluation} onChange={(event) => setEvaluationDraft({ ...evaluationDraft, rating: Number(event.target.value) })}>
                  <option value="1">1 star – Poor</option>
                  <option value="2">2 stars – Fair</option>
                  <option value="3">3 stars – Good</option>
                  <option value="4">4 stars – Very good</option>
                  <option value="5">5 stars – Excellent</option>
                </select>
              </div>
              <div>
                <label className="soc-form-label" htmlFor={`${formId}-comment`}>Comments (optional)</label>
                <textarea id={`${formId}-comment`} className="soc-form-control w-full" rows={3} maxLength={2000}
                  disabled={savingEvaluation} value={evaluationDraft.comment}
                  onChange={(event) => setEvaluationDraft({ ...evaluationDraft, comment: event.target.value })} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="soc-btn soc-btn-primary min-h-11" disabled={savingEvaluation}>
                  {savingEvaluation ? 'Saving…' : 'Submit evaluation'}
                </button>
                <button type="button" className="soc-btn soc-btn-neutral min-h-11" disabled={savingEvaluation}
                  onClick={() => { setAddingEvaluation(false); setEvaluationStatus(null) }}>Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" ref={addEvaluationRef} className="soc-btn soc-btn-primary min-h-11"
              onClick={() => { setAddingEvaluation(true); setEvaluationStatus(null) }}>Add evaluation</button>
          )}
        </div>
      ) : null}
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
