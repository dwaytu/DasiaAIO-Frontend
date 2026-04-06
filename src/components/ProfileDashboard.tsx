import { FC, useState } from 'react'
import type { User } from '../context/AuthContext'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'
import ProfileModalContent from './profile/ProfileModalContent'

interface ProfileDashboardProps {
  user: User
  onLogout: () => void
  onBack: () => void
  onViewChange?: (view: string) => void
  activeView?: string
  onProfilePhotoUpdate?: (photoUrl: string) => void
}

const ProfileDashboard: FC<ProfileDashboardProps> = ({ user, onLogout, onBack, onViewChange, activeView, onProfilePhotoUpdate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <OperationalShell
      user={user}
      title="PROFILE"
      navItems={getSidebarNav(user.role)}
      activeView={activeView || 'profile'}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={onBack}
      rightSlot={
        <button
          onClick={onBack}
          className="px-3 md:px-4 py-2 text-sm font-semibold text-text-primary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden md:inline">Back</span>
        </button>
      }
    >
      <ProfileModalContent user={user} mode="page" onProfilePhotoUpdate={onProfilePhotoUpdate} />
    </OperationalShell>
  )
}

export default ProfileDashboard
