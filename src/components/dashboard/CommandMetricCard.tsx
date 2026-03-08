import { FC, ReactNode } from 'react'

interface CommandMetricCardProps {
  label: string
  value: number | string
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success'
  hint?: string
  icon?: ReactNode
}

const toneStyles: Record<NonNullable<CommandMetricCardProps['tone']>, string> = {
  neutral: 'status-bar-info',
  info: 'status-bar-info border-info-border bg-info-bg text-info-text',
  warning: 'status-bar-warning border-warning-border bg-warning-bg text-warning-text',
  danger: 'critical-glow border-danger-border bg-danger-bg text-danger-text',
  success: 'status-bar-success border-success-border bg-success-bg text-success-text',
}

const CommandMetricCard: FC<CommandMetricCardProps> = ({ label, value, tone = 'neutral', hint, icon }) => {
  return (
    <article className={`bento-card relative overflow-hidden border ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</p>
          <p className="mt-2 text-3xl font-black leading-none text-text-primary">{value}</p>
        </div>
        {icon && <div className="shrink-0 rounded-md border border-border-subtle bg-surface-elevated p-2 text-current">{icon}</div>}
      </div>
      {hint && <p className="mt-2 text-xs font-medium uppercase tracking-wide text-text-secondary">{hint}</p>}
    </article>
  )
}

export default CommandMetricCard
