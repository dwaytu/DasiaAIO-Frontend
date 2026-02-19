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
}

const Sidebar: FC<SidebarProps> = ({ items, activeView, onNavigate, onLogout }) => {
  return (
    <aside className="w-64 bg-gradient-to-b from-indigo-600 to-purple-900 text-white p-8 flex flex-col shadow-lg">
      <div className="pb-6 border-b border-white/20 mb-8 flex-shrink-0">
        <Logo />
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
            onClick={() => onNavigate(view)}
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
  )
}

export default Sidebar
