import { FC, useState, useEffect, useRef } from 'react'
import { User } from '../App'

interface AccountManagerProps {
  user: User
  onLogout: () => void
  onNavigateToProfile?: () => void
}

const AccountManager: FC<AccountManagerProps> = ({ user, onLogout, onNavigateToProfile }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Get user initials for avatar
  const getInitials = () => {
    if (user.fullName) {
      const names = user.fullName.split(' ')
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return user.fullName.substring(0, 2).toUpperCase()
    }
    return user.username.substring(0, 2).toUpperCase()
  }

  // Get role badge color
  const getRoleBadgeColor = () => {
    switch (user.role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      case 'user':
        return 'bg-green-100 text-green-800'
      case 'guard':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleRefresh = () => {
    window.location.reload()
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 md:gap-3 hover:bg-gray-100 rounded-lg px-2 md:px-3 py-2 transition-colors group"
      >
        {/* Avatar */}
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md group-hover:shadow-lg transition-shadow overflow-hidden">
          {user.profilePhoto ? (
            <img src={user.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            getInitials()
          )}
        </div>
        
        {/* User Info - Hidden on mobile */}
        <div className="hidden md:flex flex-col items-start">
          <span className="text-sm font-semibold text-gray-900">{user.fullName || user.username}</span>
          <span className="text-xs text-gray-500 capitalize">{user.role}</span>
        </div>

        {/* Chevron */}
        <svg 
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 animate-fadeIn">
          {/* Profile Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
          {/* Large Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md overflow-hidden">
            {user.profilePhoto ? (
              <img src={user.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              getInitials()
            )}
          </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-base">{user.fullName || user.username}</h3>
                <p className="text-sm text-gray-500">{user.email}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getRoleBadgeColor()}`}>
                  {user.role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="px-4 py-3 border-b border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Account Details</h4>
            
            {user.phoneNumber && (
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-sm text-gray-700">{user.phoneNumber}</span>
              </div>
            )}

            {user.licenseNumber && (
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-gray-700">License: {user.licenseNumber}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm text-gray-700">ID: {user.id.substring(0, 8)}...</span>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            {onNavigateToProfile && (
              <button
                onClick={() => {
                  onNavigateToProfile()
                  setIsOpen(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>My Profile</span>
              </button>
            )}

            <button
              onClick={handleRefresh}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Page</span>
            </button>

            <button
              onClick={onLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountManager
