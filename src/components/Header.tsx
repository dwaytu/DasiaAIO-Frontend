import { FC, ReactNode } from 'react'
import SectionBadge from './SectionBadge'
import AccountManager from './AccountManager'
import NotificationPanel from './NotificationPanel'
import { ThemeToggleButton } from '../context/ThemeProvider'
import { User } from '../App'
import SentinelLogo from './SentinelLogo'

interface HeaderProps {
  title: string
  badgeLabel?: string
  onLogout: () => void
  rightSlot?: ReactNode
  onMenuClick?: () => void
  user: User
  onNavigateToProfile?: () => void
}

const Header: FC<HeaderProps> = ({ title, badgeLabel, onLogout, rightSlot, onMenuClick, user, onNavigateToProfile }) => {
  const refreshControl = rightSlot ?? (
    <button
      onClick={() => window.location.reload()}
      className="px-3 py-2 text-sm font-semibold text-text-primary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
      title="Refresh dashboard"
    >
      Refresh
    </button>
  )

  return (
    <header className="border-b border-border bg-surface/95 px-4 py-4 backdrop-blur md:px-8 md:py-5">
      <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger menu */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary lg:hidden"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="hidden lg:block">
          <SentinelLogo size="sm" />
        </div>
        <div>
          <h1 className="m-0 text-xl font-bold uppercase tracking-wide text-text-primary md:text-2xl">{title}</h1>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Mission Console</p>
        </div>
        {badgeLabel && <SectionBadge label={badgeLabel} />}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <ThemeToggleButton className="flex" />
        {refreshControl}
        <NotificationPanel userId={user.id} />
        <AccountManager user={user} onLogout={onLogout} onNavigateToProfile={onNavigateToProfile} />
      </div>
      </div>
    </header>
  )
}

export default Header
