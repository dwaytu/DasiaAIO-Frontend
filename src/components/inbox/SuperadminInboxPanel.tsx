import React, { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Bell } from 'lucide-react';
import { ActionInbox } from './ActionInbox';
import type { InboxItem } from './ActionInbox';
import { WorkflowTimeline } from './WorkflowTimeline';
import type { TimelineEntry } from './WorkflowTimeline';
import { getAuthHeaders } from '../../utils/api';

// ─── API response types ────────────────────────────────────────────────────

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface PendingApproval {
  id: string;
  created_at: string;
  description?: string;
  status: string;
}

interface Incident {
  id: string;
  title?: string;
  description?: string;
  severity?: string;
  status: string;
  created_at: string;
}

// ─── Component ────────────────────────────────────────────────────────────

export interface SuperadminInboxPanelProps {
  userId: string;
  onAction?: (type: string, id: string) => void;
}

const MS_PER_HOUR = 3_600_000;
const MS_48H = 48 * MS_PER_HOUR;

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export const SuperadminInboxPanel = ({
  userId,
  onAction,
}: SuperadminInboxPanelProps): React.ReactElement => {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [statsIncidents, setStatsIncidents] = useState(0);
  const [statsPending, setStatsPending] = useState(0);
  const [statsUnread, setStatsUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const headers = getAuthHeaders({ 'Content-Type': 'application/json' });

    const fetchAll = async (): Promise<void> => {
      setLoading(true);

      const [notifResult, approvalResult, incidentResult] = await Promise.allSettled([
        fetch(`/api/users/${encodeURIComponent(userId)}/notifications`, { headers }).then<Notification[]>((r) =>
          r.ok ? r.json() : Promise.reject(r.status)
        ),
        fetch('/api/guard-replacement/pending-approvals', { headers }).then<PendingApproval[]>(
          (r) => (r.ok ? r.json() : Promise.reject(r.status))
        ),
        fetch('/api/incidents', { headers }).then<Incident[]>((r) =>
          r.ok ? r.json() : Promise.reject(r.status)
        ),
      ]);

      const notifications: Notification[] =
        notifResult.status === 'fulfilled' ? notifResult.value : [];
      const approvals: PendingApproval[] =
        approvalResult.status === 'fulfilled' ? approvalResult.value : [];
      const incidents: Incident[] =
        incidentResult.status === 'fulfilled' ? incidentResult.value : [];

      // ── Stats ──────────────────────────────────────────────────────────
      const incidentsThisMonth = incidents.filter((i) => isThisMonth(i.created_at)).length;
      const pendingCount = approvals.length;
      const unreadCount = notifications.filter((n) => !n.is_read).length;

      setStatsIncidents(incidentsThisMonth);
      setStatsPending(pendingCount);
      setStatsUnread(unreadCount);

      // ── Inbox items ────────────────────────────────────────────────────
      const now = Date.now();
      const items: InboxItem[] = [];

      for (const incident of incidents) {
        if (incident.status !== 'closed' && incident.status !== 'resolved') {
          items.push({
            id: incident.id,
            priority: 'urgent',
            category: 'compliance',
            title: 'Critical Incident Requires Review',
            description: incident.description ?? incident.title ?? `Incident #${incident.id}`,
            timestamp: incident.created_at,
            actionLabel: 'Review',
            onAction: () => onAction?.('incident-review', incident.id),
            statusChip: { label: incident.severity ?? 'Critical', tone: 'danger' },
          });
        }
      }

      for (const approval of approvals) {
        const age = now - new Date(approval.created_at).getTime();
        items.push({
          id: approval.id,
          priority: age >= MS_48H ? 'urgent' : 'high',
          category: 'approval',
          title: 'Pending System Approval',
          description: approval.description ?? `Approval request #${approval.id}`,
          timestamp: approval.created_at,
          actionLabel: 'Approve',
          onAction: () => onAction?.('approval', approval.id),
          statusChip: age >= MS_48H ? { label: 'Overdue', tone: 'danger' } : undefined,
        });
      }

      for (const notif of notifications) {
        if (!notif.is_read) {
          items.push({
            id: notif.id,
            priority: 'normal',
            category: 'notification',
            title: notif.title,
            description: notif.message,
            timestamp: notif.created_at,
            isRead: false,
            onAction: () => onAction?.('notification', notif.id),
          });
        }
      }

      // Sort by priority then timestamp (newest first within same priority)
      const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2 } as const;
      items.sort((a, b) => {
        const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (diff !== 0) return diff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setInboxItems(items);

      // ── Timeline entries ───────────────────────────────────────────────
      const entries: TimelineEntry[] = incidents
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((incident) => ({
          id: incident.id,
          status:
            incident.status === 'closed' || incident.status === 'resolved'
              ? 'resolved'
              : 'active',
          title: incident.title ?? `Incident #${incident.id}`,
          timestamp: incident.created_at,
          detail: incident.description,
          category: 'Compliance Event',
        }));

      if (cancelled) return;
      setTimelineEntries(entries);
      setLoading(false);
    };

    void fetchAll();
    return () => {
      cancelled = true;
    };
  }, [userId, onAction]);

  return (
    <div className="space-y-6">
      <h2 className="text-text-primary font-semibold text-lg">Governance Inbox</h2>

      {/* Governance Banner */}
      <div
        className="flex flex-wrap gap-3"
        role="region"
        aria-label="Governance summary statistics"
      >
        <StatChip
          icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}
          count={statsIncidents}
          label="Incidents this month"
          tone="danger"
        />
        <StatChip
          icon={<ClipboardCheck className="w-4 h-4" aria-hidden="true" />}
          count={statsPending}
          label="Pending approvals"
          tone="warning"
        />
        <StatChip
          icon={<Bell className="w-4 h-4" aria-hidden="true" />}
          count={statsUnread}
          label="Unread notifications"
          tone="info"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox
          items={inboxItems}
          isLoading={loading}
          emptyMessage="No governance actions"
        />
        <WorkflowTimeline
          entries={timelineEntries}
          isLoading={loading}
          emptyMessage="No compliance events"
          maxVisible={10}
        />
      </div>
    </div>
  );
};

// ─── StatChip ─────────────────────────────────────────────────────────────

interface StatChipProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  tone: 'danger' | 'warning' | 'info';
}

const TONE_CLASSES: Record<StatChipProps['tone'], string> = {
  danger: 'bg-danger/10 text-danger border-danger/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  info: 'bg-info/10 text-info border-info/20',
};

function StatChip({ icon, count, label, tone }: StatChipProps): React.ReactElement {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${TONE_CLASSES[tone]}`}
      role="status"
      aria-label={`${count} ${label}`}
    >
      {icon}
      <span className="font-bold tabular-nums">{count}</span>
      <span className="text-text-secondary">{label}</span>
    </div>
  );
}
