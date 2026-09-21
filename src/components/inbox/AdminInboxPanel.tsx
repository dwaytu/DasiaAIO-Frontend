import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { type InboxItem } from './ActionInbox';
import { getAuthHeaders } from '../../utils/api';
import { fetchArrayPayload, fetchObjectPayload } from './inboxPayloads';
import { parsePendingApprovalsPayload, type PendingApprovalRecord } from './pendingApprovals';
import { fetchOperationalRequestInboxItems } from './operationalRequestInbox';
import { getNotificationCategory, getNotificationPriority } from './roleInboxSummary';
import { NotificationTriage } from './NotificationTriage';

interface AdminInboxPanelProps {
  userId: string;
  onAction?: (type: string, id: string) => void;
}

type PendingApproval = PendingApprovalRecord;

interface FirearmItem {
  id: string;
  status?: string;
  serial_number?: string;
  model?: string;
  updated_at?: string;
  created_at?: string;
}

interface AdminNotification {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  is_read?: boolean;
  read?: boolean;
  created_at?: string;
  timestamp?: string;
}

interface OperationalMetrics {
  active_guards?: number;
  pending_approvals?: number;
  total_incidents?: number;
  active_operations?: number;
  [key: string]: unknown;
}

async function safeFetchPendingApprovals(
  url: string,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<PendingApproval[]> {
  try {
    const res = await fetch(url, { headers, signal });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return parsePendingApprovalsPayload(data);
  } catch {
    return [];
  }
}

type AnalyticsPayload = {
  overview?: {
    active_guards?: number;
    active_missions?: number;
  };
  mission_stats?: {
    pending_missions?: number;
  };
};

function toOperationalMetrics(payload: AnalyticsPayload | null): OperationalMetrics | null {
  if (!payload) return null;
  return {
    active_guards: payload.overview?.active_guards,
    active_operations: payload.overview?.active_missions,
    pending_approvals: payload.mission_stats?.pending_missions,
  };
}

function buildInboxItems(
  approvals: PendingApproval[],
  firearms: FirearmItem[],
  notifications: AdminNotification[],
  operationalRequests: InboxItem[],
  onAction?: (type: string, id: string) => void,
): InboxItem[] {
  const items: InboxItem[] = [];
  items.push(...operationalRequests);

  for (const approval of approvals) {
    items.push({
      id: `approval-${approval.id}`,
      priority: 'urgent',
      category: 'request',
      title: 'Pending Guard Approval',
      description: approval.guard_name
        ? `${approval.guard_name} — ${approval.reason ?? 'Replacement requested'}`
        : approval.reason ?? 'Guard replacement requires approval',
      timestamp: approval.requested_at ?? approval.created_at ?? new Date().toISOString(),
      actionLabel: 'Review',
      onAction: () => onAction?.('approval', approval.id),
      statusChip: { label: 'Pending', tone: 'warning' },
      isRead: false,
    });
  }

  const unassignedStatuses = new Set(['pending', 'unassigned', 'returned', 'lost', 'maintenance']);
  for (const firearm of firearms) {
    const status = (firearm.status ?? '').toLowerCase();
    if (!unassignedStatuses.has(status) && status !== '') continue;
    const needsAttention = status !== 'assigned' && status !== 'active';
    if (!needsAttention) continue;
    items.push({
      id: `firearm-${firearm.id}`,
      priority: 'high',
      category: 'firearm',
      title: 'Firearm Status Review',
      description: firearm.model
        ? `${firearm.model} (S/N: ${firearm.serial_number ?? 'N/A'}) — status: ${firearm.status ?? 'unknown'}`
        : `Firearm S/N ${firearm.serial_number ?? firearm.id} — status: ${firearm.status ?? 'unknown'}`,
      timestamp: firearm.updated_at ?? firearm.created_at ?? new Date().toISOString(),
      actionLabel: 'Inspect',
      onAction: () => onAction?.('firearm', firearm.id),
      statusChip: { label: firearm.status ?? 'Unknown', tone: 'danger' },
      isRead: false,
    });
  }

  for (const notif of notifications) {
    const isRead = notif.is_read ?? notif.read ?? false;
    if (isRead) continue;
    items.push({
      id: `notif-${notif.id}`,
      priority: getNotificationPriority(notif),
      category: getNotificationCategory(notif),
      title: notif.title ?? 'Admin Notification',
      description: notif.message ?? '',
      timestamp: notif.created_at ?? notif.timestamp ?? new Date().toISOString(),
      actionLabel: notif.type === 'guard_compliance' || notif.type === 'firearm_compliance' ? 'Open compliance' : undefined,
      onAction: notif.type === 'guard_compliance'
        ? () => onAction?.('guard-compliance', notif.id)
        : notif.type === 'firearm_compliance'
          ? () => onAction?.('firearm-compliance', notif.id)
          : undefined,
      isRead: false,
      notificationId: notif.id,
    });
  }

  return items;
}

export const AdminInboxPanel = ({ userId, onAction }: AdminInboxPanelProps): React.ReactElement => {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load(): Promise<void> {
      const headers = getAuthHeaders({ 'Content-Type': 'application/json' });

      const [approvalsResult, firearmsResult, notificationsResult, metricsResult, requestsResult] =
        await Promise.allSettled([
          safeFetchPendingApprovals(
            `${API_BASE_URL}/api/users/pending-approvals`,
            headers,
            controller.signal,
          ),
          fetchArrayPayload<FirearmItem>(
            `${API_BASE_URL}/api/firearm-allocations`,
            headers,
            ['allocations'],
            controller.signal,
          ).then((data) =>
            data.length > 0
              ? data
              : fetchArrayPayload<FirearmItem>(
                `${API_BASE_URL}/api/firearms`,
                headers,
                ['firearms'],
                controller.signal,
              ),
          ),
          fetchArrayPayload<AdminNotification>(
            `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/notifications`,
            headers,
            ['notifications'],
            controller.signal,
          ),
          fetchObjectPayload<AnalyticsPayload>(
            `${API_BASE_URL}/api/analytics`,
            headers,
            controller.signal,
          ),
          fetchOperationalRequestInboxItems(true, controller.signal, onAction),
        ]);

      if (cancelled) return;

      const approvals =
        approvalsResult.status === 'fulfilled' ? approvalsResult.value : [];
      const firearms =
        firearmsResult.status === 'fulfilled' ? firearmsResult.value : [];
      const notifications =
        notificationsResult.status === 'fulfilled' ? notificationsResult.value : [];
      const metricsData =
        metricsResult.status === 'fulfilled' ? toOperationalMetrics(metricsResult.value) : null;
      const operationalRequests =
        requestsResult.status === 'fulfilled' ? requestsResult.value : [];

      setInboxItems(buildInboxItems(approvals, firearms, notifications, operationalRequests, onAction));
      setMetrics(metricsData);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, onAction]);

  const pendingCount = inboxItems.filter((i) => i.category === 'request').length;
  const activeGuards = metrics?.active_guards;
  const totalIncidents = metrics?.total_incidents;

  return (
    <div className="space-y-4">
      {metrics !== null ? (
        <div className="flex flex-wrap gap-3 text-sm text-text-secondary" role="status" aria-label="Operational metrics summary">
          {activeGuards !== undefined ? <span>{activeGuards} active guards</span> : null}
          {pendingCount > 0 ? <span>{pendingCount} pending approvals</span> : null}
          {totalIncidents !== undefined ? <span>{totalIncidents} incidents</span> : null}
        </div>
      ) : null}
      <NotificationTriage items={inboxItems} isLoading={loading} emptyMessage="No notifications require attention." />
    </div>
  );
};
