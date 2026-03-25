import { FC } from 'react'

interface TodaysShiftOperationsProps {
  shifts: any[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const statusTone: Record<string, string> = {
  in_progress: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  scheduled: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  completed: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
  absent: 'border-red-500/40 bg-red-500/10 text-red-200',
  no_show: 'border-red-500/40 bg-red-500/10 text-red-200',
}

const normalizeStatus = (value: string | undefined): string => (value || 'scheduled').toLowerCase()

const TodaysShiftOperations: FC<TodaysShiftOperationsProps> = ({
  shifts,
  loading = false,
  error = '',
  lastUpdated,
}) => {
  const todaysShifts = shifts
    .filter((shift) => {
      const source = shift.start_time || shift.startTime || shift.date || shift.created_at
      if (!source) return true
      const shiftDate = new Date(source)
      if (Number.isNaN(shiftDate.getTime())) return true
      const now = new Date()
      return shiftDate.toDateString() === now.toDateString()
    })
    .slice(0, 8)

  return (
    <section className="command-panel rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" aria-label="Today's shift operations">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text)]">Today's Shifts</p>
          <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">Operational assignments and current guard status</p>
        </div>
        {lastUpdated && <span className="font-mono text-[10px] text-[color:var(--color-muted-text)]">Updated {lastUpdated}</span>}
      </div>

      <div className="px-4 py-3" role="region" aria-live="polite">
        {loading && <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">Loading today's shifts...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && todaysShifts.length === 0 && (
          <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">No shifts scheduled for today.</p>
        )}

        {!loading && !error && todaysShifts.length > 0 && (
          <ul className="space-y-2" role="list">
            {todaysShifts.map((shift, index) => {
              const guardName = shift.guard_name || shift.guard_username || 'Unassigned guard'
              const siteName = shift.client_site || shift.site_name || 'Unassigned site'
              const status = normalizeStatus(shift.status)
              const tone = statusTone[status] || statusTone.scheduled
              const startSource = shift.start_time || shift.startTime
              const timeLabel = startSource
                ? new Date(startSource).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'TBD'

              return (
                <li key={shift.id || `${guardName}-${siteName}-${index}`} className="rounded-md border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/30 px-3 py-2 shadow-inner shadow-black/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-[color:var(--color-text)]">{guardName}</p>
                      <p className="truncate font-mono text-[10px] text-[color:var(--color-muted-text)]">{siteName}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full border px-2 py-[2px] font-mono text-[10px] uppercase ${tone}`}>
                        {status.replace('_', ' ')}
                      </span>
                      <p className="mt-1 font-mono text-[10px] text-[color:var(--color-muted-text)]">Start {timeLabel}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default TodaysShiftOperations