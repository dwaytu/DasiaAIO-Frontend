import { FC } from 'react'
import { OpsAlert } from './OpsAlertFeed'
import { useOperationalEvent } from '../../context/OperationalEventContext'

interface IncidentAlertFeedProps {
  alerts: OpsAlert[]
  nowLabel: string
  onUpdateStatus?: (incidentId: string, status: 'investigating' | 'resolved') => Promise<void>
}

const toneClass: Record<OpsAlert['severity'], string> = {
  critical: 'critical-glow border-danger-border bg-danger-bg text-danger-text',
  warning: 'status-bar-warning border-warning-border bg-warning-bg text-warning-text',
  info: 'status-bar-info border-info-border bg-info-bg text-info-text',
}

const IncidentAlertFeed: FC<IncidentAlertFeedProps> = ({ alerts, nowLabel, onUpdateStatus }) => {
  const { selectedEventId, selectEvent } = useOperationalEvent()
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length

  return (
    <section className="command-panel p-4 md:p-5" aria-label="Incident alert feed">
      <div className="mb-4 border-b border-border-subtle pb-3">
        {criticalCount > 0 ? (
          <>
            <h3 className="text-base font-bold uppercase tracking-wide text-danger-text">
              Needs Attention Now
            </h3>
            <p className="text-xs uppercase tracking-[0.16em] text-danger-text/80">
              {criticalCount} critical alert{criticalCount !== 1 ? 's' : ''} active
            </p>
          </>
        ) : (
          <>
            <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Incident Alert Feed</h3>
            <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Monitoring stable</p>
          </>
        )}
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <p className="rounded border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No active incidents. Monitoring remains stable.</p>
        ) : (
          alerts.map((alert, index) => {
            const ageMinutes = alert.createdAt
              ? (Date.now() - new Date(alert.createdAt).getTime()) / 60000
              : 0
            const isOverdue = ageMinutes > 15
            const isEscalate = ageMinutes > 30

            return (
              <div
                key={alert.id}
                role="button"
                tabIndex={0}
                onClick={() => selectEvent({ id: alert.incidentId ?? alert.id, type: alert.incidentId ? 'incident' : 'alert', title: alert.title })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    selectEvent({ id: alert.incidentId ?? alert.id, type: alert.incidentId ? 'incident' : 'alert', title: alert.title })
                  }
                }}
                className={`soc-animated-entry cursor-pointer rounded border p-3 transition-all duration-200 ${toneClass[alert.severity]} ${selectedEventId === (alert.incidentId ?? alert.id) ? 'ring-2 ring-cyan-400' : ''} ${isOverdue ? 'animate-pulse border-2' : ''}`}
                style={{ animationDelay: `${index * 60}ms` }}
                aria-pressed={selectedEventId === (alert.incidentId ?? alert.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Severity: {alert.severity}</p>
                    {isEscalate && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Escalate
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Observed {nowLabel}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-text-primary">{alert.title}</p>
                <p className="mt-1 text-xs opacity-90">{alert.detail}</p>

                {alert.incidentId && onUpdateStatus && (
                  <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void onUpdateStatus(alert.incidentId!, 'investigating')
                      }}
                      className="inline-flex items-center gap-1 rounded border border-info-border bg-info-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-info-text transition-colors hover:brightness-110"
                      aria-label={`Acknowledge ${alert.title}`}
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void onUpdateStatus(alert.incidentId!, 'resolved')
                      }}
                      className="inline-flex items-center gap-1 rounded border border-success-border bg-success-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-success-text transition-colors hover:brightness-110"
                      aria-label={`Resolve ${alert.title}`}
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export default IncidentAlertFeed
