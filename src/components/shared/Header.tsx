import { FC, ReactNode } from 'react'
import { Menu } from 'lucide-react'
import SectionBadge from '../SectionBadge'
import type { User } from '../../context/AuthContext'
import HeaderGlobalActions from './HeaderGlobalActions'

interface HeaderProps {
  title: string
  badgeLabel?: string
  onLogout: () => void
  rightSlot?: ReactNode
  onMenuClick?: () => void
  user: User
  onNavigateToProfile?: () => void
  onNavigateToInbox?: () => void
  onNavigateToSettings?: () => void
}

const Header: FC<HeaderProps> = ({ title, badgeLabel, onLogout, rightSlot, onMenuClick, user, onNavigateToProfile, onNavigateToInbox, onNavigateToSettings }) => {
  return (
    <header className="relative isolate z-(--z-header) border-b border-border bg-surface/95 px-4 py-3 backdrop-blur md:px-8 md:py-4" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
      <div className="flex items-start justify-between gap-3 sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile hamburger menu */}
        <button
          type="button"
          onClick={onMenuClick}
          className="soc-btn-neutral min-h-11 min-w-11 rounded-md p-2 text-text-secondary"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h1 className="m-0 text-xl font-bold uppercase tracking-wide text-text-primary md:text-2xl">{title}</h1>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Mission Console</p>
        </div>
        {badgeLabel && <div className="hidden sm:block"><SectionBadge label={badgeLabel} /></div>}
      </div>
      <HeaderGlobalActions
        user={user}
        onLogout={onLogout}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToInbox={onNavigateToInbox}
        onNavigateToSettings={onNavigateToSettings}
        extraAction={rightSlot}
      />
      </div>
    </header>
  )
}

export default Header

