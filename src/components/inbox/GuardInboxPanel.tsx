import React, { useEffect, useState } from 'react';
import { ActionInbox, type InboxItem } from './ActionInbox';
import { WorkflowTimeline, type TimelineEntry } from './WorkflowTimeline';
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api';
import { API_BASE_URL } from '../../config';
import { fetchSwapRequestsFeed, type SwapRequestsFeedResult } from '../../utils/swapRequests';

// ── API response shapes ──────────────────────────────────────────────────────

interface ShiftItem {
  id: string;
  title?: string;
  start_time: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
}

interface NotificationItem {
  id: string;
  type: string;
  title?: string;
  message?: string;
  created_at: string;
  is_read: boolean;
}

interface SwapRequest {
  id: string;
  status: string;
  created_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSwapRequest(value: unknown): SwapRequest | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.status !== 'string') {
    return null;
  }

  const createdAt = typeof value.created_at === 'string' ? value.created_at : value.createdAt;
  if (typeof createdAt !== 'string') {
    return null;
  }

  return {
    id: value.id,
    status: value.status,
    created_at: createdAt,
  };
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface GuardInboxPanelProps {
  userId: string;
  onAction?: (type: string, id: string) => void;
}

// ── Guards ───────────────────────────────────────────────────────────────────

function isShiftArray(data: unknown): data is ShiftItem[] {
  return Array.isArray(data);
}

function isNotificationArray(data: unknown): data is NotificationItem[] {
  return Array.isArray(data);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function isWithin24Hours(iso: string): boolean {
  const now = Date.now();
  const shiftTime = new Date(iso).getTime();
  return shiftTime > now && shiftTime - now <= 24 * 60 * 60 * 1000;
}

// ── Data mappers ─────────────────────────────────────────────────────────────

function mapShiftsToInboxItems(shifts: ShiftItem[]): InboxItem[] {
  return shifts
    .filter((s) => isWithin24Hours(s.start_time))
    .map((s) => ({
      id: `shift-${s.id}`,
      priority: 'urgent' as const,
      category: 'mission' as const,
      title: 'Upcoming Shift',
      description: `${s.title ?? 'Shift'} — ${formatDateTime(s.start_time)}`,
      timestamp: s.start_time,
    }));
}

function mapSwapRequestsToInboxItems(swaps: SwapRequest[]): InboxItem[] {
  return swaps
    .filter((s) => s.status === 'pending')
    .map((s) => ({
      id: `swap-${s.id}`,
      priority: 'high' as const,
      category: 'shift' as const,
      title: 'Swap Request',
      description: 'A shift swap request requires review',
      timestamp: s.created_at,
    }));
}

function mapNotificationsToInboxItems(notifications: NotificationItem[]): InboxItem[] {
  return notifications
    .filter((n) => !n.is_read)
    .map((n) => ({
      id: `notif-${n.id}`,
      priority: n.type === 'shift' ? ('high' as const) : ('normal' as const),
      category: 'notification' as const,
      title: n.title ?? 'Notification',
      description: n.message ?? '',
      timestamp: n.created_at,
    }));
}

const SHIFT_STATUS_MAP: Record<string, TimelineEntry['status']> = {
  pending: 'pending',
  active: 'active',
  completed: 'resolved',
  cancelled: 'cancelled',
};

function mapShiftsToTimelineEntries(shifts: ShiftItem[]): TimelineEntry[] {
  return shifts.map((s) => ({
    id: `timeline-shift-${s.id}`,
    status: SHIFT_STATUS_MAP[s.status] ?? 'pending',
    title: s.title ?? 'Shift',
    timestamp: s.start_time,
    category: 'Mission Shift',
  }));
}

// ── Component ────────────────────────────────────────────────────────────────

export const GuardInboxPanel: React.FC<GuardInboxPanelProps> = ({ userId, onAction }) => {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allFailed, setAllFailed] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [swapFeedNotice, setSwapFeedNotice] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll(): Promise<void> {
      setLoading(true);
      setLoadError('');
      const headers = getAuthHeaders();

      const [shiftsResult, notificationsResult, swapRequestsResult] =
        await Promise.allSettled([
          fetchJsonOrThrow(`${API_BASE_URL}/api/guard-replacement/guard/${encodeURIComponent(userId)}/shifts`, { headers }, 'Unable to load guard shifts.').then(
            (r) => r as unknown,
          ),
          fetchJsonOrThrow(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/notifications`, { headers }, 'Unable to load notifications.').then(
            (r) => r as unknown,
          ),
          fetchSwapRequestsFeed(headers),
        ]);

      if (cancelled) return;

      const shifts =
        shiftsResult.status === 'fulfilled' && isShiftArray(shiftsResult.value)
          ? shiftsResult.value
          : [];
      const notifications =
        notificationsResult.status === 'fulfilled' &&
        isNotificationArray(notificationsResult.value)
          ? notificationsResult.value
          : [];
      const swapFeed = swapRequestsResult.status === 'fulfilled'
        ? swapRequestsResult.value as SwapRequestsFeedResult
        : null;
      const swapRequests = swapFeed
        ? swapFeed.swapRequests.map(normalizeSwapRequest).filter((swap): swap is SwapRequest => swap !== null)
        : [];

      if (swapFeed?.feedState === 'unavailable') {
        setSwapFeedNotice('Shift swap updates are temporarily unavailable. Inbox is showing other mission activity only.');
      } else if (swapFeed?.feedState === 'stale') {
        setSwapFeedNotice('Shift swap updates may be out of date right now. Inbox is showing other mission activity only.');
      } else {
        setSwapFeedNotice('');
      }

      const fulfilledCount = [
        shiftsResult.status === 'fulfilled',
        notificationsResult.status === 'fulfilled',
        swapFeed?.feedState === 'ready',
      ].filter(Boolean).length;

      setAllFailed(fulfilledCount === 0);
      if (fulfilledCount === 0) {
        setLoadError('Unable to load inbox data. Please check your connection and try again.');
      }
      setInboxItems([
        ...mapShiftsToInboxItems(shifts),
        ...mapSwapRequestsToInboxItems(swapRequests),
        ...mapNotificationsToInboxItems(notifications),
      ]);
      setTimelineEntries(mapShiftsToTimelineEntries(shifts));
      setLoading(false);
    }

    void fetchAll();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="space-y-6">
      {!isOnline && (
        <div className="soc-warning-banner" role="alert">
          Offline — showing cached data
        </div>
      )}
      <h2 className="text-text-primary font-semibold text-lg">My Inbox</h2>
      {allFailed && !loading ? (
        <div className="soc-empty-state" role="alert">
          Unable to load inbox data. Please check your connection and try again.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loadError ? (
            <div className="lg:col-span-2 soc-empty-state" role="alert">
              {loadError}
            </div>
          ) : null}
          {swapFeedNotice ? (
            <div className="lg:col-span-2 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status" aria-live="polite">
              {swapFeedNotice}
            </div>
          ) : null}
          <ActionInbox
            items={inboxItems}
            isLoading={loading}
            emptyMessage="No pending actions"
            onItemClick={(item) => onAction?.(item.category, item.id)}
          />
          <WorkflowTimeline
            entries={timelineEntries}
            isLoading={loading}
            emptyMessage="No active workflows"
          />
        </div>
      )}
    </div>
  );
};
