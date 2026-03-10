import { FC } from 'react'
import { OpsAlert } from './OpsAlertFeed'

interface IncidentAlertFeedProps {
  alerts: OpsAlert[]
  nowLabel: string
}

const toneClass: Record<OpsAlert['severity'], string> = {
  critical: 'critical-glow border-danger-border bg-danger-bg text-danger-text',
  warning: 'status-bar-warning border-warning-border bg-warning-bg text-warning-text',
  info: 'status-bar-info border-info-border bg-info-bg text-info-text',
}

const IncidentAlertFeed: FC<IncidentAlertFeedProps> = ({ alerts, nowLabel }) => {
  return (
    <section className="command-panel p-4 md:p-5" aria-label="Incident alert feed">
      <div className="mb-4 border-b border-border-subtle pb-3">
        <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Incident Alert Feed</h3>
        <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Prioritized incident stream for operators</p>
      </div>

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No active incidents. Monitoring remains stable.</p>
        ) : (
          alerts.map((alert) => (
            <article key={alert.id} className={`rounded-lg border p-3 ${toneClass[alert.severity]}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">{alert.severity}</p>
                <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90">{nowLabel}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-text-primary">{alert.title}</p>
              <p className="mt-1 text-xs opacity-90">{alert.detail}</p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default IncidentAlertFeed
