import { FC, ReactNode, Ref } from 'react'
import type { User } from '../../context/AuthContext'
import AccountManager from '../AccountManager'
import NotificationPanel from '../NotificationPanel'
import { ThemeToggleButton } from '../../context/ThemeProvider'
import { useOverlayController } from './useOverlayController'

type HeaderGlobalActionsProps = {
  user: User
  onLogout: () => void
  onNavigateToProfile?: () => void
  onNavigateToInbox?: () => void
  extraAction?: ReactNode
  profileButtonRef?: Ref<HTMLButtonElement>
  guardMode?: boolean
}

const HeaderGlobalActions: FC<HeaderGlobalActionsProps> = ({
  user,
  onLogout,
  onNavigateToProfile,
  onNavigateToInbox,
  extraAction,
  profileButtonRef,
  guardMode,
}) => {
  const { rootRef, toggleOverlay, closeOverlay, isOverlayOpen } = useOverlayController<'inbox' | 'profile'>()

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-1.5 md:gap-2">
      {!guardMode ? <ThemeToggleButton className="flex" /> : null}
      {!guardMode ? extraAction : null}

      <NotificationPanel
        user={user}
        isOpen={isOverlayOpen('inbox')}
        onToggle={() => toggleOverlay('inbox')}
        onClose={closeOverlay}
        onViewAll={() => {
          onNavigateToInbox?.()
          closeOverlay()
        }}
      />

      <AccountManager
        user={user}
        onLogout={onLogout}
        onNavigateToProfile={onNavigateToProfile}
        isOpen={isOverlayOpen('profile')}
        onToggle={() => toggleOverlay('profile')}
        onClose={closeOverlay}
        buttonRef={profileButtonRef}
      />
    </div>
  )
}

export default HeaderGlobalActions