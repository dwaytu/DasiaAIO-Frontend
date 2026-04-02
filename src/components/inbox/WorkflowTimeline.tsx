import React, { useState } from 'react';
import { Clock, Zap, CheckCircle, XCircle } from 'lucide-react';

export type TimelineStatus = 'pending' | 'active' | 'resolved' | 'cancelled';

export interface TimelineEntry {
  id: string;
  status: TimelineStatus;
  title: string;
  participant?: string;
  timestamp: string;
  detail?: string;
  category?: string;
}

export interface WorkflowTimelineProps {
  entries: TimelineEntry[];
  isLoading?: boolean;
  emptyMessage?: string;
  maxVisible?: number;
  className?: string;
}

const STATUS_ICON: Record<TimelineStatus, React.ElementType> = {
  pending: Clock,
  active: Zap,
  resolved: CheckCircle,
  cancelled: XCircle,
};

const STATUS_ICON_CLASS: Record<TimelineStatus, string> = {
  pending: 'border-2 border-border text-text-secondary bg-surface',
  active: 'bg-primary text-white',
  resolved: 'bg-success text-white',
  cancelled: 'bg-danger/20 text-danger',
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
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-6 h-6 rounded-full bg-surface-elevated" />
        <div className="w-0.5 flex-1 mt-1 bg-surface-elevated min-h-[24px]" />
      </div>
      <div className="flex-1 pb-4 space-y-2">
        <div className="h-4 w-2/5 rounded bg-surface-elevated" />
        <div className="h-3 w-3/4 rounded bg-surface-elevated" />
      </div>
    </div>
  );
}

export function WorkflowTimeline({
  entries,
  isLoading = false,
  emptyMessage = 'No workflow events to display.',
  maxVisible = 8,
  className = '',
}: WorkflowTimelineProps): React.ReactElement {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? entries : entries.slice(0, maxVisible);
  const remaining = entries.length - maxVisible;

  return (
    <section
      aria-label={`Workflow timeline, ${entries.length} entries`}
      className={`soc-dashboard-card flex flex-col overflow-hidden ${className}`}
    >
      {isLoading ? (
        <div role="status" aria-label="Loading workflow timeline">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : entries.length === 0 ? (
        <div className="soc-empty-state flex items-center justify-center p-8 text-text-secondary text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div>
          <ol aria-label="Timeline entries">
            {visible.map((entry, index) => {
              const Icon = STATUS_ICON[entry.status];
              const isLast = index === visible.length - 1 && (showAll || remaining <= 0);
              return (
                <li key={entry.id} aria-label={`${entry.status}: ${entry.title}`}>
                  <div
                    className="flex items-start gap-3 px-4 pt-3 pb-1 cursor-default"
                  >
                    {/* Left: icon + connector line */}
                    <div className="flex flex-col items-center flex-shrink-0" aria-hidden="true">
                      <span
                        className={[
                          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                          STATUS_ICON_CLASS[entry.status],
                        ].join(' ')}
                      >
                        <Icon size={12} />
                      </span>
                      {!isLast && (
                        <span className="w-0.5 flex-1 bg-border-subtle mt-1 min-h-[20px]" />
                      )}
                    </div>

                    {/* Right: content */}
                    <div className="flex-1 pb-3 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-text-primary">
                            {entry.title}
                          </span>
                          {entry.category && (
                            <span className="text-xs rounded bg-surface-elevated text-text-secondary px-1 py-0.5 flex-shrink-0">
                              {entry.category}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-text-secondary whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                      </div>

                      {entry.participant && (
                        <p className="text-sm text-text-secondary mt-0.5">{entry.participant}</p>
                      )}

                      {entry.detail && (
                        <p className="text-sm text-text-secondary mt-1 leading-snug">
                          {entry.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {!showAll && remaining > 0 && (
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-sm text-primary underline hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                aria-label={`Show ${remaining} more timeline entries`}
              >
                Show {remaining} more
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
