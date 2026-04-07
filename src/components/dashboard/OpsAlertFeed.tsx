import { FC } from 'react'

export interface OpsAlert {
  id: string
  incidentId?: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  createdAt?: string
  isPanic?: boolean
}

interface OpsAlertFeedProps {
  alerts: OpsAlert[]
}

const severityOrder: Record<OpsAlert['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

const toneClass: Record<OpsAlert['severity'], string> = {
  critical: 'critical-glow border-danger-border bg-danger-bg text-danger-text',
  warning: 'status-bar-warning border-warning-border bg-warning-bg text-warning-text',
  info: 'status-bar-info border-info-border bg-info-bg text-info-text',
}

const OpsAlertFeed: FC<OpsAlertFeedProps> = ({ alerts }) => {
  const sorted = [...alerts].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return (
    <section className="command-panel p-4">
      <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Alerts</h3>
      <div className="mt-3 space-y-2">
        {sorted.length === 0 ? (
          <p className="text-sm text-text-secondary">No active alerts.</p>
        ) : (
          sorted.map((alert) => (
            <article key={alert.id} className={`rounded border p-3 ${toneClass[alert.severity]}`}>
              <p className="text-sm font-semibold uppercase tracking-wide">{alert.title}</p>
              <p className="mt-1 text-xs opacity-90">{alert.detail}</p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default OpsAlertFeed
