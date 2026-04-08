import { FC } from 'react'

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

const actionIcons: Record<string, JSX.Element> = {
  'Assign Shift': <path d="M8 7h8M8 12h8M8 17h5M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />,
  'Approve Guard': <path d="M9.5 12.5l1.8 1.8 3.5-3.5M12 3l7 3v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-3z" />,
  'Allocate Firearm': <path d="M3 12h10l3-2h5v4h-5l-3-2H3v-2zm8 0v4" />,
  'Assign Vehicle': <path d="M3 14V8l2-3h14l2 3v6M5 14h14M7 17a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />,
  'Start Trip': <path d="M5 12h14M12 5l7 7-7 7" />,
  'End Trip': <path d="M19 12H5m7 7l-7-7 7-7" />,
  'Create Mission': <path d="M12 5v14M5 12h14" />,
}

const QuickActionsPanel: FC<QuickActionsPanelProps> = ({ actions }) => {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      {actions.map((action) => {
        const style = toneStyles[action.tone || 'indigo']

        return (
          <button
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`group flex min-h-[3rem] items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition-all duration-200 ${style.base} ${style.hover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-1 focus-visible:ring-offset-surface active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40`}
            aria-label={action.label}
          >
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${style.icon}`}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {actionIcons[action.label] || <path d="M12 5v14M5 12h14" />}
              </svg>
            </span>
            <span className="leading-tight">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default QuickActionsPanel
