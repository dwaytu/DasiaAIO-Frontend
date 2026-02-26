import { FC, ReactNode } from 'react'
import SectionBadge from './SectionBadge'
import AccountManager from './AccountManager'
import NotificationPanel from './NotificationPanel'
import { User } from '../App'

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
  return (
    <header className="px-4 md:px-8 py-4 md:py-5 flex justify-between items-center" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
      <div className="flex items-center gap-3">
        {/* Mobile hamburger menu */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl md:text-2xl font-bold m-0" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        {badgeLabel && <SectionBadge label={badgeLabel} />}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {rightSlot}
        <NotificationPanel userId={user.id} />
        <AccountManager user={user} onLogout={onLogout} onNavigateToProfile={onNavigateToProfile} />
      </div>
    </header>
  )
}

export default Header
