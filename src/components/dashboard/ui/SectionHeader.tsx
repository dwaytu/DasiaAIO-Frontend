import { FC, ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

const SectionHeader: FC<SectionHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <header className="mb-4 flex flex-col gap-3 border-b border-border-subtle pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="soc-section-title">{title}</h2>
        {subtitle ? <p className="soc-body mt-1 text-text-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export default SectionHeader
