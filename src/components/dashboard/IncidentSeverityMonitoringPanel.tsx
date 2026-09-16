import { FC } from 'react'
import type { Incident } from '../../hooks/useIncidents'
import { resolveIncidentSiteName } from '../../utils/incidentSite'

interface IncidentSeverityMonitoringPanelProps {
  incidents: Incident[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const severityBadgeClass: Record<Incident['priority'], string> = {
  critical: 'soc-status-danger',
  high: 'soc-status-danger',
  medium: 'soc-status-warning',
  low: 'soc-status-success',
}

const statusPillClass: Record<Incident['status'], string> = {
  open: 'soc-status-danger',
  investigating: 'soc-status-info',
  resolved: 'soc-status-success',
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
      className="command-panel rounded border border-(--color-border) bg-(--color-surface)"
      aria-label="Incident severity monitoring"
    >
      <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-(--color-text)">Incident Severity Monitoring</p>
          <p className="font-mono text-[11px] text-(--color-muted-text)">Live severity distribution and escalation posture</p>
        </div>
        {lastUpdated && <span className="font-mono text-[11px] text-(--color-muted-text)">Updated {lastUpdated}</span>}
      </div>

      <div className="space-y-3 px-4 py-3" role="region" aria-live="polite">
        <div className="grid grid-cols-4 gap-2">
          <div className="soc-status-danger w-full justify-center rounded-md px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide">Critical</p>
            <p className="font-mono text-base font-bold">{severitySummary.critical}</p>
          </div>
          <div className="soc-status-danger w-full justify-center rounded-md px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide">High</p>
            <p className="font-mono text-base font-bold">{severitySummary.high}</p>
          </div>
          <div className="soc-status-warning w-full justify-center rounded-md px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide">Medium</p>
            <p className="font-mono text-base font-bold">{severitySummary.medium}</p>
          </div>
          <div className="soc-status-success w-full justify-center rounded-md px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide">Low</p>
            <p className="font-mono text-base font-bold">{severitySummary.low}</p>
          </div>
        </div>

        {loading && <p className="text-center font-mono text-xs text-(--color-muted-text)">Syncing incident severity feed...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-danger-text">
            {error}
          </p>
        )}

        {!loading && !error && activeIncidents.length === 0 && (
          <p className="text-center font-mono text-xs text-(--color-muted-text)">No active incidents in the severity queue.</p>
        )}

        {!loading && !error && activeIncidents.length > 0 && (
          <ul className="space-y-2" role="list">
            {activeIncidents.slice(0, 6).map((incident) => {
              const timeLabel = new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              return (
                <li
                  key={incident.id}
                  className="rounded-md border border-(--color-border)/60 bg-(--color-bg)/30 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-(--color-text)">{incident.title}</p>
                      <p className="truncate font-mono text-[11px] text-(--color-muted-text)">{resolveIncidentSiteName(incident)}</p>
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
                  <p className="mt-1 font-mono text-[11px] text-(--color-muted-text)">Reported {timeLabel}</p>
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
