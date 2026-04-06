import { FC, useCallback, useEffect, useState } from 'react'
import { CalendarX2, CheckCircle2, Circle } from 'lucide-react'
import DashboardCard from '../dashboard/ui/DashboardCard'
import EmptyState from '../shared/EmptyState'

interface ShiftItem {
  id: string
  client_site: string
  start_time: string
  end_time: string
  status: string
}

interface OffDutyPanelProps {
  scheduleItems: ShiftItem[]
}

const EQUIPMENT_ITEMS = ['Uniform', 'Flashlight', 'Two-Way Radio', 'ID Badge', 'PPE Kit'] as const
const AVAILABILITY_KEY = 'sentinel_guard_available'
const EQUIPMENT_KEY = 'sentinel_guard_equipment'

function readAvailability(): boolean {
  try {
    return localStorage.getItem(AVAILABILITY_KEY) === 'true'
  } catch {
    return false
  }
}

function readCheckedEquipment(): number[] {
  try {
    const raw = localStorage.getItem(EQUIPMENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'number')) return parsed as number[]
    return []
  } catch {
    return []
  }
}

const OffDutyPanel: FC<OffDutyPanelProps> = ({ scheduleItems }) => {
  const [available, setAvailable] = useState(readAvailability)
  const [checkedItems, setCheckedItems] = useState(readCheckedEquipment)

  useEffect(() => {
    try { localStorage.setItem(AVAILABILITY_KEY, String(available)) } catch { /* noop */ }
  }, [available])

  useEffect(() => {
    try { localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(checkedItems)) } catch { /* noop */ }
  }, [checkedItems])

  const toggleEquipment = useCallback((index: number) => {
    setCheckedItems((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    )
  }, [])

  const upcomingShifts = scheduleItems
    .filter((s) => new Date(s.start_time).getTime() > Date.now())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5)

  const checkedCount = checkedItems.length
  const progressPct = Math.round((checkedCount / EQUIPMENT_ITEMS.length) * 100)

  return (
    <div className="guard-section-frame space-y-4">
      {/* Upcoming Schedule */}
      <DashboardCard title="Upcoming Schedule">
        {upcomingShifts.length > 0 ? (
          <ul className="space-y-2">
            {upcomingShifts.map((shift) => (
              <li
                key={shift.id}
                className="rounded-xl border border-border-subtle bg-surface-elevated p-3"
              >
                <p className="text-sm font-bold text-text-primary">{shift.client_site}</p>
                <p className="text-xs text-text-secondary">
                  {new Date(shift.start_time).toLocaleDateString()} &middot;{' '}
                  {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={CalendarX2}
            title="No shifts scheduled"
            subtitle="Check back later or contact your supervisor."
          />
        )}
      </DashboardCard>

      {/* Availability Toggle */}
      <DashboardCard title="Callout Availability">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={available}
            aria-label="Available for callout"
            onClick={() => setAvailable((prev) => !prev)}
            className={`min-h-11 rounded-lg px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 ${
              available
                ? 'border border-success-border bg-success-bg text-success-text'
                : 'border border-border-subtle bg-surface-elevated text-text-secondary'
            }`}
          >
            {available ? '● Available for callout' : '○ Not available'}
          </button>
        </div>
      </DashboardCard>

      {/* Equipment Checklist */}
      <DashboardCard title="Equipment Checklist">
        <p className="mb-2 text-xs font-semibold text-text-secondary">
          {checkedCount}/{EQUIPMENT_ITEMS.length} items ready
        </p>
        <div
          className="mb-3 h-2 w-full overflow-hidden rounded-full bg-surface-elevated"
          role="progressbar"
          aria-valuenow={checkedCount}
          aria-valuemin={0}
          aria-valuemax={EQUIPMENT_ITEMS.length}
          aria-label="Equipment readiness"
        >
          <div
            className="h-full rounded-full bg-success-text transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <fieldset>
          <legend className="sr-only">Equipment checklist</legend>
          <ul className="space-y-1">
            {EQUIPMENT_ITEMS.map((item, index) => {
              const checked = checkedItems.includes(index)
              const Icon = checked ? CheckCircle2 : Circle
              return (
                <li key={item}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-elevated focus-within:ring-2 focus-within:ring-info">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleEquipment(index)}
                    />
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 ${checked ? 'text-success-text' : 'text-text-tertiary'}`}
                      aria-hidden="true"
                    />
                    <span className={`text-sm font-medium ${checked ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {item}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>
      </DashboardCard>
    </div>
  )
}

export default OffDutyPanel
