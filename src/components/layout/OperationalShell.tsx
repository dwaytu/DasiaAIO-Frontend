import { CSSProperties, FC, ReactNode, useEffect, useMemo, useState } from 'react'
import { Bell, Calendar, ClipboardCheck, LayoutDashboard, MoreHorizontal, X } from 'lucide-react'
import Sidebar, { SidebarItem } from '../Sidebar'
import Header from '../shared/Header'
import type { User } from '../../context/AuthContext'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'dasi.sidebar.collapsed'

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)
  const isElevatedRole = user.role !== 'guard'
  const mobileBottomTabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'approvals', label: 'Approvals', icon: ClipboardCheck },
    { key: 'schedule', label: 'Schedule', icon: Calendar },
    { key: 'inbox', label: 'Alerts', icon: Bell },
  ]

  const moreNavItems = useMemo(() => {
    const bottomTabKeys = new Set(mobileBottomTabs.map((tab) => tab.key))
    return navItems.filter((item) => !bottomTabKeys.has(item.view))
  }, [navItems])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed))
    } catch {
      // Ignore storage failures (private mode, restricted context) and keep in-memory behavior.
    }
  }, [sidebarCollapsed])

  const desktopSidebarWidth = sidebarCollapsed
    ? 'var(--sidebar-width-collapsed)'
    : 'var(--sidebar-width-expanded)'

  const sidebarSpacerStyle: CSSProperties & Record<string, string> = {
    '--sidebar-width': desktopSidebarWidth,
  }

  const handleMenuClick = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setSidebarCollapsed((prev) => !prev)
    } else {
      onMenuOpen()
    }
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <a href="#maincontent" className="skip-link">Skip to main content</a>
      <Sidebar
        items={navItems}
        activeView={activeView}
        onNavigate={onNavigate}
        onLogoClick={onLogoClick}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={onMenuClose}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div
        className="hidden w-72 flex-shrink-0 lg:block lg:w-[var(--sidebar-width)] soc-sidebar-width-transition"
        style={sidebarSpacerStyle}
        aria-hidden="true"
      />

      <main id="maincontent" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          badgeLabel={badgeLabel}
          onLogout={onLogout}
          onMenuClick={handleMenuClick}
          user={user}
          onNavigateToInbox={() => onNavigate('inbox')}
          onNavigateToProfile={() => onNavigate('profile')}
          rightSlot={rightSlot}
        />

        <div
          className={`soc-scroll-area flex-1 min-h-0 overflow-y-auto p-4 ${
            isElevatedRole
              ? 'pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-6'
              : 'pb-[calc(2rem+env(safe-area-inset-bottom,0px))]'
          } md:p-6`}
        >
          {error && (
            <div className="mb-4 rounded border border-danger-border bg-danger-bg p-3 text-sm font-medium text-danger-text">{error}</div>
          )}
          {children}
        </div>
      </main>

      {isElevatedRole ? (
        <>
          {moreDrawerOpen ? (
            <div className="fixed inset-0 z-[63] md:hidden" onClick={() => setMoreDrawerOpen(false)}>
              <div className="absolute inset-0 bg-black/40" />
              <div
                className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-2 right-2 rounded border border-border bg-surface p-2 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-1 flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">More</span>
                  <button
                    type="button"
                    onClick={() => setMoreDrawerOpen(false)}
                    className="p-1 text-text-secondary hover:text-text-primary"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Close menu</span>
                  </button>
                </div>
                <ul className="grid grid-cols-3 gap-1">
                  {moreNavItems.map((item) => (
                    <li key={item.view}>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(item.view)
                          setMoreDrawerOpen(false)
                        }}
                        className="min-h-11 w-full rounded px-2 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <nav
            aria-label="Mobile navigation"
            className="fixed bottom-0 left-0 right-0 z-[var(--z-mobile-nav)] border-t border-border-elevated bg-surface/95 px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] pt-1 backdrop-blur-md md:hidden"
          >
            <ul className="grid grid-cols-5 gap-0.5">
              {mobileBottomTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeView === tab.key
                return (
                  <li key={tab.key}>
                    <button
                      type="button"
                      onClick={() => onNavigate(tab.key)}
                      className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] font-semibold transition-colors ${
                        isActive ? 'text-[var(--color-info)]' : 'text-text-secondary'
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      {tab.label}
                    </button>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setMoreDrawerOpen((prev) => !prev)}
                  className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] font-semibold transition-colors ${
                    moreDrawerOpen ? 'text-[var(--color-info)]' : 'text-text-secondary'
                  }`}
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                  More
                </button>
              </li>
            </ul>
          </nav>
        </>
      ) : null}
    </div>
  )
}

export default OperationalShell
