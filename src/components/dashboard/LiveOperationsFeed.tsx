import { FC } from 'react'
import { useOperationalEvent } from '../../context/OperationalEventContext'

export type FeedCategory = 'guard' | 'vehicle' | 'mission' | 'equipment' | 'system'

export interface LiveFeedItem {
  id: string
  category: FeedCategory
  timestamp: string
  description: string
}

interface LiveOperationsFeedProps {
  items: LiveFeedItem[]
}

const categoryStyles: Record<FeedCategory, string> = {
  guard: 'status-bar-success border-success-border bg-success-bg text-success-text',
  vehicle: 'status-bar-info border-info-border bg-info-bg text-info-text',
  mission: 'status-bar-warning border-warning-border bg-warning-bg text-warning-text',
  equipment: 'status-bar-info border-info-border bg-info-bg text-info-text',
  system: 'critical-glow border-danger-border bg-danger-bg text-danger-text',
}

const categoryLabel: Record<FeedCategory, string> = {
  guard: 'Guard Activity',
  vehicle: 'Vehicle Movement',
  mission: 'Mission Update',
  equipment: 'Equipment Allocation',
  system: 'System Alert',
}

const categoryIcon: Record<FeedCategory, JSX.Element> = {
  guard: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  ),
  vehicle: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M7 17v2M17 17v2M3 12h18" />
    </svg>
  ),
  mission: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  ),
  equipment: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 7l3 3-8.5 8.5-3.5 1 1-3.5L14 7z" />
      <path d="M13 4l3 3" />
    </svg>
  ),
  system: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.3L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.3a2 2 0 00-3.4 0z" />
    </svg>
  ),
}

const LiveOperationsFeed: FC<LiveOperationsFeedProps> = ({ items }) => {
  const { selectedEventId, selectEvent } = useOperationalEvent()

  return (
    <section className="command-panel p-4 md:p-5" aria-label="Live operations feed">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div>
          <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Live Operations Feed</h3>
          <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Newest events on top</p>
        </div>
      </div>

      <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No live operations at this time.</p>
        ) : (
          items.map((item, index) => (
            <article
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => selectEvent({ id: item.id, type: item.category === 'mission' || item.category === 'system' ? 'incident' : item.category === 'guard' ? 'guard' : 'vehicle', title: item.description })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectEvent({ id: item.id, type: item.category === 'mission' || item.category === 'system' ? 'incident' : item.category === 'guard' ? 'guard' : 'vehicle', title: item.description }) } }}
              className={`soc-timeline-item soc-animated-entry cursor-pointer rounded-lg border p-3 transition-all duration-200 ${categoryStyles[item.category]} ${selectedEventId === item.id ? 'ring-2 ring-cyan-400' : ''}`}
              style={{ animationDelay: `${index * 70}ms` }}
              aria-pressed={selectedEventId === item.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="mt-0.5">{categoryIcon[item.category]}</span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{categoryLabel[item.category]}</p>
                </div>
                <time className="text-[11px] font-semibold uppercase tracking-wide opacity-90">{item.timestamp}</time>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-text-primary">{item.description}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-85">Operational event stream</p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default LiveOperationsFeed
