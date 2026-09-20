import { AlertTriangle, ArrowRight, CheckCircle2, type LucideIcon } from 'lucide-react'
import { FC } from 'react'

export type AttentionPriority = 'urgent' | 'high' | 'normal'

export interface AttentionItem {
  id: string
  title: string
  detail: string
  priority: AttentionPriority
  icon: LucideIcon
  actionLabel?: string
  onAction?: () => void
}

interface AttentionQueueProps {
  items: AttentionItem[]
  isDegraded?: boolean
}

const priorityConfig: Record<AttentionPriority, {
  label: string
  row: string
  icon: string
  badge: string
}> = {
  urgent: {
    label: 'Urgent',
    row: 'border-danger-border bg-danger-bg/30',
    icon: 'bg-danger-bg text-danger-text',
    badge: 'border-danger-border text-danger-text',
  },
  high: {
    label: 'Needs action',
    row: 'border-warning-border bg-warning-bg/20',
    icon: 'bg-warning-bg text-warning-text',
    badge: 'border-warning-border text-warning-text',
  },
  normal: {
    label: 'Monitor',
    row: 'border-border-subtle bg-surface-elevated',
    icon: 'bg-info-bg text-info-text',
    badge: 'border-info-border text-info-text',
  },
}

const AttentionQueue: FC<AttentionQueueProps> = ({ items, isDegraded = false }) => {
  return (
    <section
      className="border-b border-border-subtle pb-4"
      aria-labelledby="attention-queue-title"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="attention-queue-title" className="soc-section-title">Needs attention</h2>
            {items.length > 0 ? (
              <span className="soc-chip status-warning" aria-label={`${items.length} items need attention`}>
                {items.length}
              </span>
            ) : null}
          </div>
          <p className="soc-body mt-1 text-text-secondary">
            Review the highest-priority operational items first.
          </p>
        </div>
        <span className={`text-xs font-medium ${isDegraded ? 'text-warning-text' : 'text-text-tertiary'}`}>
          {isDegraded ? 'Operational data incomplete' : 'Live operational queue'}
        </span>
      </div>

      {items.length === 0 ? (
        isDegraded ? (
          <div className="flex items-center gap-3 border border-warning-border bg-warning-bg/20 px-4 py-3 text-sm text-warning-text" role="status">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Operational status cannot be verified</p>
              <p className="mt-0.5 text-xs">Some source data is unavailable. Refresh or review source status before treating the queue as clear.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 border border-success-border bg-success-bg/20 px-4 py-3 text-sm text-success-text">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">No immediate action required</p>
              <p className="mt-0.5 text-xs text-success-text/80">Operations are clear based on the latest available data.</p>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {isDegraded ? (
            <div className="flex items-center gap-2 border border-warning-border bg-warning-bg/20 px-3 py-2 text-xs text-warning-text" role="status">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Some source data is unavailable, so this queue may be incomplete.</span>
            </div>
          ) : null}
          <ol className="grid gap-2 lg:grid-cols-2">
            {items.map((item) => {
              const config = priorityConfig[item.priority]
              const Icon = item.icon

              return (
                <li key={item.id} className={`flex min-w-0 flex-col border px-3 py-3 sm:flex-row sm:items-start sm:gap-3 ${config.row}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${config.icon}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text-primary">{item.title}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.badge}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">{item.detail}</p>
                    </div>
                  </div>
                  {item.onAction && item.actionLabel ? (
                    <button
                      type="button"
                      onClick={item.onAction}
                      className="soc-btn-neutral mt-3 inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-1 px-3 text-xs sm:mt-0 sm:w-auto"
                      aria-label={`${item.actionLabel}: ${item.title}`}
                    >
                      {item.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}

export default AttentionQueue
