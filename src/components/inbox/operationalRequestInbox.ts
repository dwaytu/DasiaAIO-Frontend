import type { InboxItem } from './ActionInbox'
import { listOperationalRequests } from '../requests/requestApi'
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from '../requests/types'

export async function fetchOperationalRequestInboxItems(
  canFulfill: boolean,
  signal: AbortSignal,
  onAction?: (type: string, id: string) => void,
): Promise<InboxItem[]> {
  const response = await listOperationalRequests({}, signal)
  return response.items
    .filter((request) => request.status === 'pending'
      || (canFulfill && (request.status === 'approved' || request.status === 'in_progress')))
    .map((request) => ({
      id: `operational-request-${request.id}`,
      priority: request.priority,
      category: 'approval',
      title: request.status === 'pending' ? 'Operational Request Pending' : 'Request Awaiting Fulfillment',
      description: `${REQUEST_TYPE_LABELS[request.requestType]}: ${request.subject} · ${request.requesterName}`,
      timestamp: request.updatedAt,
      actionLabel: request.status === 'pending' ? 'Review' : 'Process',
      onAction: () => onAction?.('operational-request', request.id),
      statusChip: {
        label: REQUEST_STATUS_LABELS[request.status],
        tone: request.status === 'pending' ? 'warning' : 'info',
      },
      isRead: false,
    }))
}
