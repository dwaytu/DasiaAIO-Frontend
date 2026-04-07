import { FC } from 'react'

export interface QuickActionItem {
  label: string
  onClick: () => void
  tone?: 'indigo' | 'blue' | 'emerald' | 'amber'
}

interface QuickActionsPanelProps {
  actions: QuickActionItem[]
}

const toneClass: Record<NonNullable<QuickActionItem['tone']>, string> = {
  indigo: 'border-info-border bg-info-bg text-info-text',
  blue: 'border-info-border bg-info-bg text-info-text',
  emerald: 'border-success-border bg-success-bg text-success-text',
  amber: 'border-warning-border bg-warning-bg text-warning-text',
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
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={`group flex min-h-12 items-center gap-2 rounded border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors duration-200 ${toneClass[action.tone || 'indigo']}`}
          aria-label={action.label}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-surface text-text-primary">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {actionIcons[action.label] || <path d="M12 5v14M5 12h14" />}
            </svg>
          </span>
          {action.label}
        </button>
      ))}
    </div>
  )
}

export default QuickActionsPanel
