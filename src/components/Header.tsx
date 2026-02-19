import { FC, ReactNode } from 'react'
import SectionBadge from './SectionBadge'

interface HeaderProps {
  title: string
  badgeLabel?: string
  onLogout: () => void
  rightSlot?: ReactNode
}

const Header: FC<HeaderProps> = ({ title, badgeLabel, onLogout, rightSlot }) => {
  return (
    <header className="bg-white px-8 py-6 flex justify-between items-center shadow-sm border-b border-gray-200">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-gray-900 m-0">{title}</h1>
        {badgeLabel && <SectionBadge label={badgeLabel} />}
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        <button
          onClick={onLogout}
          className="bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5"
        >
          Logout
        </button>
      </div>
    </header>
  )
}

export default Header
