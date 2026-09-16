import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FilePenLine,
  LoaderCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react'
import type { User } from '../../context/AuthContext'
import { normalizeRole } from '../../types/auth'
import { sanitizeErrorMessage } from '../../utils/sanitize'
import {
  archiveOperationalRequest,
  createOperationalRequest,
  getOperationalRequest,
  getRequestResources,
  listOperationalRequests,
  resubmitOperationalRequest,
  type RequestAction,
  updateOperationalRequest,
} from './requestApi'
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type CreateOperationalRequestPayload,
  type OperationalRequest,
  type OperationalRequestEvent,
  type OperationalRequestPriority,
  type OperationalRequestStatus,
  type OperationalRequestType,
  type RequestResource,
} from './types'
import { requestActions } from './requestWorkflow'

interface OperationalRequestsPanelProps {
  user: User
}

const EMPTY_FORM: CreateOperationalRequestPayload = {
  requestType: 'service',
  subject: '',
  reason: '',
  details: '',
  priority: 'normal',
}

const PAGE_SIZE = 25

const STATUS_TONE: Record<OperationalRequestStatus, string> = {
  pending: 'border-warning-border bg-warning-bg text-warning-text',
  needs_correction: 'border-danger-border bg-danger-bg text-danger-text',
  approved: 'border-info-border bg-info-bg text-info-text',
  rejected: 'border-danger-border bg-danger-bg text-danger-text',
  in_progress: 'border-info-border bg-info-bg text-info-text',
  completed: 'border-success-border bg-success-bg text-success-text',
  cancelled: 'border-border bg-surface-elevated text-text-secondary',
}

const ACTION_LABELS: Record<RequestAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  'return-for-correction': 'Return for Correction',
  cancel: 'Cancel Request',
  start: 'Start Fulfillment',
  complete: 'Mark Completed',
}

function errorText(error: unknown): string {
  return sanitizeErrorMessage(error instanceof Error ? error.message : String(error))
}

function resourceLabel(resource: RequestResource): string {
  const detail = resource.serialNumber || resource.caliber
  return `${resource.resourceType === 'firearm_allocation' ? 'Firearm' : 'Equipment'}: ${resource.label}${detail ? ` (${detail})` : ''}`
}

export default function OperationalRequestsPanel({ user }: OperationalRequestsPanelProps) {
  const [requests, setRequests] = useState<OperationalRequest[]>([])
  const [resources, setResources] = useState<RequestResource[]>([])
  const [events, setEvents] = useState<OperationalRequestEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OperationalRequestStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<OperationalRequestType | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<OperationalRequestPriority | 'all'>('all')
  const [requesterFilter, setRequesterFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showCleared, setShowCleared] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateOperationalRequestPayload>(EMPTY_FORM)
  const [decisionAction, setDecisionAction] = useState<RequestAction | null>(null)
  const [decisionReason, setDecisionReason] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  )
  const needsResource = form.requestType === 'deposit' || form.requestType === 'return'
  const role = normalizeRole(user.role)
  const canCreateRequest = role === 'guard' || role === 'supervisor'
  const canReviewAllRequests = role === 'admin' || role === 'superadmin'
  const ownCorrection = canCreateRequest && selected?.status === 'needs_correction' && selected.requesterId === user.id

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, priorityFilter, requesterFilter, showCleared, statusFilter, typeFilter])

  useEffect(() => {
    setDecisionAction(null)
    setDecisionReason('')
  }, [selectedId])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError('')

    Promise.all([
      listOperationalRequests({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter,
        requestType: typeFilter,
        priority: priorityFilter,
        requester: canReviewAllRequests ? requesterFilter : '',
        dateFrom,
        dateTo,
        includeArchived: canReviewAllRequests && showCleared,
      }, controller.signal),
      getRequestResources(controller.signal),
    ])
      .then(([response, availableResources]) => {
        if (!active) return
        setTotal(response.total)
        const lastPage = Math.max(1, Math.ceil(response.total / PAGE_SIZE))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setRequests(response.items)
        setResources(availableResources)
        if (selectedId && !response.items.some((request) => request.id === selectedId)) {
          setSelectedId(null)
          setEvents([])
        }
      })
      .catch((loadError) => {
        if (active && !controller.signal.aborted) setError(errorText(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [canReviewAllRequests, dateFrom, dateTo, page, priorityFilter, refreshKey, requesterFilter, selectedId, showCleared, statusFilter, typeFilter])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    let active = true
    setDetailLoading(true)
    getOperationalRequest(selectedId, controller.signal)
      .then(({ request, events: requestEvents }) => {
        if (!active) return
        setRequests((current) => current.map((item) => item.id === request.id ? request : item))
        setEvents(requestEvents)
      })
      .catch((loadError) => {
        if (active && !controller.signal.aborted) setError(errorText(loadError))
      })
      .finally(() => {
        if (active) setDetailLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [selectedId, refreshKey])

  const updateForm = <K extends keyof CreateOperationalRequestPayload>(
    key: K,
    value: CreateOperationalRequestPayload[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  const resetComposer = () => {
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const created = await createOperationalRequest({
        ...form,
        resourceType: needsResource ? form.resourceType : undefined,
        resourceId: needsResource ? form.resourceId : undefined,
      })
      resetComposer()
      setPage(1)
      setSelectedId(created.id)
      setNotice('Request submitted for review.')
      refresh()
    } catch (submitError) {
      setError(errorText(submitError))
    } finally {
      setBusy(false)
    }
  }

  const submitDecision = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !decisionAction) return
    const reasonRequired = decisionAction === 'reject' || decisionAction === 'return-for-correction'
      || (decisionAction === 'cancel' && selected.requesterId !== user.id)
    if (reasonRequired && !decisionReason.trim()) {
      setError('A reason is required for this action.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateOperationalRequest(selected.id, decisionAction, decisionReason)
      setNotice(`${ACTION_LABELS[decisionAction]} recorded.`)
      setDecisionAction(null)
      setDecisionReason('')
      refresh()
    } catch (actionError) {
      setError(errorText(actionError))
    } finally {
      setBusy(false)
    }
  }

  const beginResubmit = () => {
    if (!selected) return
    setForm({
      requestType: selected.requestType,
      resourceType: selected.resourceType ?? undefined,
      resourceId: selected.resourceId ?? undefined,
      subject: selected.subject,
      reason: selected.reason,
      details: selected.details ?? '',
      priority: selected.priority,
    })
    setShowForm(true)
  }

  const submitResubmission = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await resubmitOperationalRequest(selected.id, {
        subject: form.subject,
        reason: form.reason,
        details: form.details,
        priority: form.priority,
      })
      resetComposer()
      setNotice('Corrected request resubmitted for review.')
      refresh()
    } catch (submitError) {
      setError(errorText(submitError))
    } finally {
      setBusy(false)
    }
  }

  const clearSelectedRequest = async () => {
    if (!selected || !canReviewAllRequests) return
    if (!window.confirm('Clear this completed request from the active request list? Its audit history will be retained.')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await archiveOperationalRequest(selected.id)
      setSelectedId(null)
      setEvents([])
      setNotice('Request cleared from the active list. Its audit history was retained.')
      refresh()
    } catch (archiveError) {
      setError(errorText(archiveError))
    } finally {
      setBusy(false)
    }
  }

  const composerIsCorrection = showForm && ownCorrection

  return (
    <div className="space-y-4" aria-label="Operational requests workspace">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase text-text-tertiary">Request and Approval</p>
          <h2 className="text-xl font-bold text-text-primary">Operational Requests</h2>
          <p className="mt-1 text-sm text-text-secondary">Service, resource custody, and firearm registration workflows.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} disabled={loading} className="soc-btn soc-btn-neutral min-h-11" title="Refresh requests">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          {canCreateRequest ? (
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_FORM)
                setSelectedId(null)
                setShowForm((visible) => !visible)
              }}
              disabled={busy}
              className="soc-btn soc-btn-primary min-h-11"
            >
              {showForm ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              {showForm ? 'Close' : 'New Request'}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div role="alert" className="rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">{error}</div> : null}
      {notice ? <div role="status" className="rounded border border-success-border bg-success-bg p-3 text-sm text-success-text">{notice}</div> : null}

      {showForm ? (
        <form onSubmit={composerIsCorrection ? submitResubmission : submitRequest} className="space-y-4 border-b border-border pb-5">
          <div className="flex items-center gap-2 text-text-primary">
            <FilePenLine className="h-5 w-5" aria-hidden="true" />
            <h3 className="font-semibold">{composerIsCorrection ? 'Correct and Resubmit' : 'Create Request'}</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-text-secondary">
              Request type
              <select
                value={form.requestType}
                disabled={composerIsCorrection}
                onChange={(event) => updateForm('requestType', event.target.value as OperationalRequestType)}
                className="mt-1 min-h-11 w-full rounded border border-border bg-background px-3 text-text-primary"
              >
                {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-text-secondary">
              Priority
              <select
                value={form.priority}
                onChange={(event) => updateForm('priority', event.target.value as OperationalRequestPriority)}
                className="mt-1 min-h-11 w-full rounded border border-border bg-background px-3 text-text-primary"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          {needsResource ? (
            <label className="block text-sm font-medium text-text-secondary">
              Assigned resource
              <select
                required
                value={form.resourceId ?? ''}
                disabled={composerIsCorrection}
                onChange={(event) => {
                  const resource = resources.find((item) => item.id === event.target.value)
                  updateForm('resourceId', resource?.id)
                  updateForm('resourceType', resource?.resourceType)
                }}
                className="mt-1 min-h-11 w-full rounded border border-border bg-background px-3 text-text-primary"
              >
                <option value="">Select an assigned resource</option>
                {resources.map((resource) => <option key={resource.id} value={resource.id}>{resourceLabel(resource)}</option>)}
              </select>
              {resources.length === 0 ? <span className="mt-1 block text-xs text-warning-text">No active firearm or equipment assignments are available.</span> : null}
            </label>
          ) : null}
          <label className="block text-sm font-medium text-text-secondary">
            Subject
            <input required maxLength={255} value={form.subject} onChange={(event) => updateForm('subject', event.target.value)} className="mt-1 min-h-11 w-full rounded border border-border bg-background px-3 text-text-primary" />
          </label>
          <label className="block text-sm font-medium text-text-secondary">
            Reason and purpose
            <textarea required maxLength={2000} rows={3} value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} className="mt-1 w-full rounded border border-border bg-background p-3 text-text-primary" />
          </label>
          <label className="block text-sm font-medium text-text-secondary">
            {form.requestType === 'firearm_registration' ? 'Firearm identifying details' : 'Additional details'}
            <textarea required={form.requestType === 'firearm_registration'} maxLength={4000} rows={3} value={form.details ?? ''} onChange={(event) => updateForm('details', event.target.value)} className="mt-1 w-full rounded border border-border bg-background p-3 text-text-primary" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetComposer} className="soc-btn soc-btn-neutral min-h-11">Cancel</button>
            <button type="submit" disabled={busy || (needsResource && !form.resourceId)} className="soc-btn soc-btn-primary min-h-11 disabled:opacity-50">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : composerIsCorrection ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
              {composerIsCorrection ? 'Resubmit' : 'Submit for Review'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-3" aria-label="Request filters">
        <label className="text-xs font-semibold uppercase text-text-tertiary">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OperationalRequestStatus | 'all')} className="ml-2 min-h-11 rounded border border-border bg-background px-3 text-sm normal-case text-text-primary">
            <option value="all">All statuses</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase text-text-tertiary">
          Priority
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as OperationalRequestPriority | 'all')} className="ml-2 min-h-11 rounded border border-border bg-background px-3 text-sm normal-case text-text-primary">
            <option value="all">All priorities</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        {canReviewAllRequests ? (
          <label className="text-xs font-semibold uppercase text-text-tertiary">
            Requester
            <input value={requesterFilter} onChange={(event) => setRequesterFilter(event.target.value)} placeholder="Name, username, or email" className="ml-2 min-h-11 rounded border border-border bg-background px-3 text-sm normal-case text-text-primary" />
          </label>
        ) : null}
        {canReviewAllRequests ? (
          <label className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase text-text-tertiary">
            <input type="checkbox" checked={showCleared} onChange={(event) => setShowCleared(event.target.checked)} className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-focus" />
            Show cleared
          </label>
        ) : null}
        <label className="text-xs font-semibold uppercase text-text-tertiary">
          From
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="ml-2 min-h-11 rounded border border-border bg-background px-3 text-sm normal-case text-text-primary" />
        </label>
        <label className="text-xs font-semibold uppercase text-text-tertiary">
          To
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="ml-2 min-h-11 rounded border border-border bg-background px-3 text-sm normal-case text-text-primary" />
        </label>
        <label className="text-xs font-semibold uppercase text-text-tertiary">
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as OperationalRequestType | 'all')} className="ml-2 min-h-11 rounded border border-border bg-background px-3 text-sm normal-case text-text-primary">
            <option value="all">All types</option>
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <section className="overflow-hidden rounded border border-border bg-surface" aria-label="Request list">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-text-secondary" role="status"><LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />Loading requests</div>
          ) : requests.length === 0 ? (
            <div className="min-h-40 p-8 text-center text-sm text-text-secondary">No requests match the selected filters.</div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {requests.map((request) => (
                <li key={request.id}>
                  <button type="button" disabled={busy} onClick={() => { setShowForm(false); setSelectedId(request.id) }} className={`min-h-20 w-full p-4 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedId === request.id ? 'bg-surface-elevated' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary">{request.subject}</p>
                        <p className="mt-1 text-xs text-text-secondary">{REQUEST_TYPE_LABELS[request.requestType]} · {request.requesterName}</p>
                      </div>
                      <span className={`rounded border px-2 py-1 text-xs font-semibold ${STATUS_TONE[request.status]}`}>{REQUEST_STATUS_LABELS[request.status]}</span>
                    </div>
                    <p className="mt-2 text-xs text-text-tertiary">{request.priority.toUpperCase()} · {new Date(request.createdAt).toLocaleString()}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="Request pagination" className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
            <span className="text-sm text-text-secondary">Page {page} of {pageCount} ({total} requests)</span>
            <div className="flex gap-2">
              <button type="button" title="Previous request page" aria-label="Previous request page" disabled={loading || busy || page <= 1} onClick={() => { setSelectedId(null); setPage((current) => current - 1) }} className="soc-btn soc-btn-neutral h-11 w-11 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" title="Next request page" aria-label="Next request page" disabled={loading || busy || page >= pageCount} onClick={() => { setSelectedId(null); setPage((current) => current + 1) }} className="soc-btn soc-btn-neutral h-11 w-11 disabled:opacity-50">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </nav>
        </section>

        <section className="rounded border border-border bg-surface p-4" aria-label="Selected request details">
          {!selected ? (
            <div className="flex min-h-40 items-center justify-center text-center text-sm text-text-secondary">Select a request to review its details and history.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-bold text-text-primary">{selected.subject}</h3>
                  <span className={`rounded border px-2 py-1 text-xs font-semibold ${STATUS_TONE[selected.status]}`}>{REQUEST_STATUS_LABELS[selected.status]}</span>
                </div>
                <p className="mt-1 text-xs text-text-tertiary">Requested by {selected.requesterName}</p>
                {selected.archivedAt ? <p className="mt-2 text-xs font-semibold text-warning-text">Cleared from active requests on {new Date(selected.archivedAt).toLocaleString()}</p> : null}
              </div>
              <dl className="grid gap-3 text-sm">
                <div><dt className="text-xs font-semibold uppercase text-text-tertiary">Reason</dt><dd className="mt-1 whitespace-pre-wrap text-text-primary">{selected.reason}</dd></div>
                {selected.details ? <div><dt className="text-xs font-semibold uppercase text-text-tertiary">Details</dt><dd className="mt-1 whitespace-pre-wrap text-text-primary">{selected.details}</dd></div> : null}
                {selected.resourceId ? <div><dt className="text-xs font-semibold uppercase text-text-tertiary">Resource</dt><dd className="mt-1 break-all text-text-primary">{selected.resourceType?.replace('_', ' ')} · {selected.resourceId}</dd></div> : null}
                {selected.clientSiteId ? <div><dt className="text-xs font-semibold uppercase text-text-tertiary">Client site</dt><dd className="mt-1 break-all text-text-primary">{selected.clientSiteId}</dd></div> : null}
                {selected.shiftId ? <div><dt className="text-xs font-semibold uppercase text-text-tertiary">Related shift</dt><dd className="mt-1 break-all text-text-primary">{selected.shiftId}</dd></div> : null}
                {selected.decisionReason ? <div><dt className="text-xs font-semibold uppercase text-text-tertiary">Decision note</dt><dd className="mt-1 whitespace-pre-wrap text-text-primary">{selected.decisionReason}</dd></div> : null}
              </dl>

              {ownCorrection ? (
                <button type="button" onClick={beginResubmit} className="soc-btn soc-btn-primary min-h-11 w-full"><RotateCcw className="h-4 w-4" aria-hidden="true" />Correct and Resubmit</button>
              ) : null}

              {selected.status === 'pending' && selected.requesterId === user.id ? (
                <div role="status" className="rounded border border-info-border bg-info-bg p-3 text-sm text-info-text">
                  You submitted this request. Review actions are available to an administrator or superadmin. You will receive an inbox notification when the request is approved or denied.
                </div>
              ) : null}

              {requestActions(selected, user).length > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {requestActions(selected, user).map((action) => (
                    <button key={action} type="button" disabled={busy} onClick={() => { setDecisionAction(action); setDecisionReason(''); setError('') }} className={`soc-btn min-h-11 ${action === 'approve' || action === 'complete' ? 'soc-btn-success' : action === 'reject' || action === 'cancel' ? 'soc-btn-danger' : 'soc-btn-neutral'}`}>
                      {action === 'approve' ? <Check className="h-4 w-4" aria-hidden="true" /> : action === 'complete' ? <PackageCheck className="h-4 w-4" aria-hidden="true" /> : <FilePenLine className="h-4 w-4" aria-hidden="true" />}
                      {ACTION_LABELS[action]}
                    </button>
                  ))}
                </div>
              ) : null}

              {canReviewAllRequests && !selected.archivedAt && ['approved', 'rejected', 'completed', 'cancelled'].includes(selected.status) ? (
                <button type="button" disabled={busy} onClick={() => void clearSelectedRequest()} className="soc-btn soc-btn-neutral min-h-11 w-full">
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  Clear Request
                </button>
              ) : null}

              {decisionAction ? (
                <form onSubmit={submitDecision} className="space-y-3 rounded border border-border bg-background p-3">
                  <label className="block text-sm font-medium text-text-secondary">
                    {ACTION_LABELS[decisionAction]} note
                    <textarea autoFocus rows={3} maxLength={2000} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} className="mt-1 w-full rounded border border-border bg-surface p-3 text-text-primary" placeholder={decisionAction === 'reject' || decisionAction === 'return-for-correction' ? 'Required reason' : 'Optional note'} />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setDecisionAction(null)} className="soc-btn soc-btn-neutral min-h-11">Back</button>
                    <button type="submit" disabled={busy} className="soc-btn soc-btn-primary min-h-11 disabled:opacity-50">Confirm</button>
                  </div>
                </form>
              ) : null}

              <div className="border-t border-border pt-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Clock3 className="h-4 w-4" aria-hidden="true" />Request History</h4>
                {detailLoading ? <p className="mt-3 text-sm text-text-secondary">Loading history...</p> : (
                  <ol className="mt-3 space-y-3">
                    {events.map((entry) => (
                      <li key={entry.id} className="border-l-2 border-info pl-3 text-sm">
                        <p className="font-medium text-text-primary">{REQUEST_STATUS_LABELS[entry.toStatus]}</p>
                        <p className="text-xs text-text-tertiary">{entry.actorName ?? 'System'} · {new Date(entry.createdAt).toLocaleString()}</p>
                        {entry.comment ? <p className="mt-1 whitespace-pre-wrap text-text-secondary">{entry.comment}</p> : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
