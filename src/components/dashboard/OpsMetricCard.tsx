import { FC } from 'react'

interface OpsMetricCardProps {
  label: string
  value: number | string
  severity?: 'normal' | 'info' | 'warning' | 'critical' | 'success'
  delta?: string
  updatedAt?: string
}

const severityStyles: Record<NonNullable<OpsMetricCardProps['severity']>, string> = {
  normal: 'status-bar-info border-border-subtle bg-surface text-text-primary',
  info: 'status-bar-info border-info-border bg-info-bg text-info-text',
  warning: 'status-bar-warning border-warning-border bg-warning-bg text-warning-text',
  critical: 'critical-glow border-danger-border bg-danger-bg text-danger-text',
  success: 'status-bar-success border-success-border bg-success-bg text-success-text',
}

const OpsMetricCard: FC<OpsMetricCardProps> = ({ label, value, severity = 'normal', delta, updatedAt }) => {
  return (
    <article className={`bento-card border ${severityStyles[severity]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</p>
      <p className="mt-2 text-3xl font-black leading-none text-text-primary">{value}</p>
      <div className="mt-3 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-text-secondary">
        <span>{delta || 'No delta'}</span>
        <span>{updatedAt || 'Unknown refresh'}</span>
      </div>
    </article>
  )
}

export default OpsMetricCard
