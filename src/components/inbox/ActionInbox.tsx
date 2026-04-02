import {
  Clock,
  AlertTriangle,
  ArrowLeftRight,
  UserCheck,
  Shield,
  FileText,
  Bell,
} from 'lucide-react';

export type InboxPriority = 'urgent' | 'high' | 'normal';
export type InboxCategory =
  | 'mission'
  | 'incident'
  | 'shift'
  | 'approval'
  | 'firearm'
  | 'compliance'
  | 'notification';

export interface InboxItem {
  id: string;
  priority: InboxPriority;
  category: InboxCategory;
  title: string;
  description: string;
  timestamp: string;
  actionLabel?: string;
  onAction?: () => void;
  statusChip?: { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' };
  isRead?: boolean;
}

export interface ActionInboxProps {
  items: InboxItem[];
  isLoading?: boolean;
  emptyMessage?: string;
  onItemClick?: (item: InboxItem) => void;
  className?: string;
}

const PRIORITY_ORDER: Record<InboxPriority, number> = { urgent: 0, high: 1, normal: 2 };

const PRIORITY_BAR_CLASS: Record<InboxPriority, string> = {
  urgent: 'bg-danger',
  high: 'bg-warning',
  normal: 'bg-info',
};

const CATEGORY_ICON: Record<InboxCategory, React.ElementType> = {
  mission: Clock,
  incident: AlertTriangle,
  shift: ArrowLeftRight,
  approval: UserCheck,
  firearm: Shield,
  compliance: FileText,
  notification: Bell,
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function SkeletonRow(): React.ReactElement {
  return (
    <div className="flex items-start gap-3 p-4 animate-pulse">
      <div className="w-1 self-stretch rounded-full bg-surface-elevated" />
      <div className="h-6 w-6 rounded bg-surface-elevated flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/5 rounded bg-surface-elevated" />
        <div className="h-3 w-3/4 rounded bg-surface-elevated" />
      </div>
    </div>
  );
}

export function ActionInbox({
  items,
  isLoading = false,
  emptyMessage = 'No items in your inbox.',
  onItemClick,
  className = '',
}: ActionInboxProps): React.ReactElement {
  const sorted = [...items].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  return (
    <section
      aria-label={`Action inbox, ${items.length} items`}
      className={`soc-dashboard-card flex flex-col overflow-hidden ${className}`}
    >
      {isLoading ? (
        <div role="status" aria-label="Loading inbox items">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : sorted.length === 0 ? (
        <div className="soc-empty-state flex items-center justify-center p-8 text-text-secondary text-sm">
          {emptyMessage}
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle" role="list">
          {sorted.map((item) => {
            const Icon = CATEGORY_ICON[item.category];
            return (
              <li key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.priority} priority: ${item.title}`}
                  onClick={() => onItemClick?.(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onItemClick?.(item);
                    }
                  }}
                  className={[
                    'flex items-start gap-3 p-4 cursor-pointer transition-colors',
                    'hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    item.isRead ? 'bg-surface' : 'bg-primary/5',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={`w-1 self-stretch rounded-full flex-shrink-0 ${PRIORITY_BAR_CLASS[item.priority]}`}
                  />

                  <span aria-hidden="true" className="text-text-secondary mt-0.5 flex-shrink-0">
                    <Icon size={16} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-sm font-medium text-text-primary truncate ${!item.isRead ? 'font-semibold' : ''}`}
                      >
                        {item.title}
                      </span>

                      <span className="text-xs text-text-secondary whitespace-nowrap flex-shrink-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">
                      {item.description}
                    </p>

                    {(item.statusChip || item.actionLabel) && (
                      <div className="flex items-center gap-2 mt-2">
                        {item.statusChip && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tone-${item.statusChip.tone}-surface`}
                          >
                            {item.statusChip.label}
                          </span>
                        )}

                        {item.actionLabel && item.onAction && (
                          <button
                            type="button"
                            aria-label={`${item.actionLabel} for ${item.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              item.onAction?.();
                            }}
                            className="text-xs text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                          >
                            {item.actionLabel}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
