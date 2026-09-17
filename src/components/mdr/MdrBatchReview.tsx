import { FC, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders, parseResponseBody } from '../../utils/api'
import SentinelModal from '../shared/SentinelModal'

interface MdrBatchReviewProps {
  batchId: string
  userRole: string
  onBackToHistory: () => void
  onBatchUpdated?: () => void
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
  pending_rows?: number | null
  committed_at?: string | null
  committed_by?: string | null
  created_at: string
}

interface MdrStagingRow {
  id: string
  batch_id: string
  sheet_name: string
  row_number: number
  section?: string | null
  client_number?: number | null
  client_name?: string | null
  client_address?: string | null
  guard_number?: number | null
  guard_name?: string | null
  contact_number?: string | null
  license_number?: string | null
  license_expiry?: string | null
  firearm_kind?: string | null
  firearm_make?: string | null
  caliber?: string | null
  serial_number?: string | null
  firearm_validity?: string | null
  actual_ammo?: string | null
  ammo_count?: string | null
  lic_reg_name?: string | null
  pullout_status?: string | null
  fa_remarks?: string | null
  match_status: string
  matched_guard_id?: string | null
  matched_firearm_id?: string | null
  matched_client_id?: string | null
  validation_errors?: string[] | null
  created_at: string
}

interface PaginatedResponse<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

interface BatchActionResponse {
  status: string
  summary?: Record<string, number>
}

interface CommitBlockedPayload {
  status: 'blocked'
  reason?: string
  message?: string
  unresolved?: {
    total?: number
    pending?: number
    ambiguous?: number
    errors?: number
  }
}

interface CommitNotice {
  kind: 'success' | 'blocked' | 'error'
  title: string
  message: string
  details?: string
}

type ResolveMatchStatus = 'matched' | 'new' | 'ignored'

interface ResolveDraft {
  matchStatus: ResolveMatchStatus
  matchedGuardId: string
  matchedFirearmId: string
  matchedClientId: string
  resolutionNote: string
}

const PAGE_SIZE = 50

function toNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function summaryCount(summary: Record<string, number>, camelCaseKey: string, snakeCaseKey: string): number {
  return Number(summary[camelCaseKey] ?? summary[snakeCaseKey] ?? 0)
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

function matchStatusClass(matchStatus: string): string {
  switch (matchStatus.toLowerCase()) {
    case 'matched':
      return 'bg-success/10 text-success'
    case 'new':
      return 'bg-accent/10 text-text-primary'
    case 'ambiguous':
      return 'bg-warning/10 text-warning'
    case 'error':
      return 'bg-danger/10 text-danger'
    case 'pending':
      return 'bg-warning/10 text-warning'
    case 'ignored':
      return 'bg-surface text-text-secondary'
    default:
      return 'bg-surface text-text-secondary'
  }
}

function buildDefaultDraft(row: MdrStagingRow): ResolveDraft {
  return {
    matchStatus: 'matched',
    matchedGuardId: row.matched_guard_id ?? '',
    matchedFirearmId: row.matched_firearm_id ?? '',
    matchedClientId: row.matched_client_id ?? '',
    resolutionNote: '',
  }
}

const MdrBatchReview: FC<MdrBatchReviewProps> = ({
  batchId,
  userRole,
  onBackToHistory,
  onBatchUpdated,
}) => {
  const [batch, setBatch] = useState<MdrImportBatch | null>(null)
  const [rows, setRows] = useState<MdrStagingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [refreshSeed, setRefreshSeed] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, ResolveDraft>>({})
  const [resolvingRowId, setResolvingRowId] = useState<string | null>(null)
  const [isCommitting, setIsCommitting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [commitBlockDetail, setCommitBlockDetail] = useState<CommitBlockedPayload | null>(null)
  const [commitNotice, setCommitNotice] = useState<CommitNotice | null>(null)

  const canCommit = userRole === 'superadmin'
  const canReject = userRole === 'superadmin' || userRole === 'admin'

  useEffect(() => {
    let cancelled = false
    const abortController = new AbortController()

    async function loadReviewData(): Promise<void> {
      setLoading(true)
      setError('')

      try {
        const headers = getAuthHeaders()

        const [batchResponse, reviewResponse] = await Promise.all([
          fetchJsonOrThrow<MdrImportBatch>(
            `${API_BASE_URL}/api/mdr/batches/${encodeURIComponent(batchId)}`,
            {
              headers,
              signal: abortController.signal,
            },
            'Unable to load MDR batch details.',
          ),
          fetchJsonOrThrow<PaginatedResponse<MdrStagingRow>>(
            `${API_BASE_URL}/api/mdr/batches/${encodeURIComponent(batchId)}/review?page=${page}&pageSize=${PAGE_SIZE}`,
            {
              headers,
              signal: abortController.signal,
            },
            'Unable to load MDR staging rows.',
          ),
        ])

        if (cancelled || abortController.signal.aborted) return

        setBatch(batchResponse)
        setRows(reviewResponse.items ?? [])
        setTotal(reviewResponse.total ?? 0)

        setDrafts((currentDrafts) => {
          const nextDrafts = { ...currentDrafts }

          for (const row of reviewResponse.items ?? []) {
            if (row.match_status === 'ambiguous' && !nextDrafts[row.id]) {
              nextDrafts[row.id] = buildDefaultDraft(row)
            }
          }

          return nextDrafts
        })
      } catch (fetchError) {
        if (cancelled || abortController.signal.aborted) return

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Unable to load MDR review data.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadReviewData()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [batchId, page, refreshSeed])

  const totalPages = useMemo(() => {
    if (total <= 0) return 1
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [total])

  const guardOptions = useMemo(() => {
    const values = new Set<string>()

    for (const row of rows) {
      if (row.matched_guard_id) values.add(row.matched_guard_id)
    }

    for (const draft of Object.values(drafts)) {
      if (draft.matchedGuardId) values.add(draft.matchedGuardId)
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [rows, drafts])

  const firearmOptions = useMemo(() => {
    const values = new Set<string>()

    for (const row of rows) {
      if (row.matched_firearm_id) values.add(row.matched_firearm_id)
    }

    for (const draft of Object.values(drafts)) {
      if (draft.matchedFirearmId) values.add(draft.matchedFirearmId)
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [rows, drafts])

  const clientOptions = useMemo(() => {
    const values = new Set<string>()

    for (const row of rows) {
      if (row.matched_client_id) values.add(row.matched_client_id)
    }

    for (const draft of Object.values(drafts)) {
      if (draft.matchedClientId) values.add(draft.matchedClientId)
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [rows, drafts])

  const updateDraft = (
    row: MdrStagingRow,
    patch: Partial<ResolveDraft>,
  ): void => {
    setDrafts((currentDrafts) => {
      const current = currentDrafts[row.id] ?? buildDefaultDraft(row)
      return {
        ...currentDrafts,
        [row.id]: {
          ...current,
          ...patch,
        },
      }
    })
  }

  const handleResolveRow = async (row: MdrStagingRow) => {
    const draft = drafts[row.id] ?? buildDefaultDraft(row)

    setResolvingRowId(row.id)
    setActionMessage('')
    setActionError('')

    try {
      await fetchJsonOrThrow<{ status: string }>(
        `${API_BASE_URL}/api/mdr/staging/${encodeURIComponent(row.id)}/resolve`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            matchStatus: draft.matchStatus,
            matchedGuardId: draft.matchedGuardId || null,
            matchedFirearmId: draft.matchedFirearmId || null,
            matchedClientId: draft.matchedClientId || null,
            resolutionNote: draft.resolutionNote.trim() || null,
          }),
        },
        'Unable to resolve staging row.',
      )

      setActionMessage(`Resolved row ${row.row_number} successfully.`)
      setRefreshSeed((current) => current + 1)
    } catch (resolveError) {
      setActionError(
        resolveError instanceof Error ? resolveError.message : 'Unable to resolve staging row.',
      )
    } finally {
      setResolvingRowId(null)
    }
  }

  const runBatchAction = async (action: 'commit' | 'reject') => {
    if (!batch) return

    setActionError('')
    setActionMessage('')
    setCommitBlockDetail(null)
    if (action === 'commit') {
      setCommitNotice(null)
    }

    if (action === 'commit') {
      setIsCommitting(true)
    } else {
      setIsRejecting(true)
    }

    try {
      if (action === 'commit') {
        const response = await fetch(`${API_BASE_URL}/api/mdr/batches/${encodeURIComponent(batch.id)}/commit`, {
          method: 'POST',
          headers: getAuthHeaders(),
        })

        const body = await parseResponseBody(response)
        if (!response.ok) {
          const blockedPayload = body as CommitBlockedPayload
          if (response.status === 409 && blockedPayload?.status === 'blocked') {
            setCommitBlockDetail(blockedPayload)
            const unresolved = blockedPayload.unresolved
            const details = unresolved
              ? `Pending: ${toNumber(unresolved.pending)} | Ambiguous: ${toNumber(unresolved.ambiguous)} | Error: ${toNumber(unresolved.errors)} | Total: ${toNumber(unresolved.total)}`
              : undefined
            setCommitNotice({
              kind: 'blocked',
              title: 'Batch not committed',
              message: 'No database changes were made. Resolve every pending, ambiguous, or error row before committing.',
              details,
            })
          } else {
            const message =
              typeof body?.error === 'string'
                ? body.error
                : typeof body?.message === 'string'
                  ? body.message
                  : 'Unable to commit MDR batch.'
            setActionError(message)
            setCommitNotice({
              kind: 'error',
              title: 'Batch commit failed',
              message: 'No database changes were confirmed. Review the error and try again.',
              details: message,
            })
          }
          return
        }

        const commitResponse = body as BatchActionResponse
        if (commitResponse.summary) {
          const blockedGuards = summaryCount(commitResponse.summary, 'guardRecordsBlocked', 'guard_records_blocked')
          const blockedFirearms = summaryCount(commitResponse.summary, 'firearmRecordsBlocked', 'firearm_records_blocked')
          const guardsCreated = summaryCount(commitResponse.summary, 'guardsCreated', 'guards_created')
          const guardsUpdated = summaryCount(commitResponse.summary, 'guardsUpdated', 'guards_updated')
          setActionMessage(
            `Batch commit succeeded. Guard blocks: ${blockedGuards} | Firearm blocks: ${blockedFirearms}.`,
          )
          setCommitNotice({
            kind: 'success',
            title: 'Batch committed successfully',
            message: 'The MDR batch is now committed and its valid guard, license, firearm, and assignment data was written to the database.',
            details: `Guards created: ${guardsCreated} | Guards updated: ${guardsUpdated} | Guard records blocked: ${blockedGuards} | Firearm records blocked: ${blockedFirearms}`,
          })
        } else {
          setActionMessage('Batch commit succeeded.')
          setCommitNotice({
            kind: 'success',
            title: 'Batch committed successfully',
            message: 'The MDR batch is now committed and its valid data was written to the database.',
          })
        }
        onBatchUpdated?.()
        setRefreshSeed((current) => current + 1)
        return
      }

      await fetchJsonOrThrow<BatchActionResponse>(
        `${API_BASE_URL}/api/mdr/batches/${encodeURIComponent(batch.id)}/${action}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        },
        `Unable to ${action} MDR batch.`,
      )

      setActionMessage(`Batch ${action} succeeded.`)
      onBatchUpdated?.()
      setRefreshSeed((current) => current + 1)
    } catch (batchError) {
      const message = batchError instanceof Error ? batchError.message : `Unable to ${action} MDR batch.`
      setActionError(message)
      if (action === 'commit') {
        setCommitNotice({
          kind: 'error',
          title: 'Batch commit failed',
          message: 'No database changes were confirmed. Check the connection and try again.',
          details: message,
        })
      }
    } finally {
      if (action === 'commit') {
        setIsCommitting(false)
      } else {
        setIsRejecting(false)
      }
    }
  }

  const unresolvedCount =
    toNumber(batch?.ambiguous_rows) +
    toNumber(batch?.error_rows) +
    toNumber(batch?.pending_rows)

  return (
    <section className="space-y-4 rounded border border-border bg-surface-elevated p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Batch Review</h2>
          <p className="text-sm text-text-secondary">
            Batch ID: {batchId}
            {batch ? ` | ${batch.filename}` : ''}
          </p>
        </div>
        <button type="button" className="soc-btn min-h-11" onClick={onBackToHistory}>
          Back to Batch History
        </button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 rounded border border-border bg-surface p-3 text-sm text-text-primary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading batch review data...
        </div>
      ) : null}

      {error ? (
        <div className="rounded border border-danger bg-danger/10 p-3 text-sm text-danger">{error}</div>
      ) : null}

      {actionError ? (
        <div className="rounded border border-danger bg-danger/10 p-3 text-sm text-danger">{actionError}</div>
      ) : null}

      {commitBlockDetail?.unresolved ? (
        <div className="rounded border border-warning bg-warning/10 p-3 text-sm text-warning">
          <p className="font-semibold">Commit is blocked until unresolved rows are cleared.</p>
          <p className="mt-1">
            Pending: {toNumber(commitBlockDetail.unresolved.pending)} | Ambiguous:{' '}
            {toNumber(commitBlockDetail.unresolved.ambiguous)} | Error:{' '}
            {toNumber(commitBlockDetail.unresolved.errors)} | Total:{' '}
            {toNumber(commitBlockDetail.unresolved.total)}
          </p>
        </div>
      ) : null}

      {actionMessage ? (
        <div className="flex items-center gap-2 rounded border border-success bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{actionMessage}</span>
        </div>
      ) : null}

      {batch ? (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-7">
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Status</dt>
              <dd className="text-sm font-semibold uppercase text-text-primary">{batch.status}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Total</dt>
              <dd className="text-lg font-semibold text-text-primary">{toNumber(batch.total_rows)}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Matched</dt>
              <dd className="text-lg font-semibold text-success">{toNumber(batch.matched_rows)}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">New</dt>
              <dd className="text-lg font-semibold text-text-primary">{toNumber(batch.new_rows)}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Ambiguous</dt>
              <dd className="text-lg font-semibold text-warning">{toNumber(batch.ambiguous_rows)}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Error</dt>
              <dd className="text-lg font-semibold text-danger">{toNumber(batch.error_rows)}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Pending</dt>
              <dd className="text-lg font-semibold text-warning">{toNumber(batch.pending_rows)}</dd>
            </div>
          </dl>

          <div className="rounded border border-border bg-surface p-3 text-xs text-text-secondary">
            Uploaded by {batch.uploaded_by} on {formatDateTime(batch.created_at)}.
            {unresolvedCount > 0
              ? ` ${unresolvedCount} unresolved rows require action before commit.`
              : ' All rows are resolved for commit.'}
          </div>

          <div className="overflow-x-auto rounded border border-border bg-surface">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Guard</th>
                  <th className="px-3 py-2">Firearm</th>
                  <th className="px-3 py-2">Match</th>
                  <th className="px-3 py-2">Resolve</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const draft = drafts[row.id] ?? buildDefaultDraft(row)
                  const isResolvable =
                    row.match_status === 'ambiguous' ||
                    row.match_status === 'pending' ||
                    row.match_status === 'error'
                  const isErrorRow = row.match_status === 'error'

                  return (
                    <tr key={row.id} className="border-b border-border text-sm text-text-primary align-top">
                      <td className="px-3 py-3 text-text-secondary">
                        {row.sheet_name} #{row.row_number}
                      </td>
                      <td className="px-3 py-3">{row.section ?? '-'}</td>
                      <td className="px-3 py-3">
                        <div>{row.client_name ?? '-'}</div>
                        <div className="text-xs text-text-secondary">{row.client_number ?? '-'}</div>
                        {Array.isArray(row.validation_errors) && row.validation_errors.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-xs text-danger">
                            {row.validation_errors.map((issue, index) => (
                              <li key={`${row.id}-issue-${index}`}>- {issue}</li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div>{row.guard_name ?? '-'}</div>
                        <div className="text-xs text-text-secondary">{row.guard_number ?? '-'}</div>
                        <div className="mt-2 text-xs text-text-secondary">
                          License: {row.license_number || 'Not provided'}
                        </div>
                        <div className="text-xs text-text-secondary">
                          Expiry: {row.license_expiry || 'Not provided'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{row.serial_number ?? '-'}</div>
                        <div className="text-xs text-text-secondary">
                          {[row.firearm_kind, row.firearm_make, row.caliber].filter(Boolean).join(' | ') || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold uppercase ${matchStatusClass(row.match_status)}`}>
                          {row.match_status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {isResolvable ? (
                          <div className="space-y-2">
                            <select
                              className="w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary"
                              value={draft.matchStatus}
                              onChange={(event) => {
                                updateDraft(row, {
                                  matchStatus: event.target.value as ResolveMatchStatus,
                                })
                              }}
                            >
                              <option value="matched">Mark as matched</option>
                              <option value="new">Mark as new</option>
                              {isErrorRow ? <option value="ignored">Skip this row</option> : null}
                            </select>

                            {draft.matchStatus !== 'ignored' ? (
                              <>
                                <select
                                  className="w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary"
                                  value={draft.matchedGuardId}
                                  onChange={(event) => {
                                    updateDraft(row, { matchedGuardId: event.target.value })
                                  }}
                                >
                                  <option value="">Guard ID (optional)</option>
                                  {guardOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  className="w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary"
                                  value={draft.matchedFirearmId}
                                  onChange={(event) => {
                                    updateDraft(row, { matchedFirearmId: event.target.value })
                                  }}
                                >
                                  <option value="">Firearm ID (optional)</option>
                                  {firearmOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  className="w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary"
                                  value={draft.matchedClientId}
                                  onChange={(event) => {
                                    updateDraft(row, { matchedClientId: event.target.value })
                                  }}
                                >
                                  <option value="">Client ID (optional)</option>
                                  {clientOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : null}

                            {isErrorRow ? (
                              <textarea
                                className="min-h-20 w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary"
                                value={draft.resolutionNote}
                                onChange={(event) => {
                                  updateDraft(row, { resolutionNote: event.target.value })
                                }}
                                placeholder="Required: explain why this row is included or skipped"
                                maxLength={500}
                              />
                            ) : null}

                            <button
                              type="button"
                              className="soc-btn min-h-11 w-full"
                              onClick={() => {
                                void handleResolveRow(row)
                              }}
                              disabled={resolvingRowId === row.id}
                            >
                              {resolvingRowId === row.id
                                ? 'Saving...'
                                : isErrorRow
                                  ? 'Apply Decision'
                                  : 'Resolve Row'}
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-text-secondary">No action required</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-text-secondary">
              Page {page} of {totalPages}
            </div>

            <div className="flex flex-wrap items-center gap-2">
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

              {canCommit ? (
                <button
                  type="button"
                  className="soc-btn min-h-11"
                  onClick={() => {
                    void runBatchAction('commit')
                  }}
                  disabled={isCommitting || batch.status === 'committed'}
                >
                  {isCommitting ? 'Committing...' : 'Commit Batch'}
                </button>
              ) : null}

              {canReject ? (
                <button
                  type="button"
                  className="soc-btn min-h-11"
                  onClick={() => {
                    void runBatchAction('reject')
                  }}
                  disabled={isRejecting || batch.status === 'rejected' || batch.status === 'committed'}
                >
                  {isRejecting ? 'Rejecting...' : 'Reject Batch'}
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <SentinelModal
        open={Boolean(commitNotice)}
        onClose={() => setCommitNotice(null)}
        title={commitNotice?.title ?? 'Batch result'}
        subtitle={commitNotice?.kind === 'success' ? 'MDR import confirmation' : 'MDR import was not completed'}
        size="sm"
      >
        {commitNotice ? (
          <div className="space-y-4" role={commitNotice.kind === 'success' ? 'status' : 'alert'}>
            <div
              className={`flex items-start gap-3 rounded border p-4 ${
                commitNotice.kind === 'success'
                  ? 'border-success bg-success/10 text-success'
                  : commitNotice.kind === 'blocked'
                    ? 'border-warning bg-warning/10 text-warning'
                    : 'border-danger bg-danger/10 text-danger'
              }`}
            >
              {commitNotice.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <p className="text-sm font-medium">{commitNotice.message}</p>
            </div>
            {commitNotice.details ? (
              <p className="rounded border border-border bg-surface p-3 text-sm text-text-secondary">
                {commitNotice.details}
              </p>
            ) : null}
            <div className="flex justify-end">
              <button type="button" className="soc-btn soc-btn-neutral min-h-11" onClick={() => setCommitNotice(null)}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </SentinelModal>
    </section>
  )
}

export default MdrBatchReview
