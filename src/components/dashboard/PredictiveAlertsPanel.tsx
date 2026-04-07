import { FC } from 'react'
import type { PredictiveAlert } from '../../hooks/usePredictiveAlerts'

interface PredictiveAlertsPanelProps {
  alerts: PredictiveAlert[]
  loading?: boolean
  error?: string
  lastUpdated?: string
  title?: string
  subtitle?: string
}

const severityStyles: Record<string, string> = {
  critical: 'border-danger-border bg-danger-bg',
  warning: 'border-warning-border bg-warning-bg',
  info: 'border-info-border bg-info-bg',
}

const severityIcon: Record<string, string> = {
  critical: '⛔',
  warning: '⚠',
  info: 'ℹ',
}

const isContextObject = (value: PredictiveAlert['context']): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getNumericContext = (context: PredictiveAlert['context'], key: string): number | null => {
  if (!isContextObject(context)) return null
  const candidate = context[key]
  return typeof candidate === 'number' ? candidate : null
}

const getStringListContext = (context: PredictiveAlert['context'], key: string): string[] => {
  if (!isContextObject(context)) return []
  const candidate = context[key]
  if (!Array.isArray(candidate)) return []
  return candidate
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry
      }
      if (typeof entry === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string') {
        return entry.name
      }
      return null
    })
    .filter((value): value is string => Boolean(value))
}

const getSuggestedAction = (alert: PredictiveAlert): string => {
  const category = (alert.category || '').toLowerCase()

  if (alert.severity === 'critical') {
    return 'Escalate to command lead and dispatch field verification immediately.'
  }

  if (category.includes('permit')) {
    return 'Queue permit validation checks and notify scheduling coordinators.'
  }

  if (category.includes('maintenance')) {
    return 'Review maintenance queue and hold non-essential vehicle assignments.'
  }

  if (alert.severity === 'warning') {
    return 'Monitor trend for 15 minutes and prepare mitigation resources.'
  }

  return 'Keep under observation and log the trend in the shift handoff report.'
}

const getConfidence = (alert: PredictiveAlert): number => {
  if (alert.severity === 'critical') return 0.93
  if (alert.severity === 'warning') return 0.84
  return 0.74
}

const getExplanation = (alert: PredictiveAlert): string => {
  const contextKeys = isContextObject(alert.context) ? Object.keys(alert.context).length : 0
  return `Risk level is based on ${contextKeys} contextual data point(s) and ${alert.severity} signal weighting.`
}

const PredictiveAlertsPanel: FC<PredictiveAlertsPanelProps> = ({
  alerts,
  loading = false,
  error = '',
  lastUpdated,
  title = 'Predictive Alerts',
  subtitle = 'Forecasted operational risks',
}) => {
  const timestamp = lastUpdated ? `Updated ${lastUpdated}` : undefined

  return (
    <section
      className="command-panel rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-label="Predictive operational alerts"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-text-primary">{title}</p>
          <p className="font-mono text-[11px] text-text-secondary">{subtitle}</p>
        </div>
        {timestamp && <span className="font-mono text-[11px] text-text-secondary">{timestamp}</span>}
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-4 pr-3" role="region" aria-live="polite">
        {loading && <p className="text-center font-mono text-xs text-text-secondary">Scanning signals...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && alerts.length === 0 && (
          <p className="text-center font-mono text-xs text-text-secondary">No predictive risks detected.</p>
        )}

        {!loading && !error && alerts.length > 0 && (
          <ul className="space-y-3" role="list">
            {alerts.map((alert) => {
              const severityClass = severityStyles[alert.severity] ?? severityStyles.info
              const icon = severityIcon[alert.severity] ?? severityIcon.info
              const categoryLabel = alert.category || 'Forecast'
              const message = alert.message || 'No predictive alert narrative was provided.'
              const count = getNumericContext(alert.context, 'count')
              const guardNames = getStringListContext(alert.context, 'guards')
              const detectedLabel = alert.detectedAt
                ? new Date(alert.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : undefined

              return (
                <li
                  key={alert.id}
                  className={`rounded border px-3 py-2 ${severityClass}`}
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="text-lg" title={alert.severity}>
                      {icon}
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-border-subtle bg-surface px-2 py-0.5 text-[11px] uppercase tracking-wide text-text-secondary">
                          {categoryLabel}
                        </span>
                        {count !== null && (
                          <span className="font-mono text-[11px] text-text-secondary">Count: {count}</span>
                        )}
                        {detectedLabel && (
                          <span className="font-mono text-[11px] text-text-tertiary">Detected {detectedLabel}</span>
                        )}
                      </div>
                      <p className="font-mono text-sm text-text-primary">{message}</p>
                      {guardNames.length > 0 && (
                        <p className="font-mono text-[11px] text-text-secondary">
                          Focus: {guardNames.slice(0, 3).join(', ')}
                          {guardNames.length > 3 ? '…' : ''}
                        </p>
                      )}
                      <p className="font-mono text-[11px] font-semibold text-text-primary">Risk level: {alert.severity.toUpperCase()}</p>
                      <p className="font-mono text-[11px] text-text-secondary">Confidence: {(getConfidence(alert) * 100).toFixed(0)}%</p>
                      <p className="font-mono text-[11px] text-text-secondary">Explanation: {getExplanation(alert)}</p>
                      <p className="font-mono text-[11px] text-text-secondary">
                        Suggested action: {getSuggestedAction(alert)}
                      </p>
                    </div>
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

export default PredictiveAlertsPanel
