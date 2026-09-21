import { FC } from 'react'
import { useTheme } from '../../context/ThemeProvider'
import StatusSwitch from './StatusSwitch'

const AppearanceSettingsSection: FC = () => {
  const { theme, setTheme } = useTheme()
  const darkMode = theme === 'dark'
  return (
    <section className="command-panel p-4 md:p-6" aria-labelledby="display-settings-title">
      <h2 id="display-settings-title" className="text-xl font-bold text-text-primary md:text-2xl">Display</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">Set the interface theme used on this device.</p>
      <div className="mt-4 flex items-center justify-between gap-4 rounded border border-border bg-surface p-4">
        <div className="min-w-0"><p className="font-semibold text-text-primary">Dark mode</p><p className="mt-1 text-sm leading-5 text-text-secondary">{darkMode ? 'The dark operational theme is active.' : 'The light theme is active.'}</p></div>
        <StatusSwitch
          checked={darkMode}
          label="Dark mode"
          onToggle={() => setTheme(darkMode ? 'light' : 'dark')}
        />
      </div>
    </section>
  )
}

export default AppearanceSettingsSection
