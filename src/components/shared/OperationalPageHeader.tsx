import { FC, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface OperationalPageHeaderProps {
  eyebrow: string
  title: string
  description: string
  icon?: LucideIcon
  actions?: ReactNode
  status?: ReactNode
}

const OperationalPageHeader: FC<OperationalPageHeaderProps> = ({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  status,
}) => {
  return (
    <header className="border-b border-border-subtle pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row">
          {Icon ? (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-info-border bg-info-bg text-info-text">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="soc-kicker">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-text-primary">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">{description}</p>
            {status ? <div className="mt-3 flex flex-wrap items-center gap-2">{status}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
      </div>
    </header>
  )
}

export default OperationalPageHeader
