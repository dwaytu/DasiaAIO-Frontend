import React, { useEffect, useState } from 'react';
import { ActionInbox, InboxItem } from './ActionInbox';
import { WorkflowTimeline, TimelineEntry, TimelineStatus } from './WorkflowTimeline';
import { getAuthHeaders } from '../../utils/api';
import { parsePendingApprovalsPayload, type PendingApprovalRecord } from './pendingApprovals';

export interface SupervisorInboxPanelProps {
  userId: string;
  onAction?: (type: string, id: string) => void;
}

type PendingApproval = PendingApprovalRecord;

interface Incident {
  id: string;
  title?: string;
  type?: string;
  status?: string;
  location?: string;
  created_at?: string;
  reported_at?: string;
}

interface Shift {
  id: string;
  guard_id?: string | null;
  start_time?: string;
  end_time?: string;
  created_at?: string;
}

interface Notification {
  id: string;
  title?: string;
  message?: string;
  is_read?: boolean;
  read?: boolean;
  created_at?: string;
}

function toInboxItems(
  approvals: PendingApproval[],
  incidents: Incident[],
  shifts: Shift[],
  notifications: Notification[],
  onAction?: (type: string, id: string) => void,
): InboxItem[] {
  const items: InboxItem[] = [];

  for (const a of approvals) {
    items.push({
      id: `approval-${a.id}`,
      priority: 'urgent',
      category: 'approval',
      title: 'Guard Replacement Needed',
      description: a.guard_name ?? a.role ?? 'Replacement requested',
      timestamp: a.created_at ?? a.requested_at ?? new Date().toISOString(),
      actionLabel: 'Review',
      onAction: onAction ? () => onAction('approval', a.id) : undefined,
    });
  }

  for (const inc of incidents) {
    if (inc.status === 'closed') continue;
    items.push({
      id: `incident-${inc.id}`,
      priority: 'high',
      category: 'incident',
      title: inc.title ?? inc.type ?? 'Incident',
      description: inc.location ?? 'No location specified',
      timestamp: inc.created_at ?? inc.reported_at ?? new Date().toISOString(),
      actionLabel: 'View',
      onAction: onAction ? () => onAction('incident', inc.id) : undefined,
    });
  }

  for (const shift of shifts) {
    if (shift.guard_id) continue;
    const range =
      shift.start_time && shift.end_time
        ? `${shift.start_time} – ${shift.end_time}`
        : 'Time unspecified';
    items.push({
      id: `shift-${shift.id}`,
      priority: 'high',
      category: 'shift',
      title: 'Unassigned Shift',
      description: range,
      timestamp: shift.created_at ?? new Date().toISOString(),
      actionLabel: 'Assign',
      onAction: onAction ? () => onAction('shift', shift.id) : undefined,
    });
  }

  for (const notif of notifications) {
    const isRead = notif.is_read ?? notif.read ?? false;
    if (isRead) continue;
    items.push({
      id: `notification-${notif.id}`,
      priority: 'normal',
      category: 'notification',
      title: notif.title ?? 'Notification',
      description: notif.message ?? '',
      timestamp: notif.created_at ?? new Date().toISOString(),
      isRead: false,
    });
  }

  return items;
}

function incidentStatusToTimeline(status: string | undefined): TimelineStatus {
  switch (status) {
    case 'open':
      return 'active';
    case 'closed':
      return 'resolved';
    case 'pending':
      return 'pending';
    default:
      return 'active';
  }
}

function toTimelineEntries(incidents: Incident[]): TimelineEntry[] {
  return incidents.slice(0, 10).map((inc) => ({
    id: `timeline-incident-${inc.id}`,
    status: incidentStatusToTimeline(inc.status),
    title: inc.title ?? inc.type ?? 'Incident',
    detail: inc.location,
    timestamp: inc.created_at ?? inc.reported_at ?? new Date().toISOString(),
    category: 'Incident',
  }));
}


export const SupervisorInboxPanel = ({
  userId,
  onAction,
}: SupervisorInboxPanelProps): React.ReactElement => {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const headers = getAuthHeaders({ 'Content-Type': 'application/json' });

    const fetchAll = async () => {
      setLoading(true);
      setAllFailed(false);

      const [approvalsResult, incidentsResult, shiftsResult, notificationsResult] =
        await Promise.allSettled([
          fetch('/api/users/pending-approvals', { headers }).then((r) => r.json() as Promise<unknown>),
          fetch('/api/incidents', { headers }).then((r) => r.json() as Promise<unknown>),
          fetch('/api/guard-replacement/shifts', { headers }).then((r) => r.json() as Promise<unknown>),
          fetch(`/api/users/${encodeURIComponent(userId)}/notifications`, { headers }).then((r) => r.json() as Promise<unknown>),
        ]);

      if (cancelled) return;

      const succeeded = [approvalsResult, incidentsResult, shiftsResult, notificationsResult].some(
        (r) => r.status === 'fulfilled',
      );

      if (!succeeded) {
        setAllFailed(true);
        setLoading(false);
        return;
      }

      const approvals: PendingApproval[] =
        approvalsResult.status === 'fulfilled'
          ? parsePendingApprovalsPayload(approvalsResult.value)
          : [];

      const incidentsRaw: Incident[] =
        incidentsResult.status === 'fulfilled' && Array.isArray(incidentsResult.value)
          ? (incidentsResult.value as Incident[]).slice(0, 10)
          : [];

      const shifts: Shift[] =
        shiftsResult.status === 'fulfilled' && Array.isArray(shiftsResult.value)
          ? (shiftsResult.value as Shift[])
          : [];

      const notifications: Notification[] =
        notificationsResult.status === 'fulfilled' && Array.isArray(notificationsResult.value)
          ? (notificationsResult.value as Notification[])
          : [];

      setInboxItems(toInboxItems(approvals, incidentsRaw, shifts, notifications, onAction));
      setTimelineEntries(toTimelineEntries(incidentsRaw));
      setLoading(false);
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [userId, onAction]);

  if (allFailed) {
    return (
      <div className="space-y-6" role="region" aria-label="Field Control Inbox">
        <h2 className="text-text-primary font-semibold text-lg">Field Control Inbox</h2>
        <p className="text-danger text-sm" role="alert">
          Unable to load inbox data. Please check your connection and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="Field Control Inbox">
      <h2 className="text-text-primary font-semibold text-lg">Field Control Inbox</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox
          items={inboxItems}
          isLoading={loading}
          emptyMessage="No pending actions"
        />
        <WorkflowTimeline
          entries={timelineEntries}
          isLoading={loading}
          emptyMessage="No active incidents"
        />
      </div>
    </div>
  );
};
