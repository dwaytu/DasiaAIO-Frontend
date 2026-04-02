import { FC, ReactNode } from 'react'

type SettingsDashboardProps = {
  title: string
  description: string
  children: ReactNode
}

export const SettingsDashboard: FC<SettingsDashboardProps> = ({ title, description, children }) => (
  <div className="mx-auto max-w-5xl space-y-6">
    <section className="soc-surface p-4 md:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Preferences</p>
      <h1 className="mt-1 text-2xl font-bold text-text-primary md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </section>
    {children}
  </div>
)

export default SettingsDashboard