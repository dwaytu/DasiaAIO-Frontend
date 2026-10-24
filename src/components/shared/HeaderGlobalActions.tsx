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
  onNavigateToSettings?: () => void
  extraAction?: ReactNode
  profileButtonRef?: Ref<HTMLButtonElement>
  guardMode?: boolean
  commandPaletteTrigger?: ReactNode
  tacticalAlertActive?: boolean
  onNavigateToTacticalAlert?: () => void
}

const HeaderGlobalActions: FC<HeaderGlobalActionsProps> = ({
  user,
  onLogout,
  onNavigateToProfile,
  onNavigateToInbox,
  onNavigateToSettings,
  extraAction,
  profileButtonRef,
  guardMode,
  commandPaletteTrigger,
  tacticalAlertActive = false,
  onNavigateToTacticalAlert,
}) => {
  const { rootRef, toggleOverlay, closeOverlay, isOverlayOpen } = useOverlayController<'inbox' | 'profile'>()

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-1.5 md:gap-2">
      {!guardMode ? <ThemeToggleButton className="flex" /> : null}
      {!guardMode ? extraAction : null}
      {!guardMode ? commandPaletteTrigger : null}
      {tacticalAlertActive ? (
        <button
          type="button"
          onClick={onNavigateToTacticalAlert}
          className="hidden min-h-9 items-center rounded-full border border-danger-border bg-danger-bg px-2 text-[10px] font-bold tracking-wide text-danger-text ring-2 ring-danger/60 animate-pulse md:inline-flex"
        >
          TACTICAL ALERT
        </button>
      ) : null}

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
        onNavigateToSettings={onNavigateToSettings}
        isOpen={isOverlayOpen('profile')}
        onToggle={() => toggleOverlay('profile')}
        onClose={closeOverlay}
        buttonRef={profileButtonRef}
      />
    </div>
  )
}

export default HeaderGlobalActions
