import React, { ReactNode, forwardRef } from 'react';
import { useTheme } from '../context/ThemeProvider';

/**
 * SENTINEL BentoCard Component
 * 
 * A flexible, theme-aware card component following "Bento Grid" design principles
 * for high-density security dashboards. Optimized for 12-hour shift readability.
 * 
 * Features:
 * - Auto-adapts to light/dark theme
 * - Subtle hover states (no jarring transitions)
 * - Elevated neutrals instead of heavy shadows
 * - Optional semantic status variants (success, warning, danger, info)
 * - Flexible sizing with grid-friendly defaults
 * 
 * @component
 * @example
 * // Basic card
 * <BentoCard title="Firearm Allocations" description="24 active">
 *   <AllocationList />
 * </BentoCard>
 * 
 * // Warning card (expiring permits)
 * <BentoCard 
 *   title="Permits Expiring Soon" 
 *   variant="warning"
 *   icon={<AlertIcon />}
 * >
 *   <PermitList />
 * </BentoCard>
 * 
 * // Clickable card
 * <BentoCard 
 *   title="No-Show Alerts" 
 *   variant="danger"
 *   onClick={handleViewAlerts}
 *   interactive
 * >
 *   <AlertCount count={3} />
 * </BentoCard>
 */

export interface BentoCardProps {
  /** Card content */
  children?: ReactNode;
  
  /** Optional header title */
  title?: string;
  
  /** Optional subtitle/description */
  description?: string;
  
  /** Icon element to display before title */
  icon?: ReactNode;
  
  /** Semantic variant for status indication (WCAG AA: never color-only) */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  
  /** Size preset (affects padding and min-height) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  
  /** Enable hover effects and cursor pointer (for clickable cards) */
  interactive?: boolean;
  
  /** Click handler (automatically sets interactive=true) */
  onClick?: () => void;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Optional footer content (e.g., action buttons, timestamps) */
  footer?: ReactNode;
  
  /** Loading state (shows skeleton) */
  loading?: boolean;
  
  /** Disable the card (reduces opacity) */
  disabled?: boolean;
  
  /** Apply glass morphism effect (for overlays) */
  glass?: boolean;
  
  /** Show accent glow (for primary CTAs) */
  glow?: boolean;
}

/**
 * Get variant-specific styling (border + background tint)
 * Ensures WCAG AA compliance - never relies on color alone
 */
const getVariantClasses = (variant: BentoCardProps['variant']): string => {
  switch (variant) {
    case 'success':
      return 'border-success-border bg-success-bg/30';
    case 'warning':
      return 'border-warning-border bg-warning-bg/30';
    case 'danger':
      return 'border-danger-border bg-danger-bg/30';
    case 'info':
      return 'border-info-border bg-info-bg/30';
    default:
      return 'border-border bg-surface';
  }
};

/**
 * Get size-specific padding and min-height
 */
const getSizeClasses = (size: BentoCardProps['size']): string => {
  switch (size) {
    case 'sm':
      return 'p-4 min-h-[120px]';
    case 'md':
      return 'p-5 min-h-[160px]';
    case 'lg':
      return 'p-6 min-h-[200px]';
    case 'xl':
      return 'p-8 min-h-[280px]';
    default:
      return 'p-5 min-h-[160px]';
  }
};

/**
 * Get icon color based on variant (for visual reinforcement, NOT sole indicator)
 */
const getIconColorClass = (variant: BentoCardProps['variant']): string => {
  switch (variant) {
    case 'success':
      return 'text-success';
    case 'warning':
      return 'text-warning';
    case 'danger':
      return 'text-danger';
    case 'info':
      return 'text-info';
    default:
      return 'text-text-secondary';
  }
};

export const BentoCard = forwardRef<HTMLDivElement, BentoCardProps>(
  (
    {
      children,
      title,
      description,
      icon,
      variant = 'default',
      size = 'md',
      interactive = false,
      onClick,
      className = '',
      footer,
      loading = false,
      disabled = false,
      glass = false,
      glow = false,
    },
    ref
  ) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const isInteractive = interactive || !!onClick;

    // Ergonomic border styling: 
    // Light mode - NO border (relies on surface color separation to reduce visual clutter)
    // Dark mode - Subtle border (border-slate-700) for increased depth and visual separation
    const borderClass = isDark ? 'border border-slate-700' : 'border-0';

    const baseClasses = `
      rounded-lg ${borderClass} transition-all duration-250
      ${getSizeClasses(size)}
      ${getVariantClasses(variant)}
      ${isInteractive ? 'cursor-pointer hover:shadow-bento-hover hover:bg-surface-hover' : 'shadow-bento'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      ${glass ? 'glass-card' : ''}
      ${glow ? 'accent-glow' : ''}
      ${className}
    `;

    const handleClick = () => {
      if (disabled || loading) return;
      onClick?.();
    };

    // Loading skeleton
    if (loading) {
      return (
        <div ref={ref} className={baseClasses}>
          <div className="animate-pulse space-y-4">
            {title && <div className="h-6 bg-surface-elevated rounded w-1/3"></div>}
            {description && <div className="h-4 bg-surface-elevated rounded w-1/2"></div>}
            <div className="space-y-2">
              <div className="h-4 bg-surface-elevated rounded"></div>
              <div className="h-4 bg-surface-elevated rounded w-5/6"></div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={baseClasses}
        onClick={handleClick}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive && !disabled ? 0 : undefined}
        onKeyDown={(e) => {
          if (isInteractive && !disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-disabled={disabled}
      >
        {/* Header Section */}
        {(title || icon) && (
          <div className="flex items-start gap-3 mb-4">
            {icon && (
              <div className={`flex-shrink-0 ${getIconColorClass(variant)}`}>
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-semibold text-text-primary mb-1 truncate">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-text-secondary line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Content Section */}
        <div className="flex-1">{children}</div>

        {/* Footer Section */}
        {footer && (
          <div className="mt-4 pt-4 border-t border-border-subtle">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

BentoCard.displayName = 'BentoCard';

/**
 * BentoGrid Container
 * Wraps multiple BentoCards in a responsive grid layout
 * 
 * @example
 * <BentoGrid>
 *   <BentoCard title="Card 1">Content</BentoCard>
 *   <BentoCard title="Card 2">Content</BentoCard>
 *   <BentoCard title="Card 3" className="col-span-2">Wide card</BentoCard>
 * </BentoGrid>
 */
export const BentoGrid: React.FC<{
  children: ReactNode;
  /** Use denser spacing (for high-density data dashboards) */
  dense?: boolean;
  /** Custom column configuration (default: auto-fit) */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}> = ({ children, dense = false, columns, className = '' }) => {
  const gridClass = columns
    ? `grid gap-${dense ? '3' : '4'} grid-cols-1 md:grid-cols-${columns}`
    : dense
    ? 'bento-grid-dense'
    : 'bento-grid';

  return <div className={`${gridClass} ${className}`}>{children}</div>;
};

/**
 * BentoCardStat Component
 * Specialized card variant for displaying key metrics (e.g., guard count, active firearms)
 * 
 * @example
 * <BentoCardStat 
 *   label="Active Guards" 
 *   value="42" 
 *   trend="+5%" 
 *   trendDirection="up"
 *   icon={<UsersIcon />}
 * />
 */
export const BentoCardStat: React.FC<{
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  variant?: BentoCardProps['variant'];
  onClick?: () => void;
  className?: string;
}> = ({ label, value, trend, trendDirection, icon, variant = 'default', onClick, className = '' }) => {
  const trendColor =
    trendDirection === 'up'
      ? 'text-success'
      : trendDirection === 'down'
      ? 'text-danger'
      : 'text-text-secondary';

  return (
    <BentoCard
      variant={variant}
      size="sm"
      interactive={!!onClick}
      onClick={onClick}
      className={className}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary mb-1">{label}</p>
          <p className="text-3xl font-bold text-text-primary">{value}</p>
          {trend && (
            <p className={`text-sm font-medium mt-1 ${trendColor}`}>
              {trend}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-text-tertiary opacity-50">
            {icon}
          </div>
        )}
      </div>
    </BentoCard>
  );
};
