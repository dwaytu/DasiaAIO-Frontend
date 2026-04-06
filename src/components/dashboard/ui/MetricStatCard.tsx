import { FC } from 'react'

interface MetricStatCardProps {
  label: string
  value: string
  tone?: 'guard' | 'vehicle' | 'mission' | 'maintenance' | 'analytics' | 'default'
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  meter?: {
    value: number
    max: number
    label?: string
  }
}

const toneClass = {
  default: 'status-bar-info',
  guard: 'status-bar-info tone-guard-surface',
  vehicle: 'status-bar-warning tone-vehicle-surface',
  mission: 'status-bar-info tone-mission-surface',
  maintenance: 'status-bar-critical tone-maintenance-surface',
  analytics: 'status-bar-info tone-analytics-surface',
}

const trendIndicator = {
  up: { symbol: '▲', className: 'text-sm text-success' },
  down: { symbol: '▼', className: 'text-sm text-danger' },
  flat: { symbol: '─', className: 'text-sm text-text-tertiary' },
}

const meterToneClass = {
  default: 'bg-info-border',
  guard: 'bg-success-border',
  vehicle: 'bg-warning-border',
  mission: 'bg-info-border',
  maintenance: 'bg-danger-border',
  analytics: 'bg-info-border',
}

const MetricStatCard: FC<MetricStatCardProps> = ({ label, value, tone = 'default', hint, trend, meter }) => {
  const meterRatio = meter && meter.max > 0
    ? Math.max(0, Math.min(100, (meter.value / meter.max) * 100))
    : 0

  return (
    <article className={`soc-dashboard-card ${toneClass[tone]}`}>
      <p className="soc-label">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-[1.45rem] font-black leading-none text-text-primary">{value}</p>
        {trend ? (
          <span className={`${trendIndicator[trend].className}`} aria-label={`Trend ${trend}`}>
            {trendIndicator[trend].symbol}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-[12px] text-text-secondary">{hint}</p> : null}
      {meter ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${meterToneClass[tone]}`}
              style={{ width: `${meterRatio}%` }}
              role="progressbar"
              aria-valuenow={Math.round(meterRatio)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} ratio ${Math.round(meterRatio)} percent`}
            />
          </div>
          {meter.label ? <p className="mt-2 text-[11px] text-text-tertiary">{meter.label}</p> : null}
        </div>
      ) : null}
    </article>
  )
}

export default MetricStatCard
