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
  indigo: 'border-info-border bg-info-bg text-info-text hover:bg-info/20',
  blue: 'border-info-border bg-info-bg text-info-text hover:bg-info/20',
  emerald: 'border-success-border bg-success-bg text-success-text hover:bg-success/20',
  amber: 'border-warning-border bg-warning-bg text-warning-text hover:bg-warning/20',
}

const QuickActionsPanel: FC<QuickActionsPanelProps> = ({ actions }) => {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={`group flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-all duration-200 hover:-translate-y-0.5 hover:shadow-bento-hover ${toneClass[action.tone || 'indigo']}`}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-surface text-[11px] font-black text-text-primary">
            {action.label.slice(0, 1)}
          </span>
          {action.label}
        </button>
      ))}
    </div>
  )
}

export default QuickActionsPanel
