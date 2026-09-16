import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { ActionInbox, InboxItem } from './ActionInbox';
import { WorkflowTimeline, TimelineEntry, TimelineStatus } from './WorkflowTimeline';
import { getAuthHeaders } from '../../utils/api';
import { fetchArrayPayload } from './inboxPayloads';
import { fetchOperationalRequestInboxItems } from './operationalRequestInbox';

export interface SupervisorInboxPanelProps {
  userId: string;
  onAction?: (type: string, id: string) => void;
}

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
  incidents: Incident[],
  shifts: Shift[],
  notifications: Notification[],
  operationalRequests: InboxItem[],
  onAction?: (type: string, id: string) => void,
): InboxItem[] {
  const items: InboxItem[] = [];
  items.push(...operationalRequests);

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
    const controller = new AbortController();

    const headers = getAuthHeaders({ 'Content-Type': 'application/json' });

    const fetchAll = async () => {
      setLoading(true);
      setAllFailed(false);

      const [incidentsResult, shiftsResult, notificationsResult, requestsResult] =
        await Promise.allSettled([
          fetchArrayPayload<Incident>(
            `${API_BASE_URL}/api/incidents`,
            headers,
            ['incidents'],
            controller.signal,
          ),
          fetchArrayPayload<Shift>(
            `${API_BASE_URL}/api/guard-replacement/shifts`,
            headers,
            ['shifts'],
            controller.signal,
          ),
          fetchArrayPayload<Notification>(
            `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/notifications`,
            headers,
            ['notifications'],
            controller.signal,
          ),
          fetchOperationalRequestInboxItems(false, controller.signal, onAction),
        ]);

      if (cancelled) return;

      const succeeded = [incidentsResult, shiftsResult, notificationsResult, requestsResult].some(
        (r) => r.status === 'fulfilled',
      );

      if (!succeeded) {
        setAllFailed(true);
        setLoading(false);
        return;
      }

      const incidentsRaw: Incident[] =
        incidentsResult.status === 'fulfilled'
          ? incidentsResult.value.slice(0, 10)
          : [];

      const shifts: Shift[] =
        shiftsResult.status === 'fulfilled'
          ? shiftsResult.value
          : [];

      const notifications: Notification[] =
        notificationsResult.status === 'fulfilled'
          ? notificationsResult.value
          : [];
      const operationalRequests =
        requestsResult.status === 'fulfilled' ? requestsResult.value : [];

      setInboxItems(toInboxItems(incidentsRaw, shifts, notifications, operationalRequests, onAction));
      setTimelineEntries(toTimelineEntries(incidentsRaw));
      setLoading(false);
    };

    fetchAll();

    return () => {
      cancelled = true;
      controller.abort();
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
