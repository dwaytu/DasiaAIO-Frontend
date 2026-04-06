import { FC } from 'react'
import SentinelLogo from './SentinelLogo'

type SystemStatus = 'operational' | 'degraded' | 'critical'

interface SidebarBrandProps {
  onClick?: () => void
  compact?: boolean
  status?: SystemStatus
}

const statusClass: Record<SystemStatus, string> = {
  operational: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]',
  degraded: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]',
  critical: 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.7)]',
}

const SidebarBrand: FC<SidebarBrandProps> = ({ onClick, compact = false, status = 'operational' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors"
      aria-label="Go to dashboard"
      title="SENTINEL"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan-400/35 bg-cyan-500/10 text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.28)]">
        <SentinelLogo size={30} variant="IconOnly" animated className="drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]" />
      </span>

      <span className={`min-w-0 items-center gap-2 ${compact ? 'inline-flex lg:hidden' : 'inline-flex'}`}>
        <span className="truncate text-[19px] font-bold uppercase tracking-[0.12em] text-text-primary">SENTINEL</span>
        <span
          className={`status-light status-light-pulse h-2.5 w-2.5 rounded-full ${statusClass[status]}`}
          aria-label={`System ${status}`}
          title={`System ${status}`}
        />
      </span>
    </button>
  )
}

export default SidebarBrand
