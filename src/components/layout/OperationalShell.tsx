import { FC, ReactNode } from 'react'
import Sidebar, { SidebarItem } from '../Sidebar'
import Header from '../Header'
import { User } from '../../App'

interface OperationalShellProps {
  user: User
  title: string
  badgeLabel?: string
  navItems: SidebarItem[]
  activeView: string
  onNavigate: (view: string) => void
  onLogout: () => void
  mobileMenuOpen: boolean
  onMenuOpen: () => void
  onMenuClose: () => void
  onLogoClick: () => void
  rightSlot?: ReactNode
  error?: string
  children: ReactNode
}

const OperationalShell: FC<OperationalShellProps> = ({
  user,
  title,
  badgeLabel,
  navItems,
  activeView,
  onNavigate,
  onLogout,
  mobileMenuOpen,
  onMenuOpen,
  onMenuClose,
  onLogoClick,
  rightSlot,
  error,
  children,
}) => {
  return (
    <div className="flex min-h-screen w-full bg-background font-sans">
      <a href="#maincontent" className="skip-link">Skip to main content</a>
      <Sidebar
        items={navItems}
        activeView={activeView}
        onNavigate={onNavigate}
        onLogoClick={onLogoClick}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={onMenuClose}
      />

      <main id="maincontent" tabIndex={-1} className="flex-1 flex min-w-0 flex-col overflow-hidden">
        <Header
          title={title}
          badgeLabel={badgeLabel}
          onLogout={onLogout}
          onMenuClick={onMenuOpen}
          user={user}
          onNavigateToProfile={() => onNavigate('profile')}
          rightSlot={rightSlot}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">{error}</div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}

export default OperationalShell
