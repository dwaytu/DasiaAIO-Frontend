import React, { useEffect, useState } from 'react'
import { API_BASE_URL } from '../../config'
import type { InboxItem } from './ActionInbox'
import { fetchArrayPayload } from './inboxPayloads'
import { NotificationTriage } from './NotificationTriage'
import { fetchOperationalRequestInboxItems } from './operationalRequestInbox'
import { parsePendingApprovalsPayload, type PendingApprovalRecord } from './pendingApprovals'
import { getNotificationCategory, getNotificationPriority } from './roleInboxSummary'
import { getAuthHeaders } from '../../utils/api'

interface Notification {
  id: string
  type?: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

type PendingApproval = PendingApprovalRecord

interface Incident {
  id: string
  title?: string
  description?: string
  severity?: string
  status: string
  created_at: string
}

export interface SuperadminInboxPanelProps {
  userId: string
  onAction?: (type: string, id: string) => void
}

const MS_48H = 48 * 3_600_000

export const SuperadminInboxPanel = ({ userId, onAction }: SuperadminInboxPanelProps): React.ReactElement => {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const headers = getAuthHeaders({ 'Content-Type': 'application/json' })

    const load = async () => {
      setLoading(true)
      const [notificationsResult, approvalsResult, incidentsResult, requestsResult] = await Promise.allSettled([
        fetchArrayPayload<Notification>(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/notifications`, headers, ['notifications'], controller.signal),
        fetch(`${API_BASE_URL}/api/users/pending-approvals`, { headers, signal: controller.signal })
          .then<unknown>((response) => response.ok ? response.json() : Promise.reject(response.status)),
        fetchArrayPayload<Incident>(`${API_BASE_URL}/api/incidents`, headers, ['incidents'], controller.signal),
        fetchOperationalRequestInboxItems(true, controller.signal, onAction),
      ])

      if (cancelled) return

      const notifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : []
      const approvals: PendingApproval[] = approvalsResult.status === 'fulfilled'
        ? parsePendingApprovalsPayload(approvalsResult.value)
        : []
      const incidents = incidentsResult.status === 'fulfilled' ? incidentsResult.value : []
      const requests = requestsResult.status === 'fulfilled' ? requestsResult.value : []
      const now = Date.now()

      const items: InboxItem[] = [
        ...requests,
        ...incidents
          .filter((incident) => incident.status !== 'closed' && incident.status !== 'resolved')
          .map((incident) => ({
            id: `incident-${incident.id}`,
            priority: 'urgent' as const,
            category: 'incident' as const,
            title: incident.title ?? 'Critical Incident Requires Review',
            description: incident.description ?? `Incident #${incident.id}`,
            timestamp: incident.created_at,
            actionLabel: 'Open map',
            onAction: () => onAction?.('incident-review', incident.id),
            statusChip: { label: incident.severity ?? 'Critical', tone: 'danger' as const },
          })),
        ...approvals.map((approval) => {
          const timestamp = approval.requested_at ?? approval.created_at ?? new Date().toISOString()
          const overdue = now - new Date(timestamp).getTime() >= MS_48H
          return {
            id: `approval-${approval.id}`,
            priority: overdue ? 'urgent' as const : 'high' as const,
            category: 'request' as const,
            title: 'Pending System Approval',
            description: approval.description ?? approval.reason ?? approval.guard_name ?? `Approval request #${approval.id}`,
            timestamp,
            actionLabel: 'Review approval',
            onAction: () => onAction?.('approval', approval.id),
            statusChip: overdue ? { label: 'Overdue', tone: 'danger' as const } : { label: 'Pending', tone: 'warning' as const },
          }
        }),
        ...notifications
          .filter((notification) => !notification.is_read)
          .map((notification) => {
            const category = getNotificationCategory(notification)
            const actionType = notification.type === 'firearm_compliance' ? 'firearm-compliance' : 'guard-compliance'
            return {
              id: `notification-${notification.id}`,
              notificationId: notification.id,
              priority: getNotificationPriority(notification),
              category,
              title: notification.title,
              description: notification.message,
              timestamp: notification.created_at,
              isRead: false,
              actionLabel: category === 'compliance' ? 'Open compliance' : undefined,
              onAction: category === 'compliance' ? () => onAction?.(actionType, notification.id) : undefined,
            }
          }),
      ]

      const priorityOrder = { urgent: 0, high: 1, normal: 2 }
      items.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]
        || new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())

      setInboxItems(items)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [userId, onAction])

  return <NotificationTriage items={inboxItems} isLoading={loading} emptyMessage="No notifications require attention." />
}
