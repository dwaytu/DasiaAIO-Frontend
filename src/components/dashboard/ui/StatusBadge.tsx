import { FC, ReactNode } from 'react'

type StatusTone = 'default' | 'guard' | 'vehicle' | 'mission' | 'maintenance' | 'analytics' | 'success' | 'warning' | 'danger'

interface StatusBadgeProps {
  label: string
  tone?: StatusTone
  icon?: ReactNode
}

const toneClass: Record<StatusTone, string> = {
  default: 'soc-chip status-neutral',
  guard: 'soc-chip tone-guard',
  vehicle: 'soc-chip tone-vehicle',
  mission: 'soc-chip tone-mission',
  maintenance: 'soc-chip tone-maintenance',
  analytics: 'soc-chip tone-analytics',
  success: 'soc-chip status-success',
  warning: 'soc-chip status-warning',
  danger: 'soc-chip status-danger',
}

const StatusBadge: FC<StatusBadgeProps> = ({ label, tone = 'default', icon }) => {
  return (
    <span className={toneClass[tone]}>
      {icon ? <span className="mr-1 inline-flex" aria-hidden="true">{icon}</span> : null}
      {label}
    </span>
  )
}

export default StatusBadge
