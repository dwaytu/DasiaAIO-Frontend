import { FC, useEffect, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { fetchSwapRequestsFeed, type SwapRequestsFeedState } from '../../utils/swapRequests'

interface SwapRequest {
  id: string
  requesterId: string
  requesterName: string | null
  targetId: string
  targetName: string | null
  shiftId: string
  reason: string | null
  status: 'pending' | 'accepted' | 'declined'
  respondedAt: string | null
  createdAt: string
}

interface Props {
  currentUserId: string
  currentUserRole: string
  shiftOptions: Array<{
    id: string
    label: string
  }>
}

function isSwapStatus(value: unknown): value is SwapRequest['status'] {
  return value === 'pending' || value === 'accepted' || value === 'declined'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeSwapRequest(value: unknown): SwapRequest | null {
  if (!isRecord(value)) return null

  const id = value.id
  const requesterId = typeof value.requesterId === 'string' ? value.requesterId : value.requester_id
  const targetId = typeof value.targetId === 'string' ? value.targetId : value.target_id
  const shiftId = typeof value.shiftId === 'string' ? value.shiftId : value.shift_id
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : value.created_at
  const status = isSwapStatus(value.status) ? value.status : 'pending'

  if (
    typeof id !== 'string' ||
    typeof requesterId !== 'string' ||
    typeof targetId !== 'string' ||
    typeof shiftId !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null
  }

  return {
    id,
    requesterId,
    requesterName: asOptionalString(value.requesterName ?? value.requester_name),
    targetId,
    targetName: asOptionalString(value.targetName ?? value.target_name),
    shiftId,
    reason: asOptionalString(value.reason),
    status,
    respondedAt: asOptionalString(value.respondedAt ?? value.responded_at),
    createdAt,
  }
}

const GuardShiftSwapPanel: FC<Props> = ({ currentUserId, currentUserRole, shiftOptions }) => {
  const [requests, setRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestFeedState, setRequestFeedState] = useState<SwapRequestsFeedState>('ready')

  // New swap request form
  const [targetId, setTargetId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<string | null>(null)
  const [responseStatus, setResponseStatus] = useState<string | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSwapRequestsFeed(getAuthHeaders())
      setRequestFeedState(data.feedState)
      setRequests(data.swapRequests.map(normalizeSwapRequest).filter((request): request is SwapRequest => request !== null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load shift swap requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRequests()
  }, [])

  const handleSubmitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    if (shiftOptions.length === 0) {
      setSubmitStatus('No scheduled shifts are available to attach right now. Use Schedule Change Requests above or contact the Operations Desk for manual swap support.')
      return
    }
    if (!targetId.trim()) {
      setSubmitStatus('Enter the target guard ID from Operations Desk or your site supervisor before sending this request.')
      return
    }
    if (!shiftId.trim()) {
      setSubmitStatus('Select the scheduled shift that needs coverage before sending this request.')
      return
    }
    setSubmitting(true)
    setSubmitStatus(null)
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/shifts/swap-request`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            requesterId: currentUserId,
            targetId: targetId.trim(),
            shiftId: shiftId.trim(),
            reason: reason.trim() || null,
          }),
        },
        'Failed to submit shift swap request.',
      )
      setSubmitStatus('Shift swap request submitted.')
      setResponseStatus(null)
      setTargetId('')
      setShiftId('')
      setReason('')
      void fetchRequests()
    } catch (err) {
      setSubmitStatus(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRespond = async (swapId: string, status: 'accepted' | 'declined') => {
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/shifts/swap-requests/${swapId}/respond`,
        {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status }),
        },
        `Unable to ${status === 'accepted' ? 'accept' : 'decline'} the shift swap request.`,
      )
      setResponseStatus(`Shift swap request ${status}.`)
      void fetchRequests()
    } catch (error) {
      setResponseStatus(
        error instanceof Error
          ? error.message
          : `Unable to ${status === 'accepted' ? 'accept' : 'decline'} the shift swap request.`,
      )
    }
  }

  // Guards only see their own requests; supervisors/admins see all
  const visibleRequests =
    currentUserRole === 'guard'
      ? requests.filter((r) => r.requesterId === currentUserId || r.targetId === currentUserId)
      : requests

  const requestFeedMessage =
    requestFeedState === 'unavailable'
      ? 'Shift swap updates are temporarily unavailable. You can still submit a manual request below.'
      : requestFeedState === 'stale'
        ? 'Shift swap updates may be out of date right now. You can still submit a manual request below.'
        : null

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-labelledby="swap-panel-heading">
      <h2 id="swap-panel-heading" className="text-lg font-bold text-text-primary">
        Shift Swaps
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Request a shift swap with another guard. Both guards must be available on the desired dates.
      </p>

      {requestFeedMessage ? (
        <div className="mt-3 rounded-xl border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status" aria-live="polite">
          {requestFeedMessage}
        </div>
      ) : null}

      {/* New request form — only guards submit */}
      {currentUserRole === 'guard' && (
        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={(e) => void handleSubmitRequest(e)}
          aria-label="New shift swap request"
        >
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-text-secondary" htmlFor="swap-shift-id">
              Scheduled Shift
            </label>
            <select
              id="swap-shift-id"
              required
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              disabled={submitting || shiftOptions.length === 0}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            >
              <option value="">Select a shift</option>
              {shiftOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {shiftOptions.length === 0 ? (
              <p className="mt-1 text-xs text-text-tertiary">
                No upcoming shifts are available to attach right now. Use Schedule Change Requests above or contact the Operations Desk for manual swap support.
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-text-secondary" htmlFor="swap-target-id">
              Target Guard ID
            </label>
            <input
              id="swap-target-id"
              type="text"
              required
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="Guard user ID from Operations Desk"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
            <p className="mt-1 text-xs text-text-tertiary">
              Enter the SENTINEL user ID for the guard covering your post. If you do not know it, confirm with Operations Desk or your site supervisor before submitting.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-text-secondary" htmlFor="swap-reason">
              Reason (optional)
            </label>
            <textarea
              id="swap-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe the reason"
              className="mt-1 min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Request Swap'}
            </button>
            {submitStatus && (
              <p className="text-sm text-text-secondary" role="status" aria-live="polite">
                {submitStatus}
              </p>
            )}
          </div>
        </form>
      )}

      {responseStatus ? (
        <p className="mt-3 text-sm text-text-secondary" role="status" aria-live="polite">
          {responseStatus}
        </p>
      ) : null}

      {/* Request list */}
      <div className="mt-5">
        <h3 className="text-base font-semibold text-text-primary">
          {currentUserRole === 'guard' ? 'My Swap Requests' : 'All Swap Requests'}
        </h3>

        {loading && (
          <p className="mt-2 text-sm text-text-secondary" aria-live="polite">Loading…</p>
        )}
        {error && !loading && (
          <p className="mt-2 text-sm text-red-400" role="alert">{error}</p>
        )}
        {!loading && !error && visibleRequests.length === 0 && requestFeedState !== 'ready' && (
          <p className="mt-2 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">
            Swap request history is unavailable right now.
          </p>
        )}
        {!loading && !error && visibleRequests.length === 0 && requestFeedState === 'ready' && (
          <p className="mt-2 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">
            No swap requests found.
          </p>
        )}

        {!loading && visibleRequests.length > 0 && (
          <ul className="mt-2 space-y-2" aria-label="Shift swap requests">
            {visibleRequests.map((req) => (
              <li
                key={req.id}
                className="rounded-lg border border-border-subtle bg-surface-elevated p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary">
                      {req.requesterName ?? req.requesterId}
                      <span className="mx-1 font-normal text-text-secondary">→</span>
                      {req.targetName ?? req.targetId}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Shift: <span className="font-mono">{req.shiftId}</span>
                    </p>
                    {req.reason && (
                      <p className="mt-0.5 text-xs text-text-secondary">{req.reason}</p>
                    )}
                    <p className="mt-1 text-xs text-text-tertiary">
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`status-badge status-badge-${req.status}`}
                    >
                      {req.status}
                    </span>

                    {/* Allow the target guard to respond to pending requests */}
                    {req.status === 'pending' && req.targetId === currentUserId && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRespond(req.id, 'accepted')}
                          className="swap-response-btn swap-response-accept"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRespond(req.id, 'declined')}
                          className="swap-response-btn swap-response-decline"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default GuardShiftSwapPanel
