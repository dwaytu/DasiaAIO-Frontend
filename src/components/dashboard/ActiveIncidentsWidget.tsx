import { FC } from 'react'
import type { Incident } from '../../hooks/useIncidents'

interface ActiveIncidentsWidgetProps {
  incidents: Incident[]
  nowLabel: string
  loading?: boolean
  error?: string
}

const PRIORITY_CONFIG: Record<
  Incident['priority'],
  { label: string; rowClass: string; badgeClass: string }
> = {
  critical: {
    label: 'CRITICAL',
    rowClass: 'border-l-2 border-danger-border bg-danger-bg critical-glow',
    badgeClass: 'border border-danger-border bg-danger-bg text-danger-text',
  },
  high: {
    label: 'HIGH',
    rowClass: 'border-l-2 border-warning-border bg-warning-bg',
    badgeClass: 'border border-warning-border bg-warning-bg text-warning-text',
  },
  medium: {
    label: 'MED',
    rowClass: 'border-l-2 border-warning-border bg-warning-bg',
    badgeClass: 'border border-warning-border bg-warning-bg text-warning-text',
  },
  low: {
    label: 'LOW',
    rowClass: 'border-l-2 border-success-border bg-success-bg',
    badgeClass: 'border border-success-border bg-success-bg text-success-text',
  },
}

const STATUS_LABEL: Record<Incident['status'], string> = {
  open: 'OPEN',
  investigating: 'INVESTIGATING',
  resolved: 'RESOLVED',
}

const SEVERITY_DOT_CLASS: Record<Incident['priority'], string> = {
  critical: 'bg-danger-text',
  high: 'bg-warning-text',
  medium: 'bg-warning-text',
  low: 'bg-success-text',
}

const ActiveIncidentsWidget: FC<ActiveIncidentsWidgetProps> = ({
  incidents,
  nowLabel,
  loading = false,
  error = '',
}) => {
  const active = incidents.filter(
    (i) => i.status === 'open' || i.status === 'investigating',
  )

  return (
    <section
      className="command-panel rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-label="Active Incidents"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Alert icon */}
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-danger-text"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text)]">
            Active Incidents
          </h2>
          {active.length > 0 && (
            <span className="rounded-full border border-danger-border bg-danger-bg px-2 py-0.5 font-mono text-xs font-bold text-danger-text">
              {active.length}
            </span>
          )}
        </div>
        <span className="font-mono text-xs text-[color:var(--color-muted-text)]">{nowLabel}</span>
      </div>

      {/* Body */}
      <div className="p-2">
        {loading && (
          <p className="px-2 py-4 text-center font-mono text-xs text-[color:var(--color-muted-text)]">
            Loading incidents...
          </p>
        )}

        {!loading && error && (
          <p className="px-2 py-4 text-center font-mono text-xs text-warning-text" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && active.length === 0 && (
          <p className="px-2 py-4 text-center font-mono text-xs text-[color:var(--color-muted-text)]">
            No active incidents
          </p>
        )}

        {!loading && !error && active.length > 0 && (
          <ul className="max-h-64 space-y-1 overflow-y-auto" role="list">
            {active.map((incident) => {
              const cfg = PRIORITY_CONFIG[incident.priority]
              const priorityClass =
                incident.priority === 'critical'
                  ? 'incident-row-critical'
                  : incident.priority === 'high'
                    ? 'incident-row-high'
                    : incident.priority === 'medium'
                      ? 'incident-row-medium'
                      : ''
              const timeLabel = new Date(incident.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <li
                  key={incident.id}
                  className={`flex cursor-default items-start justify-between gap-3 rounded px-3 py-2 transition-colors hover:bg-[color:var(--color-surface-elevated)] ${cfg.rowClass} ${priorityClass}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-semibold text-[color:var(--color-text)]">
                      {incident.title}
                    </p>
                    <p className="truncate font-mono text-xs text-[color:var(--color-muted-text)]">
                      {incident.location}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${cfg.badgeClass}`}>
                      {cfg.label}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[color:var(--color-muted-text)]">
                      <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT_CLASS[incident.priority]}`} aria-hidden="true" />
                      Severity
                    </span>
                    <span className="font-mono text-[11px] text-[color:var(--color-muted-text)]">
                      {STATUS_LABEL[incident.status]} · {timeLabel}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default ActiveIncidentsWidget
