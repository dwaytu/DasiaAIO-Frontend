import { FC, ElementType } from 'react'

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: FC<EmptyStateProps> = ({ icon: Icon, title, subtitle, actionLabel, onAction }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <Icon className="h-12 w-12 text-text-tertiary" aria-hidden="true" />
    <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
    <p className="max-w-sm text-sm text-text-secondary">{subtitle}</p>
    {actionLabel && onAction ? (
      <button type="button" onClick={onAction} className="soc-btn-primary">
        {actionLabel}
      </button>
    ) : null}
  </div>
)

export default EmptyState;
