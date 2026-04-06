import { FC, ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  tone?: 'guard' | 'vehicle' | 'mission' | 'maintenance' | 'analytics' | 'default'
  hint?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'flat'
}

const toneClass = {
  default: 'status-bar-info',
  guard: 'status-bar-info tone-guard-surface',
  vehicle: 'status-bar-warning tone-vehicle-surface',
  mission: 'status-bar-info tone-mission-surface',
  maintenance: 'status-bar-critical tone-maintenance-surface',
  analytics: 'status-bar-info tone-analytics-surface',
}

const trendIndicator: Record<string, { symbol: string; className: string }> = {
  up: { symbol: '▲', className: 'text-sm text-success' },
  down: { symbol: '▼', className: 'text-sm text-danger' },
  flat: { symbol: '─', className: 'text-sm text-text-tertiary' },
}

const StatCard: FC<StatCardProps> = ({ label, value, tone = 'default', hint, icon, trend }) => {
  return (
    <article className={`soc-dashboard-card ${toneClass[tone]} transition-transform duration-200 hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="soc-label">{label}</p>
          <p className="mt-1 text-[1.45rem] font-black leading-none text-text-primary">
            {value}
            {trend ? <span className={`ml-1.5 ${trendIndicator[trend].className}`} aria-label={`Trend ${trend}`}>{trendIndicator[trend].symbol}</span> : null}
          </p>
          {hint ? <p className="mt-2 text-[12px] text-text-secondary">{hint}</p> : null}
        </div>
        {icon ? <div className="rounded-md border border-border-subtle bg-surface-elevated p-2 text-text-secondary">{icon}</div> : null}
      </div>
    </article>
  )
}

export default StatCard
