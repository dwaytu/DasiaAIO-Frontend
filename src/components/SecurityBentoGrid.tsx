import { ReactNode } from 'react';
import { BentoCard, BentoCardStat } from './BentoCard';

/**
 * SecurityBentoGrid Component
 * 
 * A specialized grid layout for mission-critical security dashboards.
 * Implements the Hyper-Clarity design system with:
 * - Main widget as 2x2 span (Activity Map for primary focus)
 * - Supporting widgets as 1x1 span (metrics and alerts)
 * - Responsive layout (1 col mobile, 2 md, 4 lg)
 * - Alarm fatigue reduction through desaturated colors
 * 
 * Layout pattern on desktop (lg):
 * ┌──────────────────────┬──────────┬──────────┐
 * │                      │ Active   │ Pending  │
 * │   Activity Map       │ Guards   │  Alerts  │
 * │ (Main Widget)        │          │          │
 * │  (2 col × 2 row)    ├──────────┼──────────┤
 * │                      │Equipment │          │
 * └──────────────────────┤ Status   │          │
 *                        │          │          │
 *                        └──────────┴──────────┘
 */

export interface SecurityBentoGridData {
  /** Activity map content - typically a map or timeline visualization */
  activityMapContent?: ReactNode;
  
  /** Number of active guards */
  activeGuardsCount: number;
  activeGuardsTotal: number;
  
  /** Number of pending alerts */
  pendingAlertsCount: number;
  pendingAlertsLevel: 'info' | 'warning' | 'danger';
  
  /** Equipment health percentage (0-100) */
  equipmentHealthPercentage: number;
  equipmentHealthStatus: 'operational' | 'degraded' | 'critical';
}

interface SecurityBentoGridProps {
  /** Dashboard data */
  data: SecurityBentoGridData;
  
  /** Custom activity map content */
  activityMapContent?: ReactNode;
  
  /** Callback when stats change (e.g., for filtering) */
  onActivityMapClick?: () => void;
  onActiveGuardsClick?: () => void;
  onPendingAlertsClick?: () => void;
  onEquipmentStatusClick?: () => void;
  
  /** Show loading skeletons */
  loading?: boolean;
  
  /** Custom className */
  className?: string;
}

/**
 * Get variant based on alert or status level
 */
const getStatusVariant = (
  level?: 'info' | 'warning' | 'danger' | 'operational' | 'degraded' | 'critical'
) => {
  switch (level) {
    case 'info':
      return 'info';
    case 'warning':
      return 'warning';
    case 'danger':
    case 'critical':
      return 'danger';
    case 'degraded':
      return 'warning';
    case 'operational':
      return 'success';
    default:
      return 'default';
  }
};

/**
 * Get equipment status description
 */
const getEquipmentStatusDescription = (
  percentage?: number,
  status?: 'operational' | 'degraded' | 'critical'
): string => {
  if (!percentage) return 'No data';
  
  if (status === 'critical') {
    return `${percentage}% - Critical (Immediate action required)`;
  } else if (status === 'degraded') {
    return `${percentage}% - Degraded (Maintenance scheduled)`;
  } else if (percentage >= 95) {
    return `${percentage}% - Operational`;
  } else if (percentage >= 85) {
    return `${percentage}% - Good`;
  } else {
    return `${percentage}% - Fair`;
  }
};

export const SecurityBentoGrid = ({
  data,
  activityMapContent,
  onActivityMapClick,
  onActiveGuardsClick,
  onPendingAlertsClick,
  onEquipmentStatusClick,
  loading = false,
  className = '',
}: SecurityBentoGridProps) => {
  const activeGuardsCount = data.activeGuardsCount;
  const activeGuardsTotal = data.activeGuardsTotal;
  const pendingAlertsCount = data.pendingAlertsCount;
  const pendingAlertsLevel = data.pendingAlertsLevel;
  const equipmentHealthPercentage = data.equipmentHealthPercentage;
  const equipmentHealthStatus = data.equipmentHealthStatus;

  const activityContent = activityMapContent ?? (
    <div className="h-64 bg-surface-elevated rounded-lg flex items-center justify-center">
      <p className="text-text-secondary">Activity Map Placeholder</p>
    </div>
  );

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}
    >
      {/* Main Widget: Activity Map (2x2 span) */}
      <BentoCard
        title="Activity Map"
        interactive={!!onActivityMapClick}
        onClick={onActivityMapClick}
        className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2"
        loading={loading}
      >
        {activityContent}
      </BentoCard>

      {/* Supporting Widget 1: Active Guards (1x1 span) */}
      <BentoCardStat
        label="Active Guards"
        value={activeGuardsCount}
        trend={
          activeGuardsCount > activeGuardsTotal - 5
            ? '+2 this shift'
            : undefined
        }
        trendDirection={
          activeGuardsCount > activeGuardsTotal - 5 ? 'up' : 'neutral'
        }
        variant="success"
        onClick={onActiveGuardsClick}
        className="col-span-1 row-span-1"
      />

      {/* Supporting Widget 2: Pending Alerts (1x1 span) */}
      <BentoCardStat
        label="Pending Alerts"
        value={pendingAlertsCount}
        trend={
          pendingAlertsCount > 0
            ? `${pendingAlertsCount} awaiting response`
            : 'All clear'
        }
        trendDirection={
          pendingAlertsCount > 2 ? 'down' : pendingAlertsCount > 0 ? 'neutral' : 'up'
        }
        variant={getStatusVariant(pendingAlertsLevel)}
        onClick={onPendingAlertsClick}
        className="col-span-1 row-span-1"
      />

      {/* Supporting Widget 3: Equipment Status (1x1 span) */}
      <BentoCardStat
        label="Equipment Health"
        value={`${equipmentHealthPercentage}%`}
        trend={getEquipmentStatusDescription(
          equipmentHealthPercentage,
          equipmentHealthStatus
        )}
        trendDirection={
          equipmentHealthStatus === 'operational'
            ? 'up'
            : equipmentHealthStatus === 'degraded'
            ? 'neutral'
            : 'down'
        }
        variant={getStatusVariant(equipmentHealthStatus)}
        onClick={onEquipmentStatusClick}
        className="col-span-1 row-span-1"
      />
    </div>
  );
};

export default SecurityBentoGrid;
