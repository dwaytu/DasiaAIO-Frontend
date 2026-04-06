import { FC, ElementType } from 'react';

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: FC<EmptyStateProps> = ({ icon: Icon, title, subtitle, actionLabel, onAction }) => (
  <div className="flex flex-col items-center gap-3 py-12">
    <Icon className="h-12 w-12 text-text-tertiary" aria-hidden="true" />
    <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
    <p className="max-w-sm text-center text-sm text-text-secondary">{subtitle}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="rounded-lg bg-info px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info/90"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
