import { FC } from 'react'
import type { Incident } from '../../hooks/useIncidents'

interface IncidentSeverityMonitoringPanelProps {
  incidents: Incident[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const severityBadgeClass: Record<Incident['priority'], string> = {
  critical: 'border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-200',
  high: 'border-orange-400/50 bg-orange-500/15 text-orange-700 dark:text-orange-200',
  medium: 'border-amber-400/50 bg-amber-500/15 text-amber-700 dark:text-amber-200',
  low: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200',
}

const statusPillClass: Record<Incident['status'], string> = {
  open: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200',
  investigating: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200',
  resolved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
}

const IncidentSeverityMonitoringPanel: FC<IncidentSeverityMonitoringPanelProps> = ({
  incidents,
  loading = false,
  error = '',
  lastUpdated,
}) => {
  const activeIncidents = incidents.filter((item) => item.status !== 'resolved')
  const severitySummary = {
    critical: activeIncidents.filter((item) => item.priority === 'critical').length,
    high: activeIncidents.filter((item) => item.priority === 'high').length,
    medium: activeIncidents.filter((item) => item.priority === 'medium').length,
    low: activeIncidents.filter((item) => item.priority === 'low').length,
  }

  return (
    <section
      className="command-panel rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-label="Incident severity monitoring"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text)]">Incident Severity Monitoring</p>
          <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">Live severity distribution and escalation posture</p>
        </div>
        {lastUpdated && <span className="font-mono text-[11px] text-[color:var(--color-muted-text)]">Updated {lastUpdated}</span>}
      </div>

      <div className="space-y-3 px-4 py-3" role="region" aria-live="polite">
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-md border border-red-500/35 bg-red-500/10 px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide text-red-700 dark:text-red-200">Critical</p>
            <p className="font-mono text-base font-bold text-red-800 dark:text-red-100">{severitySummary.critical}</p>
          </div>
          <div className="rounded-md border border-orange-400/35 bg-orange-500/10 px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide text-orange-700 dark:text-orange-200">High</p>
            <p className="font-mono text-base font-bold text-orange-800 dark:text-orange-100">{severitySummary.high}</p>
          </div>
          <div className="rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-200">Medium</p>
            <p className="font-mono text-base font-bold text-amber-800 dark:text-amber-100">{severitySummary.medium}</p>
          </div>
          <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Low</p>
            <p className="font-mono text-base font-bold text-emerald-800 dark:text-emerald-100">{severitySummary.low}</p>
          </div>
        </div>

        {loading && <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">Syncing incident severity feed...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && activeIncidents.length === 0 && (
          <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">No active incidents in the severity queue.</p>
        )}

        {!loading && !error && activeIncidents.length > 0 && (
          <ul className="space-y-2" role="list">
            {activeIncidents.slice(0, 6).map((incident) => {
              const timeLabel = new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              return (
                <li
                  key={incident.id}
                  className="rounded-md border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/30 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-[color:var(--color-text)]">{incident.title}</p>
                      <p className="truncate font-mono text-[11px] text-[color:var(--color-muted-text)]">{incident.location}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${severityBadgeClass[incident.priority]}`}>
                        {incident.priority}
                      </span>
                      <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] uppercase ${statusPillClass[incident.status]}`}>
                        {incident.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[color:var(--color-muted-text)]">Reported {timeLabel}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default IncidentSeverityMonitoringPanel