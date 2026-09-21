import React, { useEffect, useMemo, useState } from 'react'
import { Bell, CheckCheck, MailOpen } from 'lucide-react'
import { API_BASE_URL } from '../config'
import type { User } from '../context/AuthContext'
import type { InboxItem } from './inbox/ActionInbox'
import { fetchRoleInboxSummary } from './inbox/roleInboxSummary'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { formatInboxTimestamp } from './inbox/inboxFormatting'

interface NotificationPanelProps {
  user?: User | null
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onViewAll?: () => void
}

interface PersistentNotificationPayload {
  id: string
  title: string
  message: string
  type?: string
  read?: boolean
  is_read?: boolean
  createdAt?: string
  created_at?: string
}

type PersistentNotification = PersistentNotificationPayload & {
  read: boolean
  createdAt: string
}

interface NotificationResponse {
  notifications?: PersistentNotificationPayload[]
  unreadCount?: number
}

const FALLBACK_ITEM_TITLE = 'Inbox Update'
const FALLBACK_ITEM_DESCRIPTION = 'Additional details unavailable.'
const FALLBACK_ITEM_TIMESTAMP = () => new Date().toISOString()

function isInboxPriority(value: unknown): value is InboxItem['priority'] {
  return value === 'urgent' || value === 'high' || value === 'normal' || value === 'low'
}

function isInboxCategory(value: unknown): value is InboxItem['category'] {
  return value === 'approval'
    || value === 'incident'
    || value === 'shift'
    || value === 'notification'
    || value === 'mission'
    || value === 'request'
    || value === 'firearm'
    || value === 'compliance'
}

const PRIORITY_BADGE_CLASS: Record<InboxItem['priority'], string> = {
  urgent: 'soc-status-danger',
  high: 'soc-status-warning',
  normal: 'soc-status-success',
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

function normalizePersistentNotification(notification: PersistentNotificationPayload): PersistentNotification {
  return {
    ...notification,
    read: notification.read ?? notification.is_read ?? false,
    createdAt: notification.createdAt ?? notification.created_at ?? FALLBACK_ITEM_TIMESTAMP(),
  }
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ user, isOpen, onToggle, onClose, onViewAll }) => {
  const [items, setItems] = useState<InboxItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [panelError, setPanelError] = useState('')
  const [notifications, setNotifications] = useState<PersistentNotification[]>([])
  const [notificationBusy, setNotificationBusy] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const resolvedUserId = typeof user?.id === 'string' ? user.id : ''
  const resolvedUserRole = typeof user?.role === 'string' ? user.role : ''

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    const loadSummary = async () => {
      if (!resolvedUserId || !resolvedUserRole) {
        setItems([])
        setUnreadCount(0)
        setNotice('')
        setPanelError('')
        setNotifications([])
        setNotificationError('')
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const [summaryResult, notificationResult] = await Promise.allSettled([
          fetchRoleInboxSummary(resolvedUserId, resolvedUserRole),
          fetchJsonOrThrow<NotificationResponse>(
            `${API_BASE_URL}/api/users/${encodeURIComponent(resolvedUserId)}/notifications`,
            { headers: getAuthHeaders(), signal: controller.signal },
            'Unable to load notifications.',
          ),
        ])

        if (cancelled) return

        if (summaryResult.status === 'fulfilled') {
          const sanitizedItems = sanitizeInboxItems(summaryResult.value.items)
          setItems(sanitizedItems)
          setNotice(typeof summaryResult.value.notice === 'string' ? summaryResult.value.notice : '')
          setPanelError(summaryResult.value.hasError ? 'Unable to load inbox data. Please check your connection and try again.' : '')
        } else {
          setItems([])
          setNotice('')
          setPanelError('Unable to load inbox data. Please check your connection and try again.')
        }

        if (notificationResult.status === 'fulfilled') {
          const nextNotifications = (notificationResult.value.notifications ?? []).map(normalizePersistentNotification)
          setNotifications(nextNotifications)
          setUnreadCount(
            typeof notificationResult.value.unreadCount === 'number'
              ? notificationResult.value.unreadCount
              : nextNotifications.filter((notification) => !notification.read).length,
          )
          setNotificationError('')
        } else {
          setNotificationError('Unable to load notifications.')
        }
      } catch {
        if (cancelled) return

        setItems([])
          setUnreadCount(0)
        setNotice('')
        setPanelError('Unable to load inbox data. Please check your connection and try again.')
        if (!cancelled) setNotificationError('Unable to load notifications.')
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
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [refreshKey, resolvedUserId, resolvedUserRole])

  const topItems = useMemo(() => items.filter((item) => item.category !== 'notification' && item.category !== 'compliance').slice(0, 4), [items])

  const setNotificationReadState = async (notificationId: string, read: boolean) => {
    setNotificationBusy(true)
    setNotificationError('')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/notifications/${encodeURIComponent(notificationId)}/${read ? 'read' : 'unread'}`,
        { method: 'PUT', headers: getAuthHeaders() },
        `Unable to mark notification as ${read ? 'read' : 'unread'}.`,
      )
      setNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, read } : notification))
      setUnreadCount((current) => Math.max(0, current + (read ? -1 : 1)))
      setRefreshKey((value) => value + 1)
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to update notification.')
    } finally {
      setNotificationBusy(false)
    }
  }

  const setAllNotificationsReadState = async (read: boolean) => {
    setNotificationBusy(true)
    setNotificationError('')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/users/${encodeURIComponent(resolvedUserId)}/notifications/mark-all-${read ? 'read' : 'unread'}`,
        { method: 'PUT', headers: getAuthHeaders() },
        `Unable to mark all notifications as ${read ? 'read' : 'unread'}.`,
      )
      setNotifications((current) => current.map((notification) => ({ ...notification, read })))
      setUnreadCount(read ? 0 : notifications.length)
      setRefreshKey((value) => value + 1)
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to update notifications.')
    } finally {
      setNotificationBusy(false)
    }
  }

  return (
    <div className="relative z-(--z-floating)">
      <button
        type="button"
        onClick={onToggle}
        className="soc-notification-trigger relative min-h-11 min-w-11 rounded p-2 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
        aria-label={unreadCount > 0 ? `Open quick inbox (${unreadCount} unread notifications)` : 'Open quick inbox'}
        aria-expanded={isOpen}
        aria-controls="quick-inbox-panel"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute right-0 top-0 inline-flex translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-xs font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div id="quick-inbox-panel" className="soc-dropdown-surface absolute right-0 z-(--z-floating) mt-2 flex max-h-[min(36rem,calc(100dvh-6rem))] w-[min(26rem,calc(100vw-1rem))] flex-col rounded" role="dialog" aria-label="Quick inbox">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Notifications</p>
              <h3 className="text-base font-semibold text-text-primary">{unreadCount} unread</h3>
            </div>
            <button type="button" onClick={onClose} className="soc-btn-neutral">
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

          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Notification controls</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={notificationBusy || unreadCount === 0} onClick={() => void setAllNotificationsReadState(true)} className="soc-btn soc-btn-neutral min-h-9 px-2 text-xs disabled:opacity-50" title="Mark all notifications as read">
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark all as read
                </button>
              </div>
            </div>
            {notificationError ? <p className="mt-2 text-xs text-danger-text" role="alert">{notificationError}</p> : null}
          </div>

          <div className="soc-scroll-area flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4" role="status" aria-label="Loading quick inbox">
                <div className="h-20 animate-pulse rounded bg-surface-elevated" />
                <div className="h-20 animate-pulse rounded bg-surface-elevated" />
              </div>
            ) : topItems.length > 0 ? (
              <section aria-label="Needs attention">
                <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Needs attention</p>
              <ul className="divide-y divide-border-subtle" role="list">
                {topItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={onViewAll}
                      className="w-full px-4 py-4 text-left transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--color-focus-ring)"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                          <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                        </div>
                        <span className={PRIORITY_BADGE_CLASS[item.priority]}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-text-tertiary">{formatInboxTimestamp(item.timestamp)}</p>
                    </button>
                  </li>
                ))}
              </ul>
              </section>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">No unread notifications.</div>
            ) : null}

            {!loading && notifications.length > 0 ? (
              <section className="border-t border-border" aria-label="Notification list">
                <ul className="divide-y divide-border-subtle" role="list">
                  {notifications.map((notification) => (
                    <li key={notification.id} className={`flex items-start gap-3 px-4 py-3 ${notification.read ? 'bg-surface' : 'bg-primary/5'}`}>
                      {notification.read ? <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" /> : <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm text-text-primary ${notification.read ? '' : 'font-semibold'}`}>{notification.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">{notification.message}</p>
                        <p className="mt-1 text-xs text-text-tertiary">{formatInboxTimestamp(notification.createdAt)}</p>
                      </div>
                      <button type="button" disabled={notificationBusy} onClick={() => void setNotificationReadState(notification.id, !notification.read)} className="soc-btn soc-btn-neutral min-h-9 shrink-0 px-2 text-xs disabled:opacity-50" title={notification.read ? 'Mark notification as unread' : 'Mark notification as read'}>
                        {notification.read ? 'Unread' : 'Read'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="border-t border-border px-4 py-4">
            <button type="button" onClick={onViewAll} className="soc-btn-neutral w-full">
              View Full Inbox
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default NotificationPanel
