import React, { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import type { User } from '../context/AuthContext'
import type { InboxItem } from './inbox/ActionInbox'
import { fetchRoleInboxSummary } from './inbox/roleInboxSummary'

interface NotificationPanelProps {
  user?: User | null
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onViewAll?: () => void
}

const FALLBACK_ITEM_TITLE = 'Inbox Update'
const FALLBACK_ITEM_DESCRIPTION = 'Additional details unavailable.'
const FALLBACK_ITEM_TIMESTAMP = () => new Date().toISOString()

function isInboxPriority(value: unknown): value is InboxItem['priority'] {
  return value === 'urgent' || value === 'high' || value === 'normal' || value === 'low'
}

function isInboxCategory(value: unknown): value is InboxItem['category'] {
  return value === 'approval' || value === 'incident' || value === 'shift' || value === 'notification' || value === 'mission'
}

function sanitizeInboxItem(item: Partial<InboxItem> | null | undefined, index: number): InboxItem | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `quick-inbox-item-${index}`
  const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : FALLBACK_ITEM_TITLE
  const description = typeof item.description === 'string' && item.description.trim() ? item.description.trim() : FALLBACK_ITEM_DESCRIPTION
  const timestampCandidate = typeof item.timestamp === 'string' && item.timestamp.trim() ? item.timestamp.trim() : FALLBACK_ITEM_TIMESTAMP()
  const timestamp = Number.isNaN(new Date(timestampCandidate).getTime()) ? FALLBACK_ITEM_TIMESTAMP() : timestampCandidate

  return {
    ...item,
    id,
    title,
    description,
    timestamp,
    priority: isInboxPriority(item.priority) ? item.priority : 'normal',
    category: isInboxCategory(item.category) ? item.category : 'notification',
    isRead: Boolean(item.isRead),
  }
}

function sanitizeInboxItems(items: InboxItem[]): InboxItem[] {
  return items
    .map((item, index) => sanitizeInboxItem(item, index))
    .filter((item): item is InboxItem => item !== null)
}

function formatTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays}d ago`
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ user, isOpen, onToggle, onClose, onViewAll }) => {
  const [items, setItems] = useState<InboxItem[]>([])
  const [actionableCount, setActionableCount] = useState(0)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [panelError, setPanelError] = useState('')
  const resolvedUserId = typeof user?.id === 'string' ? user.id : ''
  const resolvedUserRole = typeof user?.role === 'string' ? user.role : ''

  useEffect(() => {
    let cancelled = false

    const loadSummary = async () => {
      if (!resolvedUserId || !resolvedUserRole) {
        setItems([])
        setActionableCount(0)
        setNotice('')
        setPanelError('')
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const summary = await fetchRoleInboxSummary(resolvedUserId, resolvedUserRole)

        if (cancelled) return

        const sanitizedItems = sanitizeInboxItems(summary.items)

        setItems(sanitizedItems)
        setActionableCount(sanitizedItems.length)
        setNotice(typeof summary.notice === 'string' ? summary.notice : '')
        setPanelError(summary.hasError ? 'Unable to load inbox data. Please check your connection and try again.' : '')
      } catch {
        if (cancelled) return

        setItems([])
        setActionableCount(0)
        setNotice('')
        setPanelError('Unable to load inbox data. Please check your connection and try again.')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSummary()
    const intervalId = window.setInterval(() => {
      void loadSummary()
    }, 30000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [resolvedUserId, resolvedUserRole])

  const topItems = useMemo(() => items.slice(0, 4), [items])

  return (
    <div className="relative z-[var(--z-floating)]">
      <button
        type="button"
        onClick={onToggle}
        className="soc-notification-trigger relative min-h-11 min-w-11 rounded p-2 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
        aria-label={actionableCount > 0 ? `Open quick inbox (${actionableCount} items)` : 'Open quick inbox'}
        aria-expanded={isOpen}
        aria-controls="quick-inbox-panel"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {actionableCount > 0 ? (
          <span className="absolute right-0 top-0 inline-flex translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-xs font-bold leading-none text-white">
            {actionableCount > 99 ? '99+' : actionableCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div id="quick-inbox-panel" className="soc-dropdown-surface absolute right-0 z-[var(--z-floating)] mt-2 flex max-h-[min(36rem,calc(100dvh-6rem))] w-[min(26rem,calc(100vw-1rem))] flex-col rounded" role="dialog" aria-label="Quick inbox">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Global Actions</p>
              <h3 className="text-base font-semibold text-text-primary">Quick Inbox</h3>
            </div>
            <button type="button" onClick={onClose} className="min-h-11 rounded border border-border bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover">
              Close
            </button>
          </div>

          {notice ? (
            <div className="border-b border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text" role="status" aria-live="polite">
              {notice}
            </div>
          ) : null}

          {panelError ? (
            <div className="border-b border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text" role="alert">
              {panelError}
            </div>
          ) : null}

          <div className="soc-scroll-area flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4" role="status" aria-label="Loading quick inbox">
                <div className="h-20 animate-pulse rounded bg-surface-elevated" />
                <div className="h-20 animate-pulse rounded bg-surface-elevated" />
              </div>
            ) : topItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">No urgent inbox items right now.</div>
            ) : (
              <ul className="divide-y divide-border-subtle" role="list">
                {topItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={onViewAll}
                      className="w-full px-4 py-4 text-left transition-colors hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--color-focus-ring)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                          <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                        </div>
                        <span className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-text-tertiary">{formatTime(item.timestamp)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-4">
            <button type="button" onClick={onViewAll} className="w-full min-h-11 rounded border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover">
              View Full Inbox
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default NotificationPanel
