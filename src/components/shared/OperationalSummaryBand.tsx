import { FC } from 'react'
import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type SummaryTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

export interface OperationalSummaryItem {
  label: string
  value: string | number
  detail?: string
  tone?: SummaryTone
  icon?: LucideIcon
  onSelect?: () => void
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

        const cardClass = 'rounded-lg border border-border-subtle bg-surface p-4 shadow-sm transition-all hover:shadow-md'
        const content = (
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wider text-text-tertiary">{item.label}</span>
                <span className="mt-2 block text-2xl font-bold tracking-tight text-text-primary">{item.value}</span>
                {item.detail ? <span className="mt-1 block text-xs text-text-secondary">{item.detail}</span> : null}
              </span>
              {Icon ? (
                <span className={`inline-flex shrink-0 rounded-md p-2 ${style.icon}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : null}
              {item.onSelect ? <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" /> : null}
            </span>
        )

        return item.onSelect ? (
          <button
            key={item.label}
            type="button"
            aria-haspopup="dialog"
            aria-label={`View ${item.label.toLowerCase()} history`}
            className={`${cardClass} flex h-full cursor-pointer flex-col text-left hover:border-info-border hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)`}
            onClick={item.onSelect}
          >
            {content}
          </button>
        ) : (
          <div key={item.label} className={cardClass}>{content}</div>
        )
      })}
    </section>
  )
}

export default OperationalSummaryBand
