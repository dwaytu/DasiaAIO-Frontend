import {
  Clock,
  AlertTriangle,
  ArrowLeftRight,
  UserCheck,
  Shield,
  FileText,
  Bell,
} from 'lucide-react';
import { formatInboxTimestamp } from './inboxFormatting';

export type InboxPriority = 'urgent' | 'high' | 'normal';
export type InboxCategory =
  | 'mission'
  | 'incident'
  | 'shift'
  | 'approval'
  | 'request'
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
  notificationId?: string;
}

export interface ActionInboxProps {
  items: InboxItem[];
  isLoading?: boolean;
  emptyMessage?: string;
  onItemClick?: (item: InboxItem) => void;
  selectedId?: string;
  showInlineActions?: boolean;
  className?: string;
}

const PRIORITY_ORDER: Record<InboxPriority, number> = { urgent: 0, high: 1, normal: 2 };

const PRIORITY_BAR_CLASS: Record<InboxPriority, string> = {
  urgent: 'bg-danger',
  high: 'bg-warning',
  normal: 'bg-success',
};

const CATEGORY_ICON: Record<InboxCategory, React.ElementType> = {
  mission: Clock,
  incident: AlertTriangle,
  shift: ArrowLeftRight,
  approval: UserCheck,
  request: FileText,
  firearm: Shield,
  compliance: FileText,
  notification: Bell,
};

function SkeletonRow(): React.ReactElement {
  return (
    <div className="flex items-start gap-3 p-4 animate-pulse">
      <div className="w-1 self-stretch rounded-full bg-surface-elevated" />
      <div className="h-6 w-6 rounded bg-surface-elevated shrink-0" />
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
  selectedId,
  showInlineActions = true,
  className = '',
}: ActionInboxProps): React.ReactElement {
  const sorted = [...items].sort((a, b) => {
    const priorityDifference = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDifference !== 0) return priorityDifference;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

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
            const isSelected = selectedId === item.id;
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`w-1 self-stretch rounded-full shrink-0 ${PRIORITY_BAR_CLASS[item.priority]}`}
                />

                <span aria-hidden="true" className="text-text-secondary mt-0.5 shrink-0">
                  <Icon size={16} />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-medium text-text-primary truncate ${!item.isRead ? 'font-semibold' : ''}`}>
                      {item.title}
                    </span>
                    <span className="text-xs text-text-secondary whitespace-nowrap shrink-0">
                      {formatInboxTimestamp(item.timestamp)}
                    </span>
                  </div>

                  <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">{item.description}</p>

                  {!item.isRead && item.notificationId ? (
                    <span className="mt-2 inline-flex text-xs font-semibold text-primary">Unread notification</span>
                  ) : null}

                  {showInlineActions && (item.statusChip || item.actionLabel) ? (
                    <div className="flex items-center gap-2 mt-2">
                      {item.statusChip && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tone-${item.statusChip.tone}-surface`}>
                          {item.statusChip.label}
                        </span>
                      )}

                      {item.actionLabel && item.onAction ? (
                        <button
                          type="button"
                          aria-label={`${item.actionLabel} for ${item.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            item.onAction?.();
                          }}
                          className="soc-btn-neutral min-h-11 px-2 py-1 text-xs"
                        >
                          {item.actionLabel}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            );

            return (
              <li key={item.id}>
                {onItemClick ? (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${item.isRead || !item.notificationId ? '' : 'Unread. '}${item.priority} priority: ${item.title}`}
                    onClick={() => onItemClick(item)}
                    className={[
                      'flex w-full items-start gap-3 p-4 text-left transition-colors',
                      'hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--color-focus-ring)',
                      item.isRead ? 'bg-surface' : 'bg-primary/5',
                      isSelected ? 'bg-surface-elevated shadow-[inset_3px_0_0_0_var(--color-primary)]' : '',
                    ].join(' ')}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={`flex items-start gap-3 p-4 ${item.isRead ? 'bg-surface' : 'bg-primary/5'}`}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
