import { FC, ReactNode, useState } from 'react'

interface SectionPanelProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  icon?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
}

const SectionPanel: FC<SectionPanelProps> = ({ title, subtitle, actions, children, icon, collapsible = false, defaultCollapsed = false }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const headingId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`

  return (
    <section className="command-panel w-full p-5 md:p-6" aria-labelledby={headingId}>
      <div className="mb-4 flex flex-col gap-3 border-b border-border-subtle pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {icon && <div className="mt-0.5 rounded-md border border-border-subtle bg-surface p-2 text-text-secondary">{icon}</div>}
          <div>
            <h2 id={headingId} className="text-lg font-bold uppercase tracking-wide text-text-primary">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions && <div className="flex items-center gap-2" aria-label={`${title} actions`}>{actions}</div>}
          {collapsible && (
            <button
              type="button"
              className="min-h-11 rounded-md border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          )}
        </div>
      </div>
      {!collapsed && <div className="space-y-4">{children}</div>}
    </section>
  )
}

export default SectionPanel
