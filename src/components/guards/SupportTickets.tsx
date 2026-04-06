import { FC, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthToken } from '../../utils/api'
import { sanitizeErrorMessage } from '../../utils/sanitize'
import DashboardCard from '../dashboard/ui/DashboardCard'
import SectionHeader from '../dashboard/ui/SectionHeader'
import EmptyState from '../shared/EmptyState'

interface SupportTicket {
  id: string
  guard_id: string
  subject: string
  message: string
  status: string
  created_at: string
  updated_at?: string
}

interface TicketListResponse {
  total: number
  tickets: SupportTicket[]
}

interface CreateTicketResponse {
  message: string
  ticketId: string
}

interface SupportTicketsProps {
  userId: string
}

const CATEGORIES = ['Equipment', 'Schedule', 'Safety', 'General', 'Other'] as const
type Category = (typeof CATEGORIES)[number]

function statusBadgeClasses(status: string): string {
  const s = status.toLowerCase()
  if (s === 'open' || s === 'submitted') {
    return 'bg-warning-bg text-warning-text border border-warning-border'
  }
  if (s === 'in_progress') {
    return 'bg-info-bg text-info-text border border-info-border'
  }
  if (s === 'resolved') {
    return 'bg-success-bg text-success-text border border-success-border'
  }
  return 'bg-surface-elevated text-text-tertiary border border-border-subtle'
}

function statusLabel(status: string): string {
  const s = status.toLowerCase()
  if (s === 'in_progress') return 'In Progress'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function truncateMessage(msg: string, max = 80): string {
  if (msg.length <= max) return msg
  return msg.slice(0, max) + '...'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function extractCategory(subject: string): string | null {
  const match = subject.match(/^\[([^\]]+)\]\s*/)
  return match ? match[1] : null
}

function stripCategoryPrefix(subject: string): string {
  return subject.replace(/^\[[^\]]+\]\s*/, '')
}

function StatusTimeline({ status }: { status: string }) {
  const steps = ['Submitted', 'In Progress', 'Resolved']
  const s = status.toLowerCase()
  const activeIndex = s === 'resolved' || s === 'closed' ? 2 : s === 'in_progress' ? 1 : 0

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-text-primary mb-3">Status Timeline</h4>
      <ol className="relative ml-3 border-l-2 border-border-subtle" aria-label="Ticket status timeline">
        {steps.map((step, i) => {
          const active = i <= activeIndex
          return (
            <li key={step} className="mb-4 ml-4 last:mb-0">
              <div
                className={`absolute -left-[9px] h-4 w-4 rounded-full border-2 ${
                  active ? 'border-success-text bg-success-bg' : 'border-border-subtle bg-surface'
                }`}
                aria-hidden="true"
              />
              <p className={`text-sm font-medium ${active ? 'text-text-primary' : 'text-text-tertiary'}`}>
                {step}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const SupportTickets: FC<SupportTicketsProps> = ({ userId }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)

  const [category, setCategory] = useState<Category | ''>('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [touched, setTouched] = useState({ category: false, subject: false, description: false })

  const listRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const fetchTickets = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const token = getAuthToken()
      const data = await fetchJsonOrThrow<TicketListResponse>(
        `${API_BASE_URL}/api/support-tickets/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          signal,
        },
        'Unable to load support tickets',
      )
      setTickets(Array.isArray(data.tickets) ? data.tickets : [])
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(sanitizeErrorMessage(err instanceof Error ? err.message : 'Failed to load tickets.'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    const controller = new AbortController()
    fetchTickets(controller.signal)
    return () => controller.abort()
  }, [fetchTickets])

  const categoryInvalid = touched.category && !category
  const subjectInvalid = touched.subject && !subject.trim()
  const descriptionInvalid = touched.description && description.trim().length < 10

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched({ category: true, subject: true, description: true })

    if (!category || !subject.trim() || description.trim().length < 10) return

    setSubmitting(true)
    setSubmitError('')
    setSubmitSuccess('')

    const formattedSubject = `[${category}] ${subject.trim()}`

    try {
      const token = getAuthToken()
      await fetchJsonOrThrow<CreateTicketResponse>(
        `${API_BASE_URL}/api/support-tickets`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ guard_id: userId, subject: formattedSubject, message: description.trim() }),
        },
        'Failed to create support ticket',
      )

      setSubmitSuccess('Ticket submitted successfully.')
      setCategory('')
      setSubject('')
      setDescription('')
      setTouched({ category: false, subject: false, description: false })

      await fetchTickets()
      setView('list')
      requestAnimationFrame(() => listRef.current?.focus())
    } catch (err) {
      setSubmitError(sanitizeErrorMessage(err instanceof Error ? err.message : 'Failed to submit ticket.'))
    } finally {
      setSubmitting(false)
    }
  }

  const switchToCreate = () => {
    setSubmitError('')
    setSubmitSuccess('')
    setView('create')
  }

  const switchToList = () => {
    setSubmitError('')
    setSubmitSuccess('')
    setSelectedTicket(null)
    setView('list')
  }

  const switchToDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setView('detail')
    requestAnimationFrame(() => detailRef.current?.focus())
  }

  return (
    <div className="guard-section-frame">
      <SectionHeader
        title="Support Tickets"
        subtitle="Submit and track support requests"
        actions={
          view === 'list' ? (
            <button
              type="button"
              onClick={switchToCreate}
              className="min-h-11 rounded-lg bg-info px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info/90"
            >
              New Ticket
            </button>
          ) : (
            <button
              type="button"
              onClick={switchToList}
              className="min-h-11 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
            >
              Back to List
            </button>
          )
        }
      />

      {view === 'detail' && selectedTicket ? (
        <div ref={detailRef} tabIndex={-1} aria-label="Ticket detail">
          <button
            type="button"
            onClick={switchToList}
            className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to tickets
          </button>

          <DashboardCard>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {extractCategory(selectedTicket.subject) && (
                  <span className="rounded-lg border border-border-subtle bg-surface px-2 py-0.5 text-xs text-text-secondary">
                    {extractCategory(selectedTicket.subject)}
                  </span>
                )}
                <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(selectedTicket.status)}`}>
                  {statusLabel(selectedTicket.status)}
                </span>
              </div>

              <h3 className="text-base font-semibold text-text-primary">
                {stripCategoryPrefix(selectedTicket.subject)}
              </h3>

              <p className="text-sm text-text-secondary whitespace-pre-wrap">{selectedTicket.message}</p>

              <div className="flex flex-wrap gap-4 text-xs text-text-tertiary">
                <span>Created: {formatDate(selectedTicket.created_at)}</span>
                {selectedTicket.updated_at && selectedTicket.updated_at !== selectedTicket.created_at && (
                  <span>Updated: {formatDate(selectedTicket.updated_at)}</span>
                )}
              </div>

              {selectedTicket.status.toLowerCase() === 'resolved' && (
                <div className="rounded-lg border border-success-border bg-success-bg px-4 py-2 text-sm text-success-text" role="status">
                  This ticket has been resolved.
                </div>
              )}

              <StatusTimeline status={selectedTicket.status} />
            </div>
          </DashboardCard>
        </div>
      ) : view === 'list' ? (
        <div ref={listRef} tabIndex={-1} aria-label="Ticket list">
          {submitSuccess && (
            <div className="mb-4 rounded-lg border border-success-border bg-success-bg px-4 py-2 text-sm text-success-text" role="status">
              {submitSuccess}
            </div>
          )}

          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading tickets">
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-border-subtle bg-surface-elevated p-4">
                  <div className="mb-2 h-4 w-2/3 rounded bg-border-subtle" />
                  <div className="mb-2 h-3 w-full rounded bg-border-subtle" />
                  <div className="h-3 w-1/4 rounded bg-border-subtle" />
                </div>
              ))}
            </div>
          ) : error ? (
            <DashboardCard>
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-danger">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchTickets()}
                  className="min-h-11 rounded-lg bg-info px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info/90"
                >
                  Retry
                </button>
              </div>
            </DashboardCard>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No support tickets"
              subtitle="Need help? Create a ticket below."
              actionLabel="Create Ticket"
              onAction={switchToCreate}
            />
          ) : (
            <ul className="space-y-3" role="list">
              {tickets.map((ticket) => {
                const cat = extractCategory(ticket.subject)
                const displaySubject = stripCategoryPrefix(ticket.subject)
                return (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => switchToDetail(ticket)}
                      className="w-full cursor-pointer rounded-xl border border-border-subtle bg-surface-elevated p-4 text-left transition-colors hover:bg-surface"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-text-primary">{displaySubject}</h3>
                        {cat && (
                          <span className="rounded-lg border border-border-subtle bg-surface px-2 py-0.5 text-xs text-text-secondary">
                            {cat}
                          </span>
                        )}
                        <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${statusBadgeClasses(ticket.status)}`}>
                          {statusLabel(ticket.status)}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary">{truncateMessage(ticket.message)}</p>
                      <p className="mt-2 text-xs text-text-tertiary">{formatDate(ticket.created_at)}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : (
        <DashboardCard title="Create Support Ticket">
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {submitError && (
                <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-2 text-sm text-danger-text" role="alert">
                  {submitError}
                </div>
              )}

              <div>
                <label htmlFor="ticket-category" className="mb-1 block text-sm font-semibold text-text-primary">
                  Category <span aria-hidden="true">*</span>
                </label>
                <select
                  id="ticket-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  onBlur={() => setTouched((p) => ({ ...p, category: true }))}
                  aria-required="true"
                  aria-invalid={categoryInvalid || undefined}
                  aria-describedby={categoryInvalid ? 'category-error' : undefined}
                  className={`min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text-primary transition-colors ${categoryInvalid ? 'border-danger-border' : 'border-border'}`}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {categoryInvalid && (
                  <p id="category-error" className="mt-1 text-xs text-danger">Please select a category.</p>
                )}
              </div>

              <div>
                <label htmlFor="ticket-subject" className="mb-1 block text-sm font-semibold text-text-primary">
                  Subject <span aria-hidden="true">*</span>
                </label>
                <input
                  id="ticket-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, subject: true }))}
                  aria-required="true"
                  aria-invalid={subjectInvalid || undefined}
                  aria-describedby={subjectInvalid ? 'subject-error' : undefined}
                  className={`min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text-primary transition-colors ${subjectInvalid ? 'border-danger-border' : 'border-border'}`}
                />
                {subjectInvalid && (
                  <p id="subject-error" className="mt-1 text-xs text-danger">Subject is required.</p>
                )}
              </div>

              <div>
                <label htmlFor="ticket-description" className="mb-1 block text-sm font-semibold text-text-primary">
                  Description <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="ticket-description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, description: true }))}
                  aria-required="true"
                  aria-invalid={descriptionInvalid || undefined}
                  aria-describedby={descriptionInvalid ? 'description-error' : undefined}
                  className={`min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text-primary transition-colors ${descriptionInvalid ? 'border-danger-border' : 'border-border'}`}
                />
                {descriptionInvalid && (
                  <p id="description-error" className="mt-1 text-xs text-danger">Description must be at least 10 characters.</p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 rounded-lg bg-info px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-info/90 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
                <button
                  type="button"
                  onClick={switchToList}
                  disabled={submitting}
                  className="min-h-11 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </DashboardCard>
      )}
    </div>
  )
}

export default SupportTickets
