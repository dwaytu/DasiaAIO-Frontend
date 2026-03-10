import { FC } from 'react'

export interface MissionTimelineItem {
  id: string
  title: string
  detail: string
  time: string
  state: 'completed' | 'active' | 'queued'
}

interface MissionTimelinePanelProps {
  items: MissionTimelineItem[]
}

const stateClass: Record<MissionTimelineItem['state'], string> = {
  completed: 'text-success-text',
  active: 'text-info-text',
  queued: 'text-warning-text',
}

const dotClass: Record<MissionTimelineItem['state'], string> = {
  completed: 'status-light status-light-success',
  active: 'status-light status-light-info status-light-pulse',
  queued: 'status-light status-light-warning',
}

const MissionTimelinePanel: FC<MissionTimelinePanelProps> = ({ items }) => {
  return (
    <section className="command-panel p-4 md:p-5" aria-label="Mission timeline">
      <div className="mb-4 border-b border-border-subtle pb-3">
        <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Mission Timeline</h3>
        <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Live mission progression and checkpoints</p>
      </div>

      <ol className="space-y-3">
        {items.length === 0 ? (
          <li className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No mission timeline entries available.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="relative rounded-lg border border-border-subtle bg-surface-elevated p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={dotClass[item.state]} aria-hidden="true" />
                  <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${stateClass[item.state]}`}>{item.state}</p>
                </div>
                <time className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{item.time}</time>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-text-primary">{item.title}</p>
              <p className="mt-1 text-xs text-text-secondary">{item.detail}</p>
            </li>
          ))
        )}
      </ol>
    </section>
  )
}

export default MissionTimelinePanel
