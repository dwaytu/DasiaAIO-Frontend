import { FC } from 'react'
import SentinelLogo from './SentinelLogo'

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

const Sidebar: FC<SidebarProps> = ({ items, activeView, onNavigate, onLogout, onLogoClick, isOpen = true, onClose }) => {
  const handleNavigate = (view: string) => {
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-72 flex flex-col shadow-2xl
        transform transition-transform duration-300 ease-in-out
        lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)' }}>
        {/* Top accent line */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--color-info), var(--color-accent))' }} />

        <div className="flex flex-col flex-1 p-5 md:p-6 overflow-hidden">
          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden absolute top-4 right-4 p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          <div className="mb-6 flex-shrink-0 rounded-xl border border-border-subtle bg-surface-elevated p-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <button type="button" onClick={onLogoClick} className="w-full text-left" aria-label="Go to dashboard">
              <SentinelLogo size={36} variant="FullLogo" animated />
            </button>
          </div>

          <nav className="flex-1 flex flex-col overflow-y-auto min-h-0">
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
                <div key={groupName || 'other'} className="mb-4">
                  {groupName && (
                    <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-tertiary)', opacity: 0.8 }}>
                      {groupName}
                    </p>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {grouped[groupName].map(({ view, label }) => (
                      <button
                        key={view}
                        className={`px-3 py-2.5 rounded-lg text-left text-sm font-semibold uppercase tracking-wide transition-all duration-200 cursor-pointer select-none ${
                          view === activeView ? 'text-white' : 'hover:text-white'
                        }`}
                        style={view === activeView ? {
                          background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-info) 28%, transparent), color-mix(in srgb, var(--color-accent) 24%, transparent))',
                          color: 'var(--color-text-primary)',
                          borderLeft: '3px solid var(--color-info)',
                          paddingLeft: '10px'
                        } : { color: 'var(--text-secondary)' }}
                          onMouseEnter={e => { if (view !== activeView) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'; }}}
                        onMouseLeave={e => { if (view !== activeView) { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}}
                        onClick={() => handleNavigate(view)}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {index < visibleGroups.length - 1 && (
                    <div className="mt-3 border-t border-border-subtle" aria-hidden="true" />
                  )}
                </div>
              ))
            })()}
          </nav>

          <button 
            onClick={onLogout} 
            className="group mt-4 flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wide transition-all duration-200"
            style={{ color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
