import { FC } from 'react'
import { MessageSquareText } from 'lucide-react'
import type { User } from '../../context/AuthContext'
import GuardSettings from './GuardSettings'
import SupervisorSettings from './SupervisorSettings'
import AdminSettings from './AdminSettings'
import SuperadminSettings from './SuperadminSettings'
import { useRoleSettingsRole } from './useRoleSettings'

type RoleSettingsContentProps = {
  user: User
  compact?: boolean
  onViewChange?: (view: string) => void
}

export const RoleSettingsContent: FC<RoleSettingsContentProps> = ({ user, compact = false, onViewChange }) => {
  const role = useRoleSettingsRole(user.role)
  const RoleComponent = role === 'superadmin' ? SuperadminSettings : role === 'admin' ? AdminSettings : role === 'supervisor' ? SupervisorSettings : GuardSettings

  return (
    <>
      <RoleComponent user={user} compact={compact} />
      {onViewChange && !compact ? (
        <div className="mx-auto mt-6 max-w-5xl">
          <section className="soc-surface p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-border-subtle bg-surface-elevated p-2 text-text-secondary" aria-hidden="true">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary">Share Feedback</h2>
                  <p className="text-xs text-text-secondary">Help improve SENTINEL by rating your experience</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onViewChange('feedback')}
                className="soc-btn inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm"
              >
                Leave Feedback
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

export default RoleSettingsContent