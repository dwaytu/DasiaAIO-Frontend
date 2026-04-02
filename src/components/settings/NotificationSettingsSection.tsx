import { FC } from 'react'
import { NotificationSettings } from './settingsStorage'

type NotificationSettingsSectionProps = {
  settings: NotificationSettings
  onChange: (next: NotificationSettings) => void
}

type NotificationKey = keyof NotificationSettings

const toggleRows: Array<{ key: NotificationKey; title: string; description: string }> = [
  {
    key: 'push',
    title: 'Push notifications',
    description: 'Receive urgent device alerts while you are signed in on this device.',
  },
  {
    key: 'email',
    title: 'Email notifications',
    description: 'Receive inbox digests and operational updates by email.',
  },
  {
    key: 'inApp',
    title: 'In-app notifications',
    description: 'Keep notification center updates visible inside the dashboard.',
  },
]

export const NotificationSettingsSection: FC<NotificationSettingsSectionProps> = ({ settings, onChange }) => {
  const toggleSetting = (key: NotificationKey) => {
    onChange({
      ...settings,
      [key]: !settings[key],
    })
  }

  return (
    <section className="command-panel p-4 md:p-6" aria-labelledby="notifications-settings-title">
      <h2 id="notifications-settings-title" className="text-xl font-bold text-text-primary md:text-2xl">
        Notifications
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        Control how SENTINEL sends day-to-day status updates and urgent operational alerts.
      </p>

      <div className="mt-4 space-y-3">
        {toggleRows.map((row) => {
          const checked = settings[row.key]

          return (
            <div key={row.key} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="font-semibold text-text-primary">{row.title}</p>
                <p className="text-xs text-text-secondary">{row.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={row.title}
                onClick={() => toggleSetting(row.key)}
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
  )
}

export default NotificationSettingsSection