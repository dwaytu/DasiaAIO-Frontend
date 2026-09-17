import { FC, useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarX2, CheckCircle2, Circle } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import DashboardCard from '../dashboard/ui/DashboardCard'
import EmptyState from '../shared/EmptyState'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'

interface ShiftItem {
  id: string
  client_site: string
  start_time: string
  end_time: string
  status: string
}

interface OffDutyPanelProps {
  scheduleItems: ShiftItem[]
  guardId: string
}

const READINESS_ITEMS = [
  { key: 'uniform', label: 'Uniform' },
  { key: 'firearm', label: 'Firearm' },
  { key: 'endorsement_form', label: 'Endorsement Form' },
] as const

interface AvailabilityResponse {
  available?: boolean
}

interface ReadinessResponse {
  checkedItems?: string[]
  updatedAt?: string | null
}

function getRequestMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatShift(shift: ShiftItem): string {
  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return shift.client_site

  return `${shift.client_site} - ${start.toLocaleDateString()} ${start.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })} to ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

const OffDutyPanel: FC<OffDutyPanelProps> = ({ scheduleItems, guardId }) => {
  const [available, setAvailable] = useState(true)
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [checkedItems, setCheckedItems] = useState<string[]>([])
  const [readinessLoading, setReadinessLoading] = useState(false)
  const [readinessSaving, setReadinessSaving] = useState(false)
  const [message, setMessage] = useState('')

  const upcomingShifts = useMemo(
    () =>
      scheduleItems
        .filter((shift) => new Date(shift.start_time).getTime() > Date.now())
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5),
    [scheduleItems],
  )

  useEffect(() => {
    if (!upcomingShifts.some((shift) => shift.id === selectedShiftId)) {
      setSelectedShiftId(upcomingShifts[0]?.id || '')
    }
  }, [selectedShiftId, upcomingShifts])

  useEffect(() => {
    const controller = new AbortController()

    const loadAvailability = async () => {
      setAvailabilityLoading(true)
      try {
        const data = await fetchJsonOrThrow<AvailabilityResponse>(
          `${API_BASE_URL}/api/guard-replacement/availability/${guardId}`,
          { headers: getAuthHeaders(), signal: controller.signal },
          'Unable to load callout availability.',
        )
        if (!controller.signal.aborted) setAvailable(data.available ?? true)
      } catch (error) {
        if (!controller.signal.aborted) setMessage(getRequestMessage(error, 'Unable to load callout availability.'))
      } finally {
        if (!controller.signal.aborted) setAvailabilityLoading(false)
      }
    }

    void loadAvailability()
    return () => controller.abort()
  }, [guardId])

  useEffect(() => {
    if (!selectedShiftId) {
      setCheckedItems([])
      setReadinessLoading(false)
      return undefined
    }

    const controller = new AbortController()
    const loadReadiness = async () => {
      setReadinessLoading(true)
      try {
        const data = await fetchJsonOrThrow<ReadinessResponse>(
          `${API_BASE_URL}/api/guard-replacement/guard/${guardId}/readiness?shiftId=${encodeURIComponent(selectedShiftId)}`,
          { headers: getAuthHeaders(), signal: controller.signal },
          'Unable to load shift readiness.',
        )
        if (!controller.signal.aborted) setCheckedItems(data.checkedItems || [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setCheckedItems([])
          setMessage(getRequestMessage(error, 'Unable to load shift readiness.'))
        }
      } finally {
        if (!controller.signal.aborted) setReadinessLoading(false)
      }
    }

    void loadReadiness()
    return () => controller.abort()
  }, [guardId, selectedShiftId])

  const handleToggleAvailability = useCallback(async () => {
    setAvailabilityLoading(true)
    const nextAvailability = !available
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/guard-replacement/set-availability`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ guardId, available: nextAvailability }),
        },
        'Unable to update callout availability.',
      )
      setAvailable(nextAvailability)
      setMessage(nextAvailability ? 'Available for callout.' : 'Marked unavailable for callout.')
    } catch (error) {
      setMessage(getRequestMessage(error, 'Unable to update callout availability.'))
    } finally {
      setAvailabilityLoading(false)
    }
  }, [available, guardId])

  const toggleEquipment = useCallback(
    async (key: string) => {
      if (!selectedShiftId || readinessSaving) return

      const previousItems = checkedItems
      const nextItems = previousItems.includes(key)
        ? previousItems.filter((item) => item !== key)
        : [...previousItems, key]
      setCheckedItems(nextItems)
      setReadinessSaving(true)

      try {
        await fetchJsonOrThrow(
          `${API_BASE_URL}/api/guard-replacement/readiness`,
          {
            method: 'PUT',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ guardId, shiftId: selectedShiftId, checkedItems: nextItems }),
          },
          'Unable to save shift readiness.',
        )
        setMessage(nextItems.length === READINESS_ITEMS.length ? 'Shift readiness complete.' : 'Shift readiness updated.')
      } catch (error) {
        setCheckedItems(previousItems)
        setMessage(getRequestMessage(error, 'Unable to save shift readiness.'))
      } finally {
        setReadinessSaving(false)
      }
    },
    [checkedItems, guardId, readinessSaving, selectedShiftId],
  )

  const checkedCount = checkedItems.length
  const progressPct = Math.round((checkedCount / READINESS_ITEMS.length) * 100)
  const selectedShift = upcomingShifts.find((shift) => shift.id === selectedShiftId)

  return (
    <div className="guard-section-frame space-y-4">
      <DashboardCard title="Upcoming Schedule">
        {upcomingShifts.length > 0 ? (
          <ul className="space-y-2">
            {upcomingShifts.map((shift) => (
              <li key={shift.id} className="rounded border border-border-subtle bg-surface-elevated p-3">
                <p className="text-sm font-bold text-text-primary">{shift.client_site}</p>
                <p className="text-xs text-text-secondary">{formatShift(shift).replace(`${shift.client_site} - `, '')}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarX2} title="No shifts scheduled" subtitle="Check back later or contact your supervisor." />
        )}
      </DashboardCard>

      <DashboardCard title="Callout Availability">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-text-primary">{available ? 'Available for callout' : 'Not available'}</p>
            <p className="text-xs text-text-secondary">Supervisors use this status when arranging replacements.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={available}
            aria-label="Available for callout"
            disabled={availabilityLoading}
            onClick={() => void handleToggleAvailability()}
            className={`min-h-11 rounded border px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              available
                ? 'border-success-border bg-success-bg text-success-text'
                : 'border-border-subtle bg-surface-elevated text-text-secondary'
            }`}
          >
            {availabilityLoading ? 'Saving...' : available ? 'Available' : 'Unavailable'}
          </button>
        </div>
      </DashboardCard>

      <DashboardCard title="Pre-Shift Readiness">
        <div className="space-y-3">
          <div>
            <label htmlFor="readiness-shift" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Shift
            </label>
            <select
              id="readiness-shift"
              value={selectedShiftId}
              onChange={(event) => setSelectedShiftId(event.target.value)}
              disabled={upcomingShifts.length === 0 || readinessLoading || readinessSaving}
              className="min-h-11 w-full rounded border border-border-subtle bg-surface-elevated px-3 text-sm text-text-primary focus:border-info focus:outline-none focus:ring-2 focus:ring-info/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {upcomingShifts.length === 0 ? <option value="">No upcoming shift</option> : null}
              {upcomingShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {formatShift(shift)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-text-secondary">
            <span>{selectedShift ? `${checkedCount}/${READINESS_ITEMS.length} items ready` : 'No shift selected'}</span>
            <span>{checkedCount === READINESS_ITEMS.length ? 'Ready' : 'Incomplete'}</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated"
            role="progressbar"
            aria-valuenow={checkedCount}
            aria-valuemin={0}
            aria-valuemax={READINESS_ITEMS.length}
            aria-label="Pre-shift readiness"
          >
            <div className="h-full rounded-full bg-success-text transition-all" style={{ width: `${progressPct}%` }} />
          </div>

          <fieldset disabled={!selectedShiftId || readinessLoading || readinessSaving}>
            <legend className="sr-only">Pre-shift readiness items</legend>
            <ul className="space-y-1">
              {READINESS_ITEMS.map((item) => {
                const checked = checkedItems.includes(item.key)
                const Icon = checked ? CheckCircle2 : Circle
                return (
                  <li key={item.key}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 py-2 transition-colors hover:bg-surface-elevated focus-within:ring-2 focus-within:ring-info">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => void toggleEquipment(item.key)}
                      />
                      <Icon className={`h-5 w-5 shrink-0 ${checked ? 'text-success-text' : 'text-text-tertiary'}`} aria-hidden="true" />
                      <span className={`text-sm font-medium ${checked ? 'text-text-primary' : 'text-text-secondary'}`}>{item.label}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>

          {message ? <p className="text-xs text-info-text" role="status" aria-live="polite">{message}</p> : null}
          <p className="text-xs text-text-tertiary">Readiness is saved separately for each assigned shift.</p>
        </div>
      </DashboardCard>
    </div>
  )
}

export default OffDutyPanel
