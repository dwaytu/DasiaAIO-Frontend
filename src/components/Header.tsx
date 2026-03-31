import { FC, ReactNode, useState } from 'react'
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
  const [refreshing, setRefreshing] = useState(false)

  const refreshControl = rightSlot ?? (
    <button
      type="button"
      onClick={() => {
        setRefreshing(true)
        window.setTimeout(() => setRefreshing(false), 700)
        window.location.reload()
      }}
      className="inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-semibold text-text-primary bg-surface border border-border rounded-lg transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
      aria-label="Refresh dashboard"
      title="Refresh dashboard"
    >
      <svg className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 12a9 9 0 10-3.2 6.9" />
        <path d="M21 3v6h-6" />
      </svg>
      Refresh
    </button>
  )

  return (
    <header className="relative isolate z-[1200] border-b border-border bg-surface/95 px-4 py-4 backdrop-blur md:px-8 md:py-5">
      <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger menu */}
        <button
          type="button"
          onClick={onMenuClick}
          className="min-h-11 min-w-11 rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)] lg:hidden"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="hidden lg:block">
          <SentinelLogo size={30} variant="IconOnly" animated />
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
