import { FC } from 'react'
import SentinelLogo from './SentinelLogo'

type SystemStatus = 'operational' | 'degraded' | 'critical'

interface SidebarBrandProps {
  onClick?: () => void
  compact?: boolean
  status?: SystemStatus
}

const statusClass: Record<SystemStatus, string> = {
  operational: 'status-light-success',
  degraded: 'status-light-warning',
  critical: 'status-light-danger',
}

const SidebarBrand: FC<SidebarBrandProps> = ({ onClick, compact = false, status = 'operational' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex min-h-12 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-elevated"
      aria-label="Go to dashboard"
      title={`SENTINEL - System ${status}`}
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-info-text">
        <SentinelLogo size={38} variant="IconOnly" animated className="drop-shadow-[0_0_8px_var(--color-info)]" />
      </span>

      <span className={`min-w-0 items-center gap-2.5 ${compact ? 'inline-flex lg:hidden' : 'inline-flex'}`}>
        <span className="truncate text-xl font-bold uppercase tracking-[0.15em] text-text-primary">SENTINEL</span>
        <span
          className={`status-light status-light-pulse h-2.5 w-2.5 shrink-0 ${statusClass[status]}`}
          aria-label={`System ${status}`}
          title={`System ${status}`}
        />
      </span>
    </button>
  )
}

export default SidebarBrand
