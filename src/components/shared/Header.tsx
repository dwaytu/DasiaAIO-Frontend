import { FC, ReactNode } from 'react'
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
}

const Header: FC<HeaderProps> = ({ title, badgeLabel, onLogout, rightSlot, onMenuClick, user, onNavigateToProfile, onNavigateToInbox }) => {
  return (
    <header className="relative isolate z-[var(--z-header)] border-b border-border bg-surface/95 px-4 py-3 backdrop-blur md:px-8 md:py-4" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
      <div className="flex items-start justify-between gap-3 sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile hamburger menu */}
        <button
          type="button"
          onClick={onMenuClick}
          className="min-h-11 min-w-11 rounded p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
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
        extraAction={rightSlot}
      />
      </div>
    </header>
  )
}

export default Header

