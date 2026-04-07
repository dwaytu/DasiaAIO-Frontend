import { FC, Ref, useMemo, useState } from 'react'
import type { User } from '../context/AuthContext'

interface AccountManagerProps {
  user: User
  onLogout: () => void
  onNavigateToProfile?: () => void
  isOpen?: boolean
  onToggle?: () => void
  onClose?: () => void
  buttonRef?: Ref<HTMLButtonElement>
}

const AccountManager: FC<AccountManagerProps> = ({ user, onLogout, onNavigateToProfile, isOpen, onToggle, onClose, buttonRef }) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const resolvedOpen = isOpen ?? internalOpen

  const setOpen = (next: boolean) => {
    if (typeof isOpen === 'boolean') {
      if (next) {
        onToggle?.()
      } else {
        onClose?.()
      }
      return
    }

    setInternalOpen(next)
  }

  const initials = useMemo(() => {
    if (user.fullName) {
      const names = user.fullName.split(' ')
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return user.fullName.substring(0, 2).toUpperCase()
    }
    return user.username.substring(0, 2).toUpperCase()
  }, [user.fullName, user.username])

  const getRoleBadgeClass = () => {
    switch (user.role) {
      case 'admin':
        return 'soc-role-chip soc-role-chip-admin'
      case 'guard':
        return 'soc-role-chip soc-role-chip-guard'
      default:
        return 'soc-role-chip'
    }
  }

  return (
    <div className="relative z-[var(--z-floating)]">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!resolvedOpen)}
        className={`group flex min-h-11 items-center gap-2 rounded px-2 py-2 transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)] md:gap-3 md:px-3 ${resolvedOpen ? 'bg-surface-hover' : ''}`}
        aria-label="Open profile menu"
        aria-expanded={resolvedOpen}
      >
        <div className="soc-avatar-gradient w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md overflow-hidden flex-shrink-0">
          {user.profilePhoto ? (
            <img src={user.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>

        <svg 
          className={`w-4 h-4 text-text-secondary transition-transform ${resolvedOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {resolvedOpen && (
        <div className="soc-dropdown-surface absolute right-0 z-[var(--z-floating)] mt-2 w-72 max-w-[calc(100vw-1rem)] rounded py-2 animate-fade-in md:w-80" role="dialog" aria-label="Profile menu">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="soc-avatar-gradient w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md overflow-hidden flex-shrink-0">
                {user.profilePhoto ? (
                  <img src={user.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate text-text-primary">{user.fullName || user.username}</h3>
                <p className="text-xs truncate text-text-secondary">{user.email}</p>
                <span className={getRoleBadgeClass()}>
                  {user.role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="py-1">
            {onNavigateToProfile && (
              <button
                onClick={() => {
                  onNavigateToProfile()
                  onClose?.()
                  if (typeof isOpen !== 'boolean') {
                    setInternalOpen(false)
                  }
                }}
                className="soc-menu-item w-full px-4 py-2 text-left text-sm flex items-center gap-3"
              >
                <svg className="w-4 h-4 soc-icon-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>My Profile</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose?.()
                if (typeof isOpen !== 'boolean') {
                  setInternalOpen(false)
                }
                onLogout()
              }}
              className="soc-menu-item soc-menu-item-danger w-full px-4 py-2 text-left text-sm flex items-center gap-3 font-semibold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
