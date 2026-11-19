import { FC } from 'react'
import type { OpsShift } from '../../hooks/useOpsShifts'

interface TodaysShiftOperationsProps {
  shifts: OpsShift[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const statusTone: Record<string, string> = {
  in_progress: 'soc-status-success',
  scheduled: 'soc-status-info',
  completed: 'soc-status-neutral',
  absent: 'soc-status-danger',
  no_show: 'soc-status-danger',
}

const normalizeStatus = (value: string | undefined): string => (value || 'scheduled').toLowerCase()
const manilaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila' })

const TodaysShiftOperations: FC<TodaysShiftOperationsProps> = ({
  shifts,
  loading = false,
  error = '',
  lastUpdated,
}) => {
  const today = manilaDate.format(new Date())
  const todaysShifts = shifts
    .filter((shift) => {
      const start = new Date(shift.start_time || shift.startTime || '')
      const end = new Date(shift.end_time || '')
      if (!Number.isFinite(start.getTime())) return false
      const startDate = manilaDate.format(start)
      return startDate === today || (startDate < today && Number.isFinite(end.getTime()) && manilaDate.format(end) >= today)
    })
    .sort((left, right) => Number(Boolean(right.missed_check_in)) - Number(Boolean(left.missed_check_in)))
    .slice(0, 8)

  return (
    <section className="command-panel rounded border border-(--color-border) bg-(--color-surface)" aria-label="Today's shift operations">
      <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-(--color-text)">Today's Shifts</p>
          <p className="font-mono text-[11px] text-(--color-muted-text)">Operational assignments and current guard status</p>
        </div>
        {lastUpdated && <span className="font-mono text-[11px] text-(--color-muted-text)">Updated {lastUpdated}</span>}
      </div>

      <div className="px-4 py-3" role="region" aria-live="polite">
        {loading && <p className="text-center font-mono text-xs text-(--color-muted-text)">Loading today's shifts...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-danger-text">
            {error}
          </p>
        )}

        {!loading && !error && todaysShifts.length === 0 && (
          <p className="text-center font-mono text-xs text-(--color-muted-text)">No shifts scheduled for today.</p>
        )}

        {!loading && !error && todaysShifts.length > 0 && (
          <ul className="space-y-2" role="list">
            {todaysShifts.map((shift, index) => {
              const guardName = shift.guard_name || shift.guard_username || 'Unassigned guard'
              const siteName = shift.client_site || shift.site_name || 'Unassigned site'
              const status = normalizeStatus(shift.status)
              const statusLabel = shift.missed_check_in ? 'Missed check-in' : status.replace('_', ' ')
              const tone = shift.missed_check_in ? 'soc-status-warning' : statusTone[status] || statusTone.scheduled
              const startSource = shift.start_time || shift.startTime
              const timeLabel = startSource
                ? new Date(startSource).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })
                : 'TBD'

              return (
                <li key={shift.id || `${guardName}-${siteName}-${index}`} className="rounded-md border border-(--color-border)/60 bg-(--color-bg)/30 px-3 py-2 shadow-inner shadow-black/20 transition-colors hover:bg-(--color-surface-elevated)">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-(--color-text)">{guardName}</p>
                      <p className="truncate font-mono text-[11px] text-(--color-muted-text)">{siteName}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase ${tone}`}>
                        {statusLabel}
                      </span>
                      <p className="mt-1 font-mono text-[11px] text-(--color-muted-text)">Start {timeLabel}</p>
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
