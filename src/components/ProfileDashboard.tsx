import { FC, useState } from 'react'
import type { User } from '../context/AuthContext'
import Sidebar from './Sidebar'
import Header from './Header'
import { getSidebarNav } from '../config/navigation'
import ProfileModalContent from './profile/ProfileModalContent'

interface ProfileDashboardProps {
  user: User
  onLogout: () => void
  onBack: () => void
  onProfilePhotoUpdate?: (photoUrl: string) => void
}

const ProfileDashboard: FC<ProfileDashboardProps> = ({ user, onLogout, onBack, onProfilePhotoUpdate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = getSidebarNav(user.role, { homeView: user.role === 'guard' ? 'overview' : 'dashboard' })

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <a href="#maincontent" className="skip-link">Skip to main content</a>
      <Sidebar
        activeView="profile"
        items={navItems}
        onNavigate={() => onBack()}
        onLogoClick={onBack}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main id="maincontent" tabIndex={-1} className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          title="Account Settings"
          badgeLabel="Profile"
          onLogout={onLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          currentView="profile"
          onNavigateToInbox={user.role === 'guard' ? onBack : undefined}
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
        />

        <div className="soc-scroll-area flex-1 overflow-y-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] md:p-6">
          <ProfileModalContent user={user} mode="page" onProfilePhotoUpdate={onProfilePhotoUpdate} />
        </div>
      </main>
    </div>
  )
}

export default ProfileDashboard
