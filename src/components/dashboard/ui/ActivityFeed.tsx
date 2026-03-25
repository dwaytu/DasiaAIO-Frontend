import { FC } from 'react'
import DashboardCard from './DashboardCard'

interface ActivityItem {
  id: string
  title: string
  detail: string
  timestamp: string
}

interface ActivityFeedProps {
  title?: string
  items: ActivityItem[]
  emptyLabel?: string
}

const ActivityFeed: FC<ActivityFeedProps> = ({ title = 'Activity Feed', items, emptyLabel = 'No events scheduled today.' }) => {
  return (
    <DashboardCard title={title}>
      {items.length === 0 ? (
        <p className="soc-empty-state">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="soc-timeline-item rounded-md border border-border-subtle bg-surface-elevated p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-text-primary">{item.title}</p>
                <span className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">{item.timestamp}</span>
              </div>
              <p className="mt-1 text-[12px] text-text-secondary">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}

export default ActivityFeed
