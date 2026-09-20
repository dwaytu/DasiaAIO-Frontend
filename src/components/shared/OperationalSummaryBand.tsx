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

const toneStyles: Record<SummaryTone, { accent: string; value: string; icon: string }> = {
  neutral: { accent: 'border-border-subtle', value: 'text-text-primary', icon: 'bg-surface-elevated text-text-secondary' },
  success: { accent: 'border-success-border', value: 'text-success-text', icon: 'bg-success-bg text-success-text' },
  info: { accent: 'border-info-border', value: 'text-info-text', icon: 'bg-info-bg text-info-text' },
  warning: { accent: 'border-warning-border', value: 'text-warning-text', icon: 'bg-warning-bg text-warning-text' },
  danger: { accent: 'border-danger-border', value: 'text-danger-text', icon: 'bg-danger-bg text-danger-text' },
}

const OperationalSummaryBand: FC<OperationalSummaryBandProps> = ({ items }) => {
  return (
    <section className="grid border-y border-border-subtle sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]" aria-label="Operational summary">
      {items.map((item, index) => {
        const style = toneStyles[item.tone || 'neutral']
        const Icon = item.icon

        return (
          <div key={item.label} className={`flex min-w-0 items-center gap-3 border-l-4 ${style.accent} px-3 py-3 ${index > 0 ? 'border-t border-border-subtle' : ''} ${index < 2 ? 'sm:border-t-0' : 'sm:border-t'} xl:border-t-0`}>
            {Icon ? (
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${style.icon}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">{item.label}</p>
              <p className={`mt-0.5 text-xl font-black ${style.value}`}>{item.value}</p>
              {item.detail ? <p className="text-xs text-text-secondary">{item.detail}</p> : null}
            </div>
          </div>
        )
      })}
    </section>
  )
}

export default OperationalSummaryBand
