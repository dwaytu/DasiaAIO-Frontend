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
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
  blue: 'bg-blue-600 hover:bg-blue-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
}

const QuickActionsPanel: FC<QuickActionsPanelProps> = ({ actions }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors ${toneClass[action.tone || 'indigo']}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

export default QuickActionsPanel
