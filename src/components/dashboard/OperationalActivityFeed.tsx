import { FC } from 'react'

export type ActivityKind =
  | 'guard_check_in'
  | 'guard_check_out'
  | 'vehicle_dispatched'
  | 'vehicle_returned'
  | 'firearm_issued'
  | 'firearm_returned'
  | 'incident_reported'
  | 'incident_resolved'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  timeLabel: string
  description: string
}

interface OperationalActivityFeedProps {
  items: ActivityItem[]
  title?: string
  subtitle?: string
}

const ICONS: Record<ActivityKind, JSX.Element> = {
  guard_check_in: (
    <svg aria-hidden="true" className="h-4 w-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm-7 9a7 7 0 0 1 14 0Z" />
    </svg>
  ),
  guard_check_out: (
    <svg aria-hidden="true" className="h-4 w-4 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm-7 9a7 7 0 0 1 14 0Z" />
    </svg>
  ),
  vehicle_dispatched: (
    <svg aria-hidden="true" className="h-4 w-4 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2l2-5h9l2 5h1a2 2 0 0 1 2 2v3h-2" />
      <circle cx="7.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  ),
  vehicle_returned: (
    <svg aria-hidden="true" className="h-4 w-4 text-cyan-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2l2-5h9l2 5h1a2 2 0 0 1 2 2v3h-2" />
      <circle cx="7.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  ),
  firearm_issued: (
    <svg aria-hidden="true" className="h-4 w-4 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 10 6-2 3 2 3-1 4 2-2 3-3-1-3 2-4-1Z" />
    </svg>
  ),
  firearm_returned: (
    <svg aria-hidden="true" className="h-4 w-4 text-indigo-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 10 6-2 3 2 3-1 4 2-2 3-3-1-3 2-4-1Z" />
    </svg>
  ),
  incident_reported: (
    <svg aria-hidden="true" className="h-4 w-4 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M4.22 4.22a1 1 0 0 1 1.42 0l13.14 13.14a1 1 0 0 1-1.42 1.42L4.22 5.64a1 1 0 0 1 0-1.42Z" />
    </svg>
  ),
  incident_resolved: (
    <svg aria-hidden="true" className="h-4 w-4 text-green-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  ),
}

const OperationalActivityFeed: FC<OperationalActivityFeedProps> = ({ items, title = 'Operational Activity', subtitle = 'Real-time system events' }) => {
  return (
    <section
      className="command-panel rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-label="Operational Activity Feed"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <svg aria-hidden="true" className="h-4 w-4 text-[color:var(--color-text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M4 12h16M4 19h16" />
          </svg>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text)]">{title}</p>
            <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-h-80 overflow-auto px-3 py-2" role="list" aria-label="Activity events">
        {items.length === 0 && (
          <p className="px-2 py-4 text-center font-mono text-xs text-[color:var(--color-muted-text)]">
            No recent activity.
          </p>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            role="listitem"
            className="flex items-start gap-3 rounded px-2 py-2 hover:bg-[color:var(--color-border)]/40"
          >
            <div className="mt-0.5">{ICONS[item.kind]}</div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">{item.timeLabel}</p>
              <p className="truncate font-mono text-xs text-[color:var(--color-text)]" title={item.description}>
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default OperationalActivityFeed
