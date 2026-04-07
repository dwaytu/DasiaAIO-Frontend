import { FC } from 'react'

type SystemHealthState = 'operational' | 'warning' | 'critical'

interface SystemStatusBannerProps {
  status: SystemHealthState
  guardsActive: number
  guardsCapacity: number
  activeIncidents: number
  firearmsCheckedOut: number
  vehiclesDeployed: number
}

interface MetricItemProps {
  label: string
  value: string | number
  icon: JSX.Element
}

const MetricItem: FC<MetricItemProps> = ({ label, value, icon }) => {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface/70 px-2 py-1">
      <span aria-hidden="true" className="text-text-secondary">
        {icon}
      </span>
      <span className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{label}</span>
      <span className="text-sm font-bold text-text-primary">{value}</span>
    </div>
  )
}

const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <circle cx="9" cy="8" r="3" />
    <path d="M3 18a6 6 0 0 1 12 0" />
    <circle cx="17.5" cy="8.5" r="2.5" />
    <path d="M15 18a5 5 0 0 1 6 0" />
  </svg>
)

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M12 3 2.6 19h18.8L12 3Z" />
    <path d="M12 9v5" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const FirearmIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M3 11h10.5l3.5-2.5H21v3h-3.8l-2.6 1.8V16H12v2H9v-2H7.5l-1.2 2H4l1-2H3z" />
  </svg>
)

const VehicleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <path d="M7 16v2M17 16v2" />
    <circle cx="8" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

const STATUS_STYLE: Record<SystemHealthState, { label: string; toneClass: string; glowClass: string }> = {
  operational: {
    label: 'OPERATIONAL',
    toneClass: 'border-[color:var(--color-success-border)] bg-[color:var(--color-success-bg)] text-[color:var(--color-success-text)] status-bar-success',
    glowClass: '',
  },
  warning: {
    label: 'WARNING',
    toneClass: 'border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning-text)] status-bar-warning',
    glowClass: '',
  },
  critical: {
    label: 'CRITICAL',
    toneClass: 'border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger-text)] status-bar-critical',
    glowClass: '',
  },
}

const SystemStatusBanner: FC<SystemStatusBannerProps> = ({
  status,
  guardsActive,
  guardsCapacity,
  activeIncidents,
  firearmsCheckedOut,
  vehiclesDeployed,
}) => {
  const style = STATUS_STYLE[status]

  return (
    <section
      className={`rounded border p-3 md:p-4 ${style.toneClass} ${style.glowClass}`}
      aria-label="Global system status"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.16em] md:text-sm">
            System Status: {style.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MetricItem label="Guards" value={`${guardsActive}/${guardsCapacity}`} icon={<PeopleIcon />} />
          <MetricItem label="Incidents" value={activeIncidents} icon={<AlertIcon />} />
          <MetricItem label="Firearms Active" value={firearmsCheckedOut} icon={<FirearmIcon />} />
          <MetricItem label="Vehicles Deployed" value={vehiclesDeployed} icon={<VehicleIcon />} />
        </div>
      </div>
    </section>
  )
}

export default SystemStatusBanner
