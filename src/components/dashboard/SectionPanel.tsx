import { FC, ReactNode } from 'react'

interface SectionPanelProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

const SectionPanel: FC<SectionPanelProps> = ({ title, subtitle, actions, children }) => {
  return (
    <section className="w-full rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 border-b border-border-subtle pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export default SectionPanel
