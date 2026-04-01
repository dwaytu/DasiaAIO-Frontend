import { FC, useEffect, useMemo, useRef } from 'react'
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
}

const navGlyphs: Record<string, string> = {
  dashboard: 'DG',
  overview: 'DG',
  approvals: 'AP',
  calendar: 'CL',
  analytics: 'AN',
  'audit-log': 'AL',
  trips: 'TR',
  schedule: 'SC',
  missions: 'MS',
  performance: 'PF',
  merit: 'MR',
  firearms: 'FA',
  allocation: 'AS',
  permits: 'PM',
  maintenance: 'MT',
  'armored-cars': 'AC',
  support: 'CT',
}

const Sidebar: FC<SidebarProps> = ({ items, activeView, onNavigate, onLogout, onLogoClick, isOpen = true, onClose }) => {
  const asideRef = useRef<HTMLElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const scrollStorageKey = 'dasi.sidebar.scrollTop'
  const { services } = useServiceHealth()

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
          className="fixed inset-0 z-[44] bg-black/50 transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[48]
        w-72 flex flex-col overflow-y-auto shadow-2xl soc-sidebar-shell
        transform transition-transform duration-200 ease-out
        lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} ref={asideRef}>
        {/* Top accent line */}
        <div className="h-1 w-full soc-sidebar-accent" />

        <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
          {/* Close button for mobile */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 min-h-11 min-w-11 rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)] lg:hidden"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          <div className="mb-4 flex-shrink-0 border-b border-border-subtle pb-4">
            <SidebarBrand
              onClick={onLogoClick}
              compact={false}
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
              const groupOrder = ['MAIN MENU', 'OPERATIONS', 'RESOURCES', '']
              const visibleGroups = groupOrder.filter(g => grouped[g]?.length)
              return visibleGroups.map((groupName, index) => (
                <div key={groupName || 'other'} className="mb-3">
                  {groupName && (
                    <p className="soc-sidebar-heading px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.2em]">
                      {groupName}
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    {grouped[groupName].map(({ view, label }) => (
                      <button
                        key={view}
                        className={`soc-sidebar-nav-item cursor-pointer select-none px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-wide ${
                          view === activeView ? 'soc-sidebar-nav-item-active' : ''
                        }`}
                        onClick={() => handleNavigate(view)}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border-subtle bg-surface-elevated text-[11px] font-bold tracking-wide text-text-tertiary" aria-hidden="true">
                            {navGlyphs[view] || 'NV'}
                          </span>
                          <span>{label}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {index < visibleGroups.length - 1 && (
                    <div className="mt-2 border-t border-border-subtle" aria-hidden="true" />
                  )}
                </div>
              ))
            })()}
          </nav>

          <button 
            type="button"
            onClick={onLogout} 
            className="soc-sidebar-logout mt-3 flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-wide"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Desktop spacer for fixed sidebar */}
      <div className="hidden w-72 flex-shrink-0 lg:block" aria-hidden="true" />
    </>
  )
}

export default Sidebar
