import { FC, ReactNode } from 'react'

interface DashboardCardProps {
  title?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}

const DashboardCard: FC<DashboardCardProps> = ({ title, children, className = '', actions }) => {
  return (
    <section className={`soc-dashboard-card ${className}`.trim()}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
          <h3 className="soc-card-title">{title}</h3>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export default DashboardCard
