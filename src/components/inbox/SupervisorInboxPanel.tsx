import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { InboxItem } from './ActionInbox';
import { getAuthHeaders } from '../../utils/api';
import { fetchArrayPayload } from './inboxPayloads';
import { fetchOperationalRequestInboxItems } from './operationalRequestInbox';
import { getNotificationCategory, getNotificationPriority } from './roleInboxSummary';
import { NotificationTriage } from './NotificationTriage';

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
  type?: string;
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
      actionLabel: 'Open map',
      onAction: onAction ? () => onAction('operations-map', inc.id) : undefined,
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
      actionLabel: 'View schedule',
      onAction: onAction ? () => onAction('shift', shift.id) : undefined,
    });
  }

  for (const notif of notifications) {
    const isRead = notif.is_read ?? notif.read ?? false;
    if (isRead) continue;
    const category = getNotificationCategory(notif);
    const complianceAction = notif.type === 'firearm_compliance' ? 'firearm-compliance' : 'guard-compliance';
    items.push({
      id: `notification-${notif.id}`,
      priority: getNotificationPriority(notif),
      category,
      title: notif.title ?? 'Notification',
      description: notif.message ?? '',
      timestamp: notif.created_at ?? new Date().toISOString(),
      isRead: false,
      notificationId: notif.id,
      actionLabel: category === 'compliance' ? 'Open compliance' : undefined,
      onAction: category === 'compliance' && onAction ? () => onAction(complianceAction, notif.id) : undefined,
    });
  }

  return items;
}

export const SupervisorInboxPanel = ({
  userId,
  onAction,
}: SupervisorInboxPanelProps): React.ReactElement => {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
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
    <div role="region" aria-label="Field Control Inbox">
      <NotificationTriage items={inboxItems} isLoading={loading} emptyMessage="No notifications require attention." />
    </div>
  );
};
