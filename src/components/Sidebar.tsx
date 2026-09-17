import { CSSProperties, FC, useEffect, useMemo, useRef } from 'react'
import { LogOut } from 'lucide-react'
import SidebarBrand from './SidebarBrand'
import { useServiceHealth } from '../hooks/useServiceHealth'

export interface SidebarItem {
  view: string
  label: string
  group?: string
}

interface SidebarProps {
  items: SidebarItem[]
  activeView: string
  onNavigate: (view: string) => void
  onLogout: () => void
  onLogoClick?: () => void
  isOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
  onToggle?: () => void
}

const navGlyphs: Record<string, string> = {
  dashboard: 'DG',
  overview: 'DG',
  feedback: 'FB',
  'feedback-dashboard': 'FD',
  approvals: 'AP',
  calendar: 'CL',
  analytics: 'AN',
  audit: 'AU',
  'audit-log': 'AL',
  trips: 'TR',
  schedule: 'SC',
  missions: 'MS',
  performance: 'PF',
  merit: 'MR',
  manage: 'MG',
  'operations-map': 'OM',
  firearms: 'FA',
  'guard-compliance': 'GC',
  allocation: 'AS',
  permits: 'PM',
  maintenance: 'MT',
  'armored-cars': 'AC',
  settings: 'ST',
  support: 'CT',
  'mdr-import': 'MD',
}

const Sidebar: FC<SidebarProps> = ({
  items,
  activeView,
  onNavigate,
  onLogout,
  onLogoClick,
  isOpen = true,
  onClose,
  collapsed = false,
}) => {
  const asideRef = useRef<HTMLElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const scrollStorageKey = 'dasi.sidebar.scrollTop'
  const { services } = useServiceHealth()
  const desktopSidebarWidth = collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)'
  const sidebarStyle: CSSProperties & Record<string, string> = {
    paddingTop: 'env(safe-area-inset-top, 0px)',
    '--sidebar-width': desktopSidebarWidth,
  }

  const systemStatus = useMemo<'operational' | 'degraded' | 'critical'>(() => {
    const statuses = [
      services.database,
      services.apiGateway,
      services.monitoringNodes,
      services.vehicleTelemetry,
      services.authenticationService,
    ]
    const offlineCount = statuses.filter((status) => status === 'offline').length

    if (offlineCount >= 3) return 'critical'
    if (offlineCount >= 1) return 'degraded'
    return 'operational'
  }, [services])

  useEffect(() => {
    const savedScroll = window.sessionStorage.getItem(scrollStorageKey)
    const target = navRef.current || asideRef.current
    if (!target || !savedScroll) return

    target.scrollTop = Number(savedScroll) || 0
  }, [])

  useEffect(() => {
    if (!isOpen || !onClose || window.matchMedia('(min-width: 1024px)').matches) {
      if (!isOpen && previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
      return
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    navRef.current?.querySelector<HTMLElement>('button, a')?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    const el = navRef.current || asideRef.current
    if (!el) return

    const handleScroll = () => {
      window.sessionStorage.setItem(scrollStorageKey, String(el.scrollTop))
    }

    el.addEventListener('scroll', handleScroll)
    return () => {
      el.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleNavigate = (view: string) => {
    const target = navRef.current || asideRef.current
    if (target) {
      window.sessionStorage.setItem(scrollStorageKey, String(target.scrollTop))
    }
    onNavigate(view)
    // Close sidebar on mobile after navigation
    if (onClose) {
      onClose()
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 z-(--z-drawer-backdrop) bg-black/50 transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-(--z-drawer)
        w-72 lg:w-[var(--sidebar-width)] soc-sidebar-width-transition
        flex flex-col overflow-y-auto shadow-2xl soc-sidebar-shell
        transform transition-transform duration-200 ease-out
        lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} ref={asideRef} style={sidebarStyle}>
        {/* Top accent line */}
        <div className="h-1 w-full soc-sidebar-accent" />

        <div className={`flex flex-1 flex-col overflow-hidden p-4 md:p-6 ${collapsed ? 'lg:px-2 lg:py-4' : 'lg:px-6 lg:py-6'}`}>
          <div className={`mb-4 shrink-0 border-b border-border-subtle pb-4 ${collapsed ? 'lg:flex lg:justify-center' : ''}`}>
            <SidebarBrand
              onClick={onLogoClick}
              compact={collapsed}
              status={systemStatus}
            />
          </div>

          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto" ref={navRef}>
            {(() => {
              const grouped: Record<string, SidebarItem[]> = {}
              items.forEach(item => {
                const g = item.group || ''
                if (!grouped[g]) grouped[g] = []
                grouped[g].push(item)
              })
              const groupOrder = ['Core', 'Intelligence', 'Operations', 'Resources', 'Field', 'System', '']
              const visibleGroups = groupOrder.filter(g => grouped[g]?.length)
              return visibleGroups.map((groupName, index) => (
                <div key={groupName || 'other'} className={`mb-3 ${collapsed ? 'lg:mb-2' : ''}`}>
                  {groupName && (
                    <p className={`soc-sidebar-heading px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.2em] ${collapsed ? 'lg:hidden' : ''}`}>
                      {groupName}
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    {grouped[groupName].map(({ view, label }) => (
                      <button
                        key={view}
                        className={`soc-sidebar-nav-item cursor-pointer select-none px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-wide ${
                          view === activeView ? 'soc-sidebar-nav-item-active' : ''
                        } ${collapsed ? 'lg:px-2 lg:py-2' : ''}`}
                        onClick={() => handleNavigate(view)}
                        type="button"
                        title={collapsed ? label : undefined}
                        aria-label={collapsed ? label : undefined}
                        aria-current={view === activeView ? 'page' : undefined}
                      >
                        <span className={`flex items-center gap-2 ${collapsed ? 'lg:justify-center' : ''}`}>
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border-subtle bg-surface-elevated text-[11px] font-bold tracking-wide text-text-tertiary" aria-hidden="true">
                            {navGlyphs[view] || 'NV'}
                          </span>
                          <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {index < visibleGroups.length - 1 && (
                    <div className={`mt-2 border-t border-border-subtle ${collapsed ? 'lg:hidden' : ''}`} aria-hidden="true" />
                  )}
                </div>
              ))
            })()}
          </nav>

          <button 
            type="button"
            onClick={onLogout} 
            className={`soc-sidebar-logout mt-3 flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm font-semibold uppercase tracking-wide ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
            title={collapsed ? 'Logout' : undefined}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className={collapsed ? 'lg:hidden' : ''}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
