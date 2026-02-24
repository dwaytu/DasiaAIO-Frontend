import { FC } from 'react'
import Logo from './Logo'

export interface SidebarItem {
  view: string
  label: string
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
        w-64 bg-gradient-to-b from-indigo-600 to-purple-900 text-white p-6 md:p-8 flex flex-col shadow-lg
        transform transition-transform duration-300 ease-in-out
        lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Close button for mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <div className="pb-6 border-b border-white/20 mb-8 flex-shrink-0">
          <Logo onClick={onLogoClick} size="sm" horizontal={true} />
        </div>
        <nav className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2 min-h-0">
          {items.map(({ view, label }) => (
            <button
              key={view}
              className={`text-white px-4 py-3 rounded-lg text-left font-medium transition-all duration-300 hover:translate-x-1 cursor-pointer select-none active:scale-95 ${
                view === activeView
                  ? 'bg-white/30 border-l-4 border-yellow-400 pl-3'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              onClick={() => {
                console.log('Sidebar button clicked:', view, label);
                handleNavigate(view)
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <button 
          onClick={onLogout} 
          className="bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 text-white px-4 py-3 rounded-lg font-semibold mt-6 transition-colors cursor-pointer flex-shrink-0"
        >
          Logout
        </button>
      </aside>
    </>
  )
}

export default Sidebar
