import { FC, ReactNode } from 'react'

interface CommandMetricCardProps {
  label: string
  value: number | string
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success'
  hint?: string
  icon?: ReactNode
}

const toneStyles: Record<NonNullable<CommandMetricCardProps['tone']>, string> = {
  neutral: 'bg-surface border-border-subtle text-text-primary',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-200',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  danger: 'bg-red-500/10 border-red-500/30 text-red-200',
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
}

const CommandMetricCard: FC<CommandMetricCardProps> = ({ label, value, tone = 'neutral', hint, icon }) => {
  return (
    <article className={`rounded-xl border p-4 ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        {icon && <div className="shrink-0 text-current">{icon}</div>}
      </div>
      {hint && <p className="mt-2 text-xs text-text-secondary">{hint}</p>}
    </article>
  )
}

export default CommandMetricCard
