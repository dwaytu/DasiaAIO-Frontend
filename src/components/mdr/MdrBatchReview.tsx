import { FC, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'

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
  created_at: string
}

interface PaginatedResponse<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

type ResolveMatchStatus = 'matched' | 'new'

interface ResolveDraft {
  matchStatus: ResolveMatchStatus
  matchedGuardId: string
  matchedFirearmId: string
  matchedClientId: string
}

const PAGE_SIZE = 50

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

    if (action === 'commit') {
      setIsCommitting(true)
    } else {
      setIsRejecting(true)
    }

    try {
      await fetchJsonOrThrow<{ status: string }>(
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
      setActionError(
        batchError instanceof Error ? batchError.message : `Unable to ${action} MDR batch.`,
      )
    } finally {
      if (action === 'commit') {
        setIsCommitting(false)
      } else {
        setIsRejecting(false)
      }
    }
  }

  const unresolvedCount = toNumber(batch?.ambiguous_rows) + toNumber(batch?.error_rows)

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

      {actionMessage ? (
        <div className="flex items-center gap-2 rounded border border-success bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{actionMessage}</span>
        </div>
      ) : null}

      {batch ? (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-6">
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
                  const isAmbiguous = row.match_status === 'ambiguous'

                  return (
                    <tr key={row.id} className="border-b border-border text-sm text-text-primary align-top">
                      <td className="px-3 py-3 text-text-secondary">
                        {row.sheet_name} #{row.row_number}
                      </td>
                      <td className="px-3 py-3">{row.section ?? '-'}</td>
                      <td className="px-3 py-3">
                        <div>{row.client_name ?? '-'}</div>
                        <div className="text-xs text-text-secondary">{row.client_number ?? '-'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{row.guard_name ?? '-'}</div>
                        <div className="text-xs text-text-secondary">{row.guard_number ?? '-'}</div>
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
                        {isAmbiguous ? (
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
                            </select>

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

                            <button
                              type="button"
                              className="soc-btn min-h-11 w-full"
                              onClick={() => {
                                void handleResolveRow(row)
                              }}
                              disabled={resolvingRowId === row.id}
                            >
                              {resolvingRowId === row.id ? 'Resolving...' : 'Resolve Row'}
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
    </section>
  )
}

export default MdrBatchReview
