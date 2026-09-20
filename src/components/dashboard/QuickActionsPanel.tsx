import { FC } from 'react'
import { BadgeCheck, CarFront, ClipboardList, Plus, Play, Shield, Square, type LucideIcon } from 'lucide-react'

export interface QuickActionItem {
  label: string
  onClick: () => void
  tone?: 'indigo' | 'blue' | 'emerald' | 'amber'
  disabled?: boolean
}

interface QuickActionsPanelProps {
  actions: QuickActionItem[]
}

const toneStyles: Record<NonNullable<QuickActionItem['tone']>, { base: string; icon: string; hover: string }> = {
  indigo: {
    base: 'border-accent-border bg-surface-elevated text-text-primary',
    icon: 'border-accent-border bg-accent-bg text-accent-text',
    hover: 'hover:bg-accent-bg hover:border-accent-text hover:shadow-md hover:shadow-accent-bg/20',
  },
  blue: {
    base: 'border-info-border bg-surface-elevated text-text-primary',
    icon: 'border-info-border bg-info-bg text-info-text',
    hover: 'hover:bg-info-bg hover:border-info-text hover:shadow-md hover:shadow-info-bg/20',
  },
  emerald: {
    base: 'border-success-border bg-surface-elevated text-text-primary',
    icon: 'border-success-border bg-success-bg text-success-text',
    hover: 'hover:bg-success-bg hover:border-success-text hover:shadow-md hover:shadow-success-bg/20',
  },
  amber: {
    base: 'border-warning-border bg-surface-elevated text-text-primary',
    icon: 'border-warning-border bg-warning-bg text-warning-text',
    hover: 'hover:bg-warning-bg hover:border-warning-text hover:shadow-md hover:shadow-warning-bg/20',
  },
}

const actionIcons: Record<string, LucideIcon> = {
  'Assign Shift': ClipboardList,
  'Approve Guard': BadgeCheck,
  'Allocate Firearm': Shield,
  'Assign Vehicle': CarFront,
  'Start Trip': Play,
  'End Trip': Square,
  'Create Mission': Plus,
}

const QuickActionsPanel: FC<QuickActionsPanelProps> = ({ actions }) => {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      {actions.map((action) => {
        const style = toneStyles[action.tone || 'indigo']
        const Icon = actionIcons[action.label] || Plus

        return (
          <button
            type="button"
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`group flex min-h-[3rem] items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition-all duration-200 ${style.base} ${style.hover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-1 focus-visible:ring-offset-surface active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40`}
            aria-label={action.label}
          >
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${style.icon}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="leading-tight">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default QuickActionsPanel
