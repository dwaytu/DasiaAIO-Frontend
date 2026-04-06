import React, { useEffect, useState } from 'react';
import { ActionInbox, InboxItem } from './ActionInbox';
import { WorkflowTimeline, TimelineEntry } from './WorkflowTimeline';
import { getAuthHeaders } from '../../utils/api';
import { parsePendingApprovalsPayload, type PendingApprovalRecord } from './pendingApprovals';

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

async function safeFetch<T>(url: string, headers: HeadersInit): Promise<T[]> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

async function safeFetchPendingApprovals(url: string, headers: HeadersInit): Promise<PendingApproval[]> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return parsePendingApprovalsPayload(data);
  } catch {
    return [];
  }
}

async function safeFetchObject<T>(url: string, headers: HeadersInit): Promise<T | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      return data as T;
    }
    return null;
  } catch {
    return null;
  }
}

function buildInboxItems(
  approvals: PendingApproval[],
  firearms: FirearmItem[],
  notifications: AdminNotification[],
  onAction?: (type: string, id: string) => void,
): InboxItem[] {
  const items: InboxItem[] = [];

  for (const approval of approvals) {
    items.push({
      id: `approval-${approval.id}`,
      priority: 'urgent',
      category: 'approval',
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
      priority: 'normal',
      category: 'notification',
      title: notif.title ?? 'Admin Notification',
      description: notif.message ?? '',
      timestamp: notif.created_at ?? notif.timestamp ?? new Date().toISOString(),
      actionLabel: 'Dismiss',
      onAction: () => onAction?.('notification', notif.id),
      isRead: false,
    });
  }

  return items;
}

function buildTimelineEntries(notifications: AdminNotification[]): TimelineEntry[] {
  return notifications.map((notif) => {
    const isRead = notif.is_read ?? notif.read ?? false;
    return {
      id: `timeline-notif-${notif.id}`,
      status: isRead ? 'resolved' : 'active',
      title: notif.title ?? 'Admin Notification',
      detail: notif.message,
      timestamp: notif.created_at ?? notif.timestamp ?? new Date().toISOString(),
      category: 'Admin Notification',
    };
  });
}

export const AdminInboxPanel = ({ userId, onAction }: AdminInboxPanelProps): React.ReactElement => {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const headers = getAuthHeaders({ 'Content-Type': 'application/json' });

      const [approvalsResult, firearmsResult, notificationsResult, metricsResult] =
        await Promise.allSettled([
          safeFetchPendingApprovals(
            '/api/users/pending-approvals',
            headers,
          ),
          safeFetch<FirearmItem>('/api/firearms/allocations', headers).then((data) =>
            data.length > 0
              ? data
              : safeFetch<FirearmItem>('/api/firearms', headers),
          ),
          safeFetch<AdminNotification>(
            `/api/users/${encodeURIComponent(userId)}/notifications`,
            headers,
          ),
          safeFetchObject<OperationalMetrics>('/api/analytics/metrics', headers),
        ]);

      if (cancelled) return;

      const approvals =
        approvalsResult.status === 'fulfilled' ? approvalsResult.value : [];
      const firearms =
        firearmsResult.status === 'fulfilled' ? firearmsResult.value : [];
      const notifications =
        notificationsResult.status === 'fulfilled' ? notificationsResult.value : [];
      const metricsData =
        metricsResult.status === 'fulfilled' ? metricsResult.value : null;

      setInboxItems(buildInboxItems(approvals, firearms, notifications, onAction));
      setTimelineEntries(buildTimelineEntries(notifications));
      setMetrics(metricsData);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, onAction]);

  const pendingCount = inboxItems.filter((i) => i.category === 'approval').length;
  const activeGuards = metrics?.active_guards;
  const totalIncidents = metrics?.total_incidents;

  return (
    <div className="space-y-6">
      <h2 className="text-text-primary font-semibold text-lg">Operations Inbox</h2>

      {metrics !== null && (
        <div className="flex gap-3 flex-wrap" role="status" aria-label="Operational metrics summary">
          {activeGuards !== undefined && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-tone-guard-surface text-text-primary border border-border">
              {activeGuards} Active Guard{activeGuards !== 1 ? 's' : ''}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-warning/10 text-warning border border-warning/30">
              {pendingCount} Pending Approval{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
          {totalIncidents !== undefined && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-surface-elevated text-text-secondary border border-border">
              {totalIncidents} Incident{totalIncidents !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox
          items={inboxItems}
          isLoading={loading}
          emptyMessage="No pending actions"
        />
        <WorkflowTimeline
          entries={timelineEntries}
          isLoading={loading}
          emptyMessage="No recent activity"
        />
      </div>
    </div>
  );
};
