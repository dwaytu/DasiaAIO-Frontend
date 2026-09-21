import { Bell, CheckCircle2, Circle, FileText, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { ActionInbox, type InboxCategory, type InboxItem } from './ActionInbox'
import { formatInboxTimestamp, getComplianceExpiryLabel } from './inboxFormatting'

type TriageFilter = 'all' | 'unread' | 'incident' | 'compliance' | 'request'

type NotificationTriageProps = {
  items: InboxItem[]
  isLoading?: boolean
  emptyMessage: string
}

const FILTERS: Array<{ id: TriageFilter; label: string; category?: InboxCategory }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'incident', label: 'Incidents', category: 'incident' },
  { id: 'compliance', label: 'Compliance', category: 'compliance' },
  { id: 'request', label: 'Requests', category: 'request' },
]

const PRIORITY_LABEL: Record<InboxItem['priority'], string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Routine',
}

const PRIORITY_BADGE_CLASS: Record<InboxItem['priority'], string> = {
  urgent: 'soc-status-danger',
  high: 'soc-status-warning',
  normal: 'soc-status-success',
}

function itemMatchesFilter(item: InboxItem, filter: TriageFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'unread') return item.notificationId !== undefined && !item.isRead
  return item.category === filter
}

export function NotificationTriage({ items, isLoading = false, emptyMessage }: NotificationTriageProps) {
  const [filter, setFilter] = useState<TriageFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>({})
  const [readBusy, setReadBusy] = useState(false)
  const [readError, setReadError] = useState('')

  const resolvedItems = useMemo(
    () => items.map((item) => item.notificationId && item.notificationId in readOverrides
      ? { ...item, isRead: readOverrides[item.notificationId] }
      : item),
    [items, readOverrides],
  )
  const availableFilters = useMemo(
    () => FILTERS.filter((entry) => entry.id === 'all'
      || entry.id === 'unread' && resolvedItems.some((item) => item.notificationId !== undefined)
      || entry.category && resolvedItems.some((item) => item.category === entry.category)),
    [resolvedItems],
  )
  const visibleItems = useMemo(
    () => resolvedItems.filter((item) => itemMatchesFilter(item, filter)),
    [filter, resolvedItems],
  )
  const selectedItem = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null

  useEffect(() => {
    if (!availableFilters.some((entry) => entry.id === filter)) setFilter('all')
  }, [availableFilters, filter])

  useEffect(() => {
    if (selectedItem && selectedItem.id !== selectedId) setSelectedId(selectedItem.id)
  }, [selectedId, selectedItem])

  const updateReadState = async (item: InboxItem, read: boolean) => {
    if (!item.notificationId || readBusy) return
    setReadBusy(true)
    setReadError('')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/notifications/${encodeURIComponent(item.notificationId)}/${read ? 'read' : 'unread'}`,
        { method: 'PUT', headers: getAuthHeaders() },
        'Unable to update notification status.',
      )
      setReadOverrides((current) => ({ ...current, [item.notificationId as string]: read }))
    } catch {
      setReadError('Unable to update this notification. Try again.')
    } finally {
      setReadBusy(false)
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="inbox-triage-title">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-tertiary">Notification center</p>
          <h2 id="inbox-triage-title" className="mt-1 text-xl font-bold text-text-primary">Review queue</h2>
          <p className="mt-1 text-sm text-text-secondary">Review the selected item and take the next relevant action. Items are ordered by priority, then most recent.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Inbox filters">
          {availableFilters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
              className={filter === entry.id ? 'soc-btn min-h-9 px-3 text-xs' : 'soc-btn-neutral min-h-9 px-3 text-xs'}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-[30rem] grid-cols-1 overflow-hidden rounded border border-border-subtle bg-surface lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)]">
        <div className="border-b border-border-subtle lg:border-b-0 lg:border-r">
          <ActionInbox
            items={visibleItems}
            isLoading={isLoading}
            emptyMessage={filter === 'all' ? emptyMessage : 'No notifications match the selected filters.'}
            onItemClick={(item) => setSelectedId(item.id)}
            selectedId={selectedItem?.id}
            showInlineActions={false}
            className="h-full rounded-none border-0 bg-transparent shadow-none"
          />
        </div>

        <aside className="bg-surface p-5" aria-live="polite" aria-label="Selected notification details">
          {selectedItem ? (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 rounded border border-border-subtle bg-surface-elevated p-2 text-text-secondary" aria-hidden="true">
                    {selectedItem.category === 'compliance' ? <ShieldAlert size={18} /> : selectedItem.category === 'request' ? <FileText size={18} /> : <Bell size={18} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">{selectedItem.category}</p>
                    <h3 className="mt-1 text-lg font-semibold text-text-primary">{selectedItem.title}</h3>
                  </div>
                </div>
                <span className={`${PRIORITY_BADGE_CLASS[selectedItem.priority]} shrink-0`}>{PRIORITY_LABEL[selectedItem.priority]}</span>
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Details</dt>
                  <dd className="mt-1 leading-6 text-text-primary">{selectedItem.description || 'No additional details were provided.'}</dd>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Received</dt>
                    <dd className="mt-1 text-text-primary">{formatInboxTimestamp(selectedItem.timestamp)}</dd>
                  </div>
                  {selectedItem.statusChip ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Status</dt>
                      <dd className="mt-1 text-text-primary">{selectedItem.statusChip.label}</dd>
                    </div>
                  ) : null}
                  {selectedItem.category === 'compliance' ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Compliance date</dt>
                      <dd className="mt-1 text-text-primary">{getComplianceExpiryLabel(selectedItem.title, selectedItem.description) ?? 'Not available'}</dd>
                    </div>
                  ) : null}
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                {selectedItem.actionLabel && selectedItem.onAction ? (
                  <button type="button" className="soc-btn" onClick={selectedItem.onAction}>
                    {selectedItem.actionLabel}
                  </button>
                ) : null}
                {selectedItem.notificationId ? (
                  <button
                    type="button"
                    disabled={readBusy}
                    onClick={() => void updateReadState(selectedItem, !selectedItem.isRead)}
                    className="soc-btn-neutral disabled:opacity-50"
                  >
                    {selectedItem.isRead ? <Circle size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
                    {selectedItem.isRead ? 'Mark as unread' : 'Mark as read'}
                  </button>
                ) : null}
              </div>
              {readError ? <p className="mt-3 text-sm text-danger-text" role="alert">{readError}</p> : null}
            </div>
          ) : (
            <div className="flex h-full min-h-52 flex-col items-center justify-center text-center">
              <Bell className="h-7 w-7 text-text-tertiary" aria-hidden="true" />
              <p className="mt-3 font-semibold text-text-primary">No notification selected</p>
              <p className="mt-1 max-w-sm text-sm text-text-secondary">Select an item from the list to review its details and available action.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
