import { FC, useEffect, useState } from 'react'
import type { User } from '../../context/AuthContext'
import NotificationSettingsSection from './NotificationSettingsSection'
import SettingsDashboard from './SettingsDashboard'
import {
  defaultNotificationSettings,
  defaultSupervisorAlertSettings,
  loadRoleSettings,
  NotificationSettings,
  saveRoleSettings,
  SupervisorAlertSettings,
} from './settingsStorage'
import { useRoleSettingsRole } from './useRoleSettings'

type SupervisorSettingsProps = {
  user: User
  compact?: boolean
}

export const SupervisorSettings: FC<SupervisorSettingsProps> = ({ user, compact = false }) => {
  const role = useRoleSettingsRole(user.role)
  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    loadRoleSettings(role, 'notifications', defaultNotificationSettings),
  )
  const [supervisorAlerts, setSupervisorAlerts] = useState<SupervisorAlertSettings>(() =>
    loadRoleSettings(role, 'supervisor', defaultSupervisorAlertSettings),
  )

  useEffect(() => {
    saveRoleSettings(role, 'notifications', notifications)
  }, [notifications, role])

  useEffect(() => {
    saveRoleSettings(role, 'supervisor', supervisorAlerts)
  }, [role, supervisorAlerts])

  const toggleSupervisorAlert = (key: keyof SupervisorAlertSettings) => {
    setSupervisorAlerts((previous) => ({
      ...previous,
      [key]: !previous[key],
    }))
  }

  return (
    <SettingsDashboard
      title="Supervisor Settings"
      description="Tune notification flow for approvals, incident escalations, and shift oversight without changing the current RBAC model."
      compact={compact}
    >
      <NotificationSettingsSection settings={notifications} onChange={setNotifications} />

      <section className="command-panel p-4 md:p-6" aria-labelledby="supervisor-controls-title">
        <h2 id="supervisor-controls-title" className="text-xl font-bold text-text-primary md:text-2xl">
          Supervisor Controls
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Choose which higher-priority operational workflows surface immediately inside your dashboards.
        </p>

        <div className="mt-4 space-y-3">
          {[
            {
              key: 'approvalQueue' as const,
              title: 'Approval queue alerts',
              description: 'Raise a visible alert when guard approvals require action.',
            },
            {
              key: 'incidentEscalations' as const,
              title: 'Incident escalation alerts',
              description: 'Show urgent incident escalations before lower-priority operational updates.',
            },
          ].map((row) => {
            const checked = supervisorAlerts[row.key]

            return (
              <div key={row.key} className="flex items-center justify-between gap-4 rounded border border-border bg-surface p-4">
                <div>
                  <p className="font-semibold text-text-primary">{row.title}</p>
                  <p className="text-xs text-text-secondary">{row.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={row.title}
                  onClick={() => toggleSupervisorAlert(row.key)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
                    checked ? 'bg-indigo-500' : 'bg-zinc-500'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      checked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </SettingsDashboard>
  )
}

export default SupervisorSettings