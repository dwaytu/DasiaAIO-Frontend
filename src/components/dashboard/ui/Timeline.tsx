import { FC } from 'react'
import { Shield, Truck, Target, Wrench } from 'lucide-react'
import DashboardCard from './DashboardCard'

type TimelineType = 'shift' | 'trip' | 'mission' | 'maintenance'

interface TimelineItem {
  id: string
  title: string
  startLabel: string
  endLabel?: string
  type: TimelineType
  intensity?: number
}

interface TimelineProps {
  title?: string
  items: TimelineItem[]
}

const toneClass: Record<TimelineType, string> = {
  shift: 'tone-guard-surface',
  trip: 'tone-vehicle-surface',
  mission: 'tone-mission-surface',
  maintenance: 'tone-maintenance-surface',
}

const typeIcon: Record<TimelineType, JSX.Element> = {
  shift: <Shield className="h-3.5 w-3.5" aria-hidden="true" />,
  trip: <Truck className="h-3.5 w-3.5" aria-hidden="true" />,
  mission: <Target className="h-3.5 w-3.5" aria-hidden="true" />,
  maintenance: <Wrench className="h-3.5 w-3.5" aria-hidden="true" />,
}

const Timeline: FC<TimelineProps> = ({ title = 'Activity Timeline', items }) => {
  return (
    <DashboardCard title={title}>
      {items.length === 0 ? (
        <p className="soc-empty-state">No events scheduled today.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const width = Math.max(24, Math.min(100, item.intensity ?? 62))
            return (
              <article key={item.id} className="rounded-md border border-border-subtle bg-surface-elevated p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                    {typeIcon[item.type]}
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">{item.startLabel}{item.endLabel ? ` - ${item.endLabel}` : ''}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-border-subtle">
                  <div className={`h-2.5 rounded-full ${toneClass[item.type]}`} style={{ width: `${width}%` }} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </DashboardCard>
  )
}

export default Timeline
