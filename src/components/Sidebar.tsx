import { CSSProperties, FC, useEffect, useMemo, useRef, useState } from 'react'
import {
  Award,
  BarChart3,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CarFront,
  ClipboardCheck,
  ChevronDown,
  FileSearch,
  FileUp,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Map,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  Route,
  Settings,
  Shield,
  Target,
  TrendingUp,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
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

const navIcons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  overview: LayoutDashboard,
  feedback: MessageSquareText,
  'feedback-dashboard': MessageSquareText,
  approvals: ClipboardCheck,
  calendar: CalendarDays,
  analytics: BarChart3,
  audit: FileSearch,
  'audit-log': FileSearch,
  trips: Route,
  schedule: CalendarClock,
  missions: Target,
  performance: TrendingUp,
  merit: Award,
  manage: UsersRound,
  'operations-map': Map,
  firearms: Shield,
  'firearm-compliance': BadgeCheck,
  'guard-compliance': BadgeCheck,
  allocation: PackageCheck,
  permits: KeyRound,
  maintenance: Wrench,
  'armored-cars': CarFront,
  settings: Settings,
  support: LifeBuoy,
  'mdr-import': FileUp,
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
  const SIDEBAR_GROUPS_STORAGE_KEY = 'dasi.sidebar.collapsed-groups'
  const asideRef = useRef<HTMLElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const previousActiveGroupRef = useRef<string | undefined>(undefined)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const defaultGroups = { Intelligence: true, Resources: true, System: true }

    if (typeof window === 'undefined') {
      return defaultGroups
    }

    try {
      const saved = window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY)
      return saved ? { ...defaultGroups, ...JSON.parse(saved) } : defaultGroups
    } catch {
      return defaultGroups
    }
  })
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

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(collapsedGroups))
    } catch {
      // Ignore storage failures and keep the navigation state in memory.
    }
  }, [collapsedGroups])

  useEffect(() => {
    const activeGroup = items.find((item) => item.view === activeView)?.group
    const previousActiveGroup = previousActiveGroupRef.current
    const shouldOpenActiveGroup = activeGroup != null && previousActiveGroup !== activeGroup

    previousActiveGroupRef.current = activeGroup

    if (!shouldOpenActiveGroup) return

    setCollapsedGroups((previous) => (
      previous[activeGroup] ? { ...previous, [activeGroup]: false } : previous
    ))
  }, [activeView, items])

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
                    <button
                      type="button"
                      className={`flex min-h-11 w-full items-center justify-between px-3 py-2 text-left soc-sidebar-heading text-[11px] font-bold uppercase tracking-[0.2em] ${collapsed ? 'lg:hidden' : ''}`}
                      onClick={() => setCollapsedGroups((previous) => ({ ...previous, [groupName]: !previous[groupName] }))}
                      aria-expanded={collapsed ? true : !collapsedGroups[groupName]}
                      aria-controls={`sidebar-group-${groupName.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span>{groupName}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${collapsedGroups[groupName] && !collapsed ? '-rotate-90' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                  <div
                    id={groupName ? `sidebar-group-${groupName.toLowerCase().replace(/\s+/g, '-')}` : undefined}
                    className={`flex flex-col gap-1 ${collapsedGroups[groupName] && !collapsed ? 'hidden' : ''}`}
                  >
                    {grouped[groupName].map(({ view, label }) => {
                      const Icon = navIcons[view] || MapPinned
                      return (
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
                            <Icon className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
                            <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                          </span>
                        </button>
                      )
                    })}
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
