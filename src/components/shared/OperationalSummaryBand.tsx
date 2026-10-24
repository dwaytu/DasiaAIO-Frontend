import { FC } from 'react'
import type { LucideIcon } from 'lucide-react'

type SummaryTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

export interface OperationalSummaryItem {
  label: string
  value: string | number
  detail?: string
  tone?: SummaryTone
  icon?: LucideIcon
}

interface OperationalSummaryBandProps {
  items: OperationalSummaryItem[]
}

const toneStyles: Record<SummaryTone, { icon: string }> = {
  neutral: { icon: 'bg-surface-elevated text-text-secondary' },
  success: { icon: 'bg-success-bg text-success-text' },
  info: { icon: 'bg-info-bg text-info-text' },
  warning: { icon: 'bg-warning-bg text-warning-text' },
  danger: { icon: 'bg-danger-bg text-danger-text' },
}

const OperationalSummaryBand: FC<OperationalSummaryBandProps> = ({ items }) => {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Operational summary">
      {items.map((item) => {
        const style = toneStyles[item.tone || 'neutral']
        const Icon = item.icon

        return (
          <div key={item.label} className="rounded-lg border border-border-subtle bg-surface p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{item.label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{item.value}</p>
                {item.detail ? <p className="mt-1 text-xs text-text-secondary">{item.detail}</p> : null}
              </div>
              {Icon ? (
                <span className={`inline-flex shrink-0 rounded-md p-2 ${style.icon}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
    </section>
  )
}

export default OperationalSummaryBand
