import { useState, useEffect, useMemo, useCallback, FC } from 'react'
import { Calendar, CarFront, Shield, Target, Wrench } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { parseResponseBody, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import type { User } from '../context/AuthContext'
import SecurityBentoGrid from './SecurityBentoGrid'
import { BentoCard } from './BentoGrid'
import Timeline from './dashboard/ui/Timeline'
import StatusBadge from './dashboard/ui/StatusBadge'
import LiveFreshnessPill from './dashboard/ui/LiveFreshnessPill'
import { isElevatedRole } from '../types/auth'
import { getSidebarNav } from '../config/navigation'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'
import { logError } from '../utils/logger'
import { toLocalDateInputValue } from '../utils/scheduleDateTime'

interface CalendarDashboardProps {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

export interface ShiftEvent {
  id: string
  type: 'shift'
  title: string
  date: string
  startTime: string
  endTime: string
  clientSite: string
  guardName?: string
  guardId?: string
  status: string
}

interface TripEvent {
  id: string
  type: 'trip'
  title: string
  date: string
  startTime: string
  carModel?: string
  carPlate?: string
  destination?: string
  status: string
}

interface MissionEvent {
  id: string
  type: 'mission'
  title: string
  date: string
  startTime: string
  location?: string
  clientName?: string
  status: string
}

interface MaintenanceEvent {
  id: string
  type: 'maintenance'
  title: string
  date: string
  startTime: string
  firearmId?: string
  status: string
}

type CalendarEvent = ShiftEvent | TripEvent | MissionEvent | MaintenanceEvent
type ListFilter = 'all' | 'unassigned' | 'starting-soon' | 'overlapping' | 'overnight'

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; chip: string }> = {
  shift:       { bg: 'bg-(--color-info-bg)', border: 'border-(--color-info-border)', text: 'text-(--color-info-text)', dot: 'bg-(--color-info-text)', chip: 'soc-chip status-info' },
  trip:        { bg: 'tone-vehicle-surface', border: 'border-border', text: 'text-text-primary', dot: 'bg-(--color-info-text)', chip: 'soc-chip tone-vehicle' },
  mission:     { bg: 'bg-(--color-surface-elevated)', border: 'border-(--color-border-elevated)', text: 'text-(--color-text-primary)', dot: 'bg-(--color-text-primary)', chip: 'soc-chip status-neutral' },
  maintenance: { bg: 'tone-maintenance-surface', border: 'border-border', text: 'text-text-primary', dot: 'bg-(--color-text-secondary)', chip: 'soc-chip tone-maintenance' },
}

const TYPE_LABELS: Record<string, string> = {
  shift: 'Guard Shift',
  trip: 'Armored Car Trip',
  mission: 'Mission',
  maintenance: 'Maintenance',
}

const AGENDA_PAGE_SIZE = 3

type OperationalState = 'scheduled' | 'active' | 'attention' | 'completed'

const EVENT_STATE_META: Record<OperationalState, { label: string; tone: 'success' | 'warning' | 'danger' | 'analytics' }> = {
  scheduled: { label: 'Scheduled', tone: 'analytics' },
  active: { label: 'In Progress', tone: 'success' },
  attention: { label: 'Needs Attention', tone: 'danger' },
  completed: { label: 'Completed', tone: 'success' },
}

const ATTENTION_STATUS_TOKENS = ['absent', 'no_show', 'failed', 'overdue', 'cancelled', 'critical']

function getOperationalState(event: CalendarEvent, todayKey: string): OperationalState {
  const status = (event.status || '').toLowerCase()

  if (status === 'completed' || status === 'resolved') return 'completed'
  if (status === 'in_progress' || status === 'active' || status === 'ongoing') return 'active'

  const isOverdue = event.date < todayKey && status !== 'completed' && status !== 'resolved'
  if (isOverdue || ATTENTION_STATUS_TOKENS.some((token) => status.includes(token))) {
    return 'attention'
  }

  return 'scheduled'
}

function getEventAction(event: CalendarEvent, state: OperationalState): string {
  if (state === 'attention') {
    if (event.type === 'maintenance') return 'Escalate to maintenance supervisor and block assignment until cleared.'
    if (event.type === 'shift') return 'Confirm guard replacement and notify the command desk.'
    if (event.type === 'trip') return 'Verify vehicle condition and route clearance before dispatch.'
    return 'Review mission constraints and issue an operator update.'
  }

  if (state === 'active') {
    return 'Continue live monitoring and keep comms channel open for updates.'
  }

  if (state === 'completed') {
    return 'Archive event outcome and prepare follow-up notes if needed.'
  }

  return 'Keep staffing, assets, and timing confirmed before start.'
}

function safeIsoToDateKey(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const dateKey = toLocalDateInputValue(value)
  return dateKey || null
}

export function isOvernightShift(shift: Pick<ShiftEvent, 'startTime' | 'endTime'>): boolean {
  const start = new Date(shift.startTime)
  const end = new Date(shift.endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) return false
  return toLocalDateInputValue(shift.startTime) !== toLocalDateInputValue(shift.endTime)
}

export function getOverlappingShiftIds(shifts: ShiftEvent[]): Set<string> {
  const overlapping = new Set<string>()
  const byGuard = shifts.reduce<Record<string, ShiftEvent[]>>((groups, shift) => {
    if (!shift.guardId || !shift.endTime) return groups
    ;(groups[shift.guardId] ||= []).push(shift)
    return groups
  }, {})

  Object.values(byGuard).forEach((guardShifts) => {
    const ordered = [...guardShifts].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    for (let index = 0; index < ordered.length; index += 1) {
      const current = ordered[index]
      const currentStart = new Date(current.startTime).getTime()
      const currentEnd = new Date(current.endTime).getTime()
      if (Number.isNaN(currentStart) || Number.isNaN(currentEnd) || currentEnd <= currentStart) continue
      for (let nextIndex = index + 1; nextIndex < ordered.length; nextIndex += 1) {
        const next = ordered[nextIndex]
        const nextStart = new Date(next.startTime).getTime()
        if (Number.isNaN(nextStart) || nextStart >= currentEnd) break
        overlapping.add(current.id)
        overlapping.add(next.id)
      }
    }
  })

  return overlapping
}

export function formatShiftTimeRange(shift: Pick<ShiftEvent, 'startTime' | 'endTime'>): string {
  const startDate = safeIsoToDateKey(shift.startTime)
  const endDate = safeIsoToDateKey(shift.endTime)
  if (!startDate || !endDate) return 'Schedule time unavailable'
  if (!isOvernightShift(shift)) return `${formatDate(startDate)}, ${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}`
  return `${formatDate(startDate)}, ${formatTime(shift.startTime)} – ${formatDate(endDate)}, ${formatTime(shift.endTime)}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Invalid time'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const CALENDAR_SHIFT_PAGE_SIZE = 200

const CalendarDashboard: FC<CalendarDashboardProps> = ({ user, onLogout, onViewChange, activeView: _activeView }) => {
  const isAdmin = isElevatedRole(user.role)

  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateInputValue(today.toISOString()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [agendaStateFilter, setAgendaStateFilter] = useState<'all' | OperationalState>('all')
  const [agendaPage, setAgendaPage] = useState(1)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now())

  const fetchShifts = useCallback(async (signal?: AbortSignal): Promise<ShiftEvent[]> => {
    try {
      const endpoint = isAdmin
        ? `${API_BASE_URL}/api/guard-replacement/shifts`
        : `${API_BASE_URL}/api/guard-replacement/guard/${user.id}/shifts`

      const shifts: any[] = []
      let page = 1
      let total = 0

      do {
        const query = new URLSearchParams({
          page: String(page),
          pageSize: String(CALENDAR_SHIFT_PAGE_SIZE),
        })
        const res = await fetch(`${endpoint}?${query.toString()}`, {
          headers: getAuthHeaders(),
          signal,
        })
        if (!res.ok) return []

        const data = await parseResponseBody(res)
        const pageShifts: any[] = data.shifts || (Array.isArray(data) ? data : [])
        shifts.push(...pageShifts)
        total = typeof data.total === 'number' ? data.total : pageShifts.length

        if (pageShifts.length === 0) break
        page += 1
      } while (shifts.length < total)

      return shifts.flatMap((s: any): ShiftEvent[] => {
        const startTime = typeof s.start_time === 'string' ? s.start_time : ''
        const date = safeIsoToDateKey(startTime)
        if (!date || !s.id) return []
        return [{
          id: String(s.id),
          type: 'shift',
          title: s.client_site || 'Guard Shift',
          date,
          startTime,
          endTime: typeof s.end_time === 'string' ? s.end_time : '',
          clientSite: s.client_site || 'Unknown Site',
          guardName: s.guard_name,
          guardId: s.guard_id,
          status: s.status || 'scheduled',
        }]
      })
    } catch (err) {
      if (!isAbortError(err)) {
        logError('Failed to fetch shifts:', err)
      }
      return []
    }
  }, [isAdmin, user.id])

  const fetchTrips = useCallback(async (signal?: AbortSignal): Promise<TripEvent[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/trips`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (!res.ok) return []
      const data = await parseResponseBody(res)
      const trips: any[] = Array.isArray(data) ? data : (data.trips || [])
      return trips.flatMap((t: any): TripEvent[] => {
        const startTime = t.start_time || t.created_at
        const date = safeIsoToDateKey(startTime)
        if (!date || !t.id) return []
        return [{
          id: String(t.id),
          type: 'trip',
          title: `Armored Car: ${t.end_location || t.start_location || 'Trip'}`,
          date,
          startTime,
          carModel: t.car_model,
          carPlate: t.license_plate,
          destination: t.end_location || t.start_location,
          status: t.status || 'in_progress',
        }]
      })
    } catch (err) {
      if (!isAbortError(err)) {
        logError('Failed to fetch trips:', err)
      }
      return []
    }
  }, [])

  const fetchMissions = useCallback(async (signal?: AbortSignal): Promise<MissionEvent[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/missions`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (!res.ok) return []
      const data = await parseResponseBody(res)
      const missions: any[] = data.missions || (Array.isArray(data) ? data : [])
      return missions.flatMap((m: any): MissionEvent[] => {
        const startTime = m.start_date || m.scheduled_date || m.created_at
        const date = safeIsoToDateKey(startTime)
        if (!date || !m.id) return []
        return [{
          id: String(m.id),
          type: 'mission',
          title: m.mission_name || m.name || 'Mission',
          date,
          startTime,
          location: m.location,
          clientName: m.client_name,
          status: m.status || 'scheduled',
        }]
      })
    } catch (err) {
      if (!isAbortError(err)) {
        logError('Failed to fetch missions:', err)
      }
      return []
    }
  }, [])

  const fetchMaintenanceEvents = useCallback(async (signal?: AbortSignal): Promise<MaintenanceEvent[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/firearm-maintenance/pending`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (!res.ok) return []
      const data = await parseResponseBody(res)
      const items: any[] = Array.isArray(data) ? data : []
      return items.flatMap((m: any): MaintenanceEvent[] => {
        const startTime = m.scheduledDate || m.scheduled_date
        const date = safeIsoToDateKey(startTime)
        if (!date || !m.id) return []
        return [{
          id: String(m.id),
          type: 'maintenance',
          title: `Maintenance: ${m.maintenanceType || m.maintenance_type || 'Firearm'}`,
          date,
          startTime,
          firearmId: m.firearmId || m.firearm_id,
          status: m.status || 'pending',
        }]
      })
    } catch (err) {
      if (!isAbortError(err)) {
        logError('Failed to fetch maintenance events:', err)
      }
      return []
    }
  }, [])

  const fetchAllEvents = useCallback(async (signal?: AbortSignal) => {
    if (!signal?.aborted) {
      setLoading(true)
      setError('')
    }
    try {
      const results = await Promise.allSettled([
        fetchShifts(signal),
        isAdmin ? fetchTrips(signal) : Promise.resolve([]),
        isAdmin ? fetchMissions(signal) : Promise.resolve([]),
        isAdmin ? fetchMaintenanceEvents(signal) : Promise.resolve([]),
      ])
      if (signal?.aborted) {
        return
      }
      const all: CalendarEvent[] = []
      results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          all.push(...r.value)
        }
      })
      all.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      setEvents(all)
      setLastRefreshAt(Date.now())

      const failedCount = results.filter(r => r.status === 'rejected').length
      if (failedCount > 0) {
        setError(`Loaded with ${failedCount} source${failedCount === 1 ? '' : 's'} unavailable`)
      }
    } catch (e) {
      if (!signal?.aborted && !isAbortError(e)) {
        setError('Failed to load calendar data')
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [fetchMaintenanceEvents, fetchMissions, fetchShifts, fetchTrips, isAdmin])

  useEffect(() => {
    const controller = new AbortController()
    void fetchAllEvents(controller.signal)
    return () => {
      controller.abort()
    }
  }, [fetchAllEvents])

  const eventsByDate = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = []
    acc[ev.date].push(ev)
    return acc
  }, {}), [events])

  const filteredEventsByDate = useMemo(() => {
    if (filterType === 'all') return eventsByDate
    const filtered: Record<string, CalendarEvent[]> = {}
    Object.entries(eventsByDate).forEach(([dateKey, dateEvents]) => {
      const subset = dateEvents.filter(e => e.type === filterType)
      if (subset.length > 0) filtered[dateKey] = subset
    })
    return filtered
  }, [eventsByDate, filterType])

  const eventStats = useMemo(() => {
    const counts: Record<string, number> = { shift: 0, trip: 0, mission: 0, maintenance: 0 }
    events.forEach(e => {
      counts[e.type] += 1
    })
    return counts
  }, [events])

  const selectedDateEvents = useMemo(
    () => filteredEventsByDate[selectedDate] || [],
    [filteredEventsByDate, selectedDate],
  )
  const filteredListEvents = useMemo(
    () => Object.values(filteredEventsByDate).flat().sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [filteredEventsByDate],
  )
  const shiftEvents = useMemo(
    () => events.filter((event): event is ShiftEvent => event.type === 'shift'),
    [events],
  )
  const overlappingShiftIds = useMemo(() => getOverlappingShiftIds(shiftEvents), [shiftEvents])
  const scheduleSummary = useMemo(() => {
    const now = Date.now()
    const twoHoursFromNow = now + (2 * 60 * 60 * 1000)
    return {
      unassigned: shiftEvents.filter((shift) => !shift.guardId && !shift.guardName),
      startingSoon: shiftEvents.filter((shift) => {
        const start = new Date(shift.startTime).getTime()
        return !Number.isNaN(start) && start >= now && start <= twoHoursFromNow
      }),
      overlapping: shiftEvents.filter((shift) => overlappingShiftIds.has(shift.id)),
      overnight: shiftEvents.filter(isOvernightShift),
    }
  }, [overlappingShiftIds, shiftEvents])
  const listEvents = useMemo(() => {
    if (listFilter === 'all') return filteredListEvents
    if (listFilter === 'unassigned') return filteredListEvents.filter((event) => event.type === 'shift' && scheduleSummary.unassigned.some((shift) => shift.id === event.id))
    if (listFilter === 'starting-soon') return filteredListEvents.filter((event) => event.type === 'shift' && scheduleSummary.startingSoon.some((shift) => shift.id === event.id))
    if (listFilter === 'overlapping') return filteredListEvents.filter((event) => event.type === 'shift' && overlappingShiftIds.has(event.id))
    return filteredListEvents.filter((event) => event.type === 'shift' && isOvernightShift(event))
  }, [filteredListEvents, listFilter, overlappingShiftIds, scheduleSummary])
  const listEventsByDate = useMemo(() => listEvents.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
    ;(groups[event.date] ||= []).push(event)
    return groups
  }, {}), [listEvents])

  const openScheduleSummary = (filter: Exclude<ListFilter, 'all'>) => {
    setListFilter(filter)
    setViewMode('list')
  }

  const timelineItems = useMemo(() => {
    return events.slice(0, 8).map((ev) => ({
      id: ev.id,
      title: ev.title,
      startLabel: formatTime(ev.startTime),
      endLabel: 'endTime' in ev && ev.endTime ? formatTime(ev.endTime) : undefined,
      type: ev.type,
      intensity: ev.type === 'mission' ? 88 : ev.type === 'maintenance' ? 76 : 62,
    }))
  }, [events])

  const bentoMetrics = useMemo(() => {
    const shifts = events.filter((event): event is ShiftEvent => event.type === 'shift')
    const maintenance = events.filter((event): event is MaintenanceEvent => event.type === 'maintenance')

    const activeGuardsCount = shifts.filter((shift) => (shift.status || '').toLowerCase() === 'in_progress').length
    const activeGuardsTotal = shifts.length

    const pendingAlertsCount = events.filter((event) => {
      const status = (event.status || '').toLowerCase()
      return status.includes('pending') || status.includes('no_show') || status.includes('failed') || status.includes('critical')
    }).length

    const pendingAlertsLevel: 'info' | 'warning' | 'danger' =
      pendingAlertsCount >= 5 ? 'danger' : pendingAlertsCount > 0 ? 'warning' : 'info'

    const pendingMaintenanceCount = maintenance.filter((item) => {
      const status = (item.status || '').toLowerCase()
      return status === 'pending' || status === 'scheduled'
    }).length

    const equipmentHealthPercentage = Math.max(0, Math.min(100, 100 - (pendingMaintenanceCount * 5)))
    const equipmentHealthStatus: 'operational' | 'degraded' | 'critical' =
      equipmentHealthPercentage >= 95 ? 'operational' : equipmentHealthPercentage >= 85 ? 'degraded' : 'critical'

    return {
      activeGuardsCount,
      activeGuardsTotal,
      pendingAlertsCount,
      pendingAlertsLevel,
      equipmentHealthPercentage,
      equipmentHealthStatus,
    }
  }, [events])

  const changeMonth = (offset: number) => {
    const next = new Date(currentYear, currentMonth + offset, 1)
    setCurrentYear(next.getFullYear())
    setCurrentMonth(next.getMonth())
    setSelectedDate(toLocalDateInputValue(next.toISOString()))
  }
  const prevMonth = () => changeMonth(-1)
  const nextMonth = () => changeMonth(1)

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const todayKey = toLocalDateInputValue(today.toISOString())
  const agendaEvents = useMemo(() => {
    const order: Record<OperationalState, number> = { attention: 0, active: 1, scheduled: 2, completed: 3 }
    return selectedDateEvents
      .filter((event) => agendaStateFilter === 'all' || getOperationalState(event, todayKey) === agendaStateFilter)
      .slice()
      .sort((a, b) => order[getOperationalState(a, todayKey)] - order[getOperationalState(b, todayKey)]
        || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
  }, [agendaStateFilter, selectedDateEvents, todayKey])
  const agendaPageCount = Math.max(1, Math.ceil(agendaEvents.length / AGENDA_PAGE_SIZE))
  const safeAgendaPage = Math.min(agendaPage, agendaPageCount)
  useEffect(() => { setAgendaPage(1) }, [selectedDate, filterType, agendaStateFilter])
  const selectedDateAttentionCount = useMemo(
    () => selectedDateEvents.filter((event) => getOperationalState(event, todayKey) === 'attention').length,
    [selectedDateEvents, todayKey],
  )

  const getDateKey = (day: number) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const handleNavigate = (view: string) => {
    if (view === 'calendar') return
    onViewChange?.(view)
  }

  return (
    <OperationalShell
      user={user}
      title="Calendar"
      navItems={getSidebarNav(user.role)}
      activeView="calendar"
      onNavigate={handleNavigate}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
      error={error || undefined}
    >
          <section className="soc-surface mb-6 p-4 md:p-5">
            <OperationalPageHeader
              eyebrow={isAdmin ? 'Operations control' : 'Field schedule'}
              title={isAdmin ? 'Operations Calendar' : 'My Schedule Calendar'}
              description={isAdmin ? 'View shifts, trips, missions, and maintenance windows in one operational timeline.' : 'Track upcoming shifts and assignments in a single schedule view.'}
              icon={Calendar}
              status={<StatusBadge label={`${selectedDateAttentionCount} need attention`} tone={selectedDateAttentionCount > 0 ? 'danger' : 'success'} />}
              actions={
                <>
                  <LiveFreshnessPill updatedAt={lastRefreshAt} label="Calendar feed" />
                  <button
                    onClick={() => {
                      void fetchAllEvents()
                    }}
                    className="soc-btn self-start sm:self-auto"
                  >
                    Refresh
                  </button>
                </>
              }
            />
            <div className="mt-4">
              <OperationalSummaryBand
                items={[
                  { label: 'Guard shifts', value: eventStats.shift, tone: 'neutral', icon: Shield },
                  { label: 'Vehicle trips', value: eventStats.trip, tone: 'neutral', icon: CarFront },
                  { label: 'Missions', value: eventStats.mission, tone: 'neutral', icon: Target },
                  { label: 'Maintenance', value: eventStats.maintenance, tone: 'neutral', icon: Wrench },
                ]}
              />
            </div>
            {shiftEvents.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Schedule attention filters">
                <button type="button" onClick={() => openScheduleSummary('unassigned')} className="soc-btn soc-btn-neutral min-h-11 px-3 text-sm">
                  Needs assignment ({scheduleSummary.unassigned.length})
                </button>
                <button type="button" onClick={() => openScheduleSummary('starting-soon')} className="soc-btn soc-btn-neutral min-h-11 px-3 text-sm">
                  Starting soon ({scheduleSummary.startingSoon.length})
                </button>
                {scheduleSummary.overlapping.length > 0 ? <button type="button" onClick={() => openScheduleSummary('overlapping')} className="soc-btn soc-btn-warning min-h-11 px-3 text-sm">Overlapping shifts ({scheduleSummary.overlapping.length})</button> : null}
                {scheduleSummary.overnight.length > 0 ? <button type="button" onClick={() => openScheduleSummary('overnight')} className="soc-btn soc-btn-neutral min-h-11 px-3 text-sm">Overnight shifts ({scheduleSummary.overnight.length})</button> : null}
              </div>
            ) : null}
          </section>

          {/* Security Bento Grid - Mission-Critical Dashboard */}
          <div className="mb-8">
            <SecurityBentoGrid
              loading={loading}
              data={bentoMetrics}
              activityMapContent={
                <div className="h-64 overflow-y-auto rounded border border-border-subtle bg-surface p-3">
                  <Timeline title="Activity Timeline" items={timelineItems} />
                </div>
              }
              onActiveGuardsClick={() => onViewChange?.('users')}
              onPendingAlertsClick={() => onViewChange?.('alerts')}
              onEquipmentStatusClick={() => onViewChange?.('equipment')}
            />
          </div>

          {/* Legend */}
          <div className="mb-5 space-y-3">
            <div className="inline-flex rounded border border-border-subtle bg-surface p-1" role="group" aria-label="Calendar view">
              <button type="button" aria-pressed={viewMode === 'calendar'} onClick={() => setViewMode('calendar')} className={viewMode === 'calendar' ? 'soc-btn soc-btn-primary min-h-10 px-3 text-xs' : 'soc-btn soc-btn-neutral min-h-10 px-3 text-xs'}>Calendar</button>
              <button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'soc-btn soc-btn-primary min-h-10 px-3 text-xs' : 'soc-btn soc-btn-neutral min-h-10 px-3 text-xs'}>List</button>
            </div>
            <div className="flex items-center justify-between gap-2 md:hidden">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                aria-expanded={mobileFiltersOpen}
                aria-controls="calendar-filter-legend"
                className="soc-btn-neutral text-xs"
              >
                {mobileFiltersOpen ? 'Hide filters' : 'Show filters'}
              </button>
              <StatusBadge label={`Attention ${selectedDateAttentionCount}`} tone={selectedDateAttentionCount > 0 ? 'danger' : 'success'} />
            </div>

            <div
              id="calendar-filter-legend"
              className={`${mobileFiltersOpen ? 'flex' : 'hidden'} flex-col gap-3 md:flex`}
            >
              <div className="flex flex-wrap gap-3" role="group" aria-label="Calendar event filters">
                {Object.entries(TYPE_LABELS).map(([key, label]) => {
                  const c = EVENT_COLORS[key]
                  const isActive = filterType === key || filterType === 'all'
                  return (
                    <button
                      key={key}
                      onClick={() => setFilterType(f => f === key ? 'all' : key)}
                      aria-pressed={isActive}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isActive
                          ? `${c.bg} ${c.border} ${c.text}`
                          : 'bg-surface border-border text-text-secondary'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                      {label}
                    </button>
                  )
                })}
                {filterType !== 'all' && (
                  <button
                    onClick={() => setFilterType('all')}
                    className="soc-btn-neutral text-xs"
                  >
                    Show All
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Operational state legend">
                <StatusBadge label="Scheduled" tone="analytics" />
                <StatusBadge label="In Progress" tone="success" />
                <StatusBadge label="Needs Attention" tone="danger" />
                <StatusBadge label="Completed" tone="success" />
              </div>
            </div>
          </div>

          {viewMode === 'list' ? (
            <section className="soc-surface p-4 md:p-6" aria-live="polite" aria-label="Schedule list">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Schedule list</h2>
                  <p className="mt-1 text-sm text-text-secondary">{listEvents.length} matching scheduled item{listEvents.length === 1 ? '' : 's'}.</p>
                </div>
                {listFilter !== 'all' ? <button type="button" className="soc-btn soc-btn-neutral min-h-10 px-3 text-xs" onClick={() => setListFilter('all')}>Show all scheduled items</button> : null}
              </div>
              <div className="mt-5 space-y-6">
                {Object.entries(listEventsByDate).map(([date, dayEvents]) => (
                  <section key={date} aria-labelledby={`schedule-date-${date}`}>
                    <h3 id={`schedule-date-${date}`} className="border-b border-border-subtle pb-2 text-sm font-semibold text-text-primary">{formatDate(date)}</h3>
                    <div className="mt-3 space-y-3">
                      {dayEvents.map((event) => {
                        const isShift = event.type === 'shift'
                        const shift = isShift ? event as ShiftEvent : null
                        const isOverlapping = Boolean(shift && overlappingShiftIds.has(shift.id))
                        return (
                          <article key={event.id} className={`rounded-lg border bg-surface p-4 ${isOverlapping ? 'border-warning-border' : 'border-border-subtle'}`}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-semibold text-text-primary">{event.title}</p>
                                <p className="mt-1 break-words text-sm text-text-secondary">
                                  {shift ? formatShiftTimeRange(shift) : `${formatTime(event.startTime)}`}
                                </p>
                                {shift ? <p className="mt-1 break-words text-sm text-text-secondary">{shift.guardName || 'Unassigned'} · {shift.clientSite}</p> : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {shift && isOvernightShift(shift) ? <StatusBadge label="Overnight shift" tone="warning" /> : null}
                                {isOverlapping ? <StatusBadge label="Overlapping shifts" tone="warning" /> : null}
                                {shift && !shift.guardId && !shift.guardName ? <StatusBadge label="Unassigned" tone="danger" /> : null}
                                <StatusBadge label={TYPE_LABELS[event.type]} tone="analytics" />
                                <button type="button" className="soc-btn soc-btn-neutral min-h-10 px-3 text-xs" onClick={() => { setSelectedDate(event.date); setSelectedEvent(event); setViewMode('calendar') }}>View shift</button>
                                {shift && !shift.guardId && !shift.guardName && isAdmin ? <button type="button" className="soc-btn soc-btn-primary min-h-10 px-3 text-xs" onClick={() => onViewChange?.('schedule')}>Assign guard</button> : null}
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
              {!loading && listEvents.length === 0 ? <div className="mt-4"><EmptyState icon={Calendar} title="No scheduled items" subtitle="Try another event filter." /></div> : null}
            </section>
          ) : <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-4">
            {/* Keep the seven-day month grid wide enough to read at desktop resolutions. */}
            <BentoCard className="overflow-hidden p-0! lg:col-span-3 xl:col-span-3">
              {/* Month nav */}
              <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-(--color-surface) to-(--color-surface-elevated) border-b border-border-subtle">
                <button onClick={prevMonth} aria-label="Previous month" className="p-2 hover:bg-surface-hover rounded text-text-secondary hover:text-text-primary transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-text-primary font-bold text-lg sm:text-2xl tracking-tight">
                  {MONTH_NAMES[currentMonth]} <span className="text-text-secondary">{currentYear}</span>
                </h2>
                <button onClick={nextMonth} aria-label="Next month" className="p-2 hover:bg-surface-hover rounded text-text-secondary hover:text-text-primary transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="hidden grid-cols-7 gap-1 border-b border-border bg-surface-elevated/50 px-3 pb-2 pt-3 md:grid">
                {DAY_NAMES.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-bold text-text-primary uppercase tracking-widest">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              {loading ? (
                <div className="p-4"><LoadingSkeleton variant="card" count={3} /></div>
              ) : (
                <>
                  <div className="hidden grid-cols-7 gap-1 p-3 bg-gradient-to-br from-background to-surface/30 md:grid">
                  {calendarCells.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="min-h-[7rem] rounded-lg bg-surface/20" />
                    }
                    const dateKey = getDateKey(day)
                    const dayEvents = filteredEventsByDate[dateKey] || []
                    const isToday = dateKey === todayKey
                    const isSelected = dateKey === selectedDate
                    const dayHasAttention = dayEvents.some((event) => getOperationalState(event, todayKey) === 'attention')
                    return (
                      <button
                        key={dateKey}
                        onClick={() => setSelectedDate(dateKey)}
                        className={`relative flex min-h-[7rem] flex-col justify-between rounded-lg border border-border-subtle bg-surface p-2 text-left transition-colors hover:border-info-border hover:bg-surface-hover/30
                          ${isToday
                            ? 'border-info-border bg-info-bg shadow-sm'
                            : isSelected
                            ? 'border-border-elevated bg-surface-elevated'
                            : dayHasAttention
                            ? 'border-danger-border hover:border-danger-border hover:bg-surface-hover/40'
                            : ''
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-sm sm:text-base font-bold w-7 h-7 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-(--color-info-border) text-white' : isSelected ? 'bg-(--color-info-bg) text-(--color-info-text)' : 'text-text-primary'}`}>
                            {day}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="text-xs font-semibold bg-white/10 px-1.5 py-0.5 rounded-full text-text-secondary">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>
                        {/* Event badges */}
                        {dayEvents.length > 0 && (
                          <div className="flex min-w-0 flex-col gap-1">
                            {dayEvents.slice(0, 2).map((ev, i) => {
                              return (
                                <div key={i} className="max-w-full truncate rounded-md border border-info-border bg-info-bg px-2 py-0.5 text-[11px] font-medium text-info-text">
                                  {ev.title}
                                </div>
                              )
                            })}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-text-tertiary font-semibold">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                  </div>
                  <div className="p-3 md:hidden">
                    <label htmlFor="calendar-mobile-date" className="soc-form-label">Agenda date</label>
                    <input
                      id="calendar-mobile-date"
                      type="date"
                      value={selectedDate}
                      className="soc-form-control w-full min-w-0"
                      onChange={(event) => {
                        const date = event.target.value
                        if (!date) return
                        const [year, month] = date.split('-').map(Number)
                        setSelectedDate(date)
                        setCurrentYear(year)
                        setCurrentMonth(month - 1)
                      }}
                    />
                  </div>
                </>
              )}
            </BentoCard>

            {/* Selected-date agenda stays in a dedicated desktop side panel. */}
            <BentoCard className="flex min-h-[360px] flex-col overflow-hidden p-0! lg:col-span-1">
              <div className="flex flex-1 flex-col overflow-hidden" role="region" aria-labelledby="selected-date-agenda-heading">
                <div className="px-6 py-4 bg-gradient-to-r from-(--color-surface) to-(--color-surface-elevated) border-b border-border-subtle">
                  <h3 id="selected-date-agenda-heading" className="text-text-primary font-bold text-lg">{formatDate(selectedDate)}</h3>
                  <p className="text-text-secondary text-sm mt-1">{selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''} scheduled</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge label={`Attention ${selectedDateAttentionCount}`} tone={selectedDateAttentionCount > 0 ? 'danger' : 'success'} />
                    <StatusBadge label={`Filter ${filterType === 'all' ? 'All Types' : TYPE_LABELS[filterType]}`} tone="analytics" />
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-text-secondary" htmlFor="agenda-state-filter">Event status</label>
                  <select id="agenda-state-filter" value={agendaStateFilter} onChange={(event) => setAgendaStateFilter(event.target.value as 'all' | OperationalState)} className="soc-form-control mt-1 w-full">
                    <option value="all">All statuses</option>
                    <option value="attention">Needs attention</option>
                    <option value="active">Active</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {agendaEvents.length === 0 ? (
                    <EmptyState icon={Calendar} title="No matching events" subtitle="Choose another status or date." />
                  ) : (
                    agendaEvents.slice((safeAgendaPage - 1) * AGENDA_PAGE_SIZE, safeAgendaPage * AGENDA_PAGE_SIZE).map(ev => {
                      const c = EVENT_COLORS[ev.type]
                      const operationalState = getOperationalState(ev, todayKey)
                      const operationalMeta = EVENT_STATE_META[operationalState]
                      const hasDistinctStatus = ev.status.toLowerCase().replace(/[_-]/g, ' ') !== operationalMeta.label.toLowerCase()
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`w-full text-left p-4 rounded border-2 transition-all hover:scale-[1.02] active:scale-95 
                            ${c.bg} ${c.border} hover:shadow-lg hover:shadow-current/20`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                            <div className="min-w-0 flex-1">
                              <div className={`font-bold text-sm truncate ${c.text}`}>{ev.title}</div>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <div className="text-text-secondary text-xs font-medium">{formatTime(ev.startTime)}</div>
                                <div className="text-text-tertiary text-xs uppercase tracking-wide font-semibold">
                                  {TYPE_LABELS[ev.type]}
                                </div>
                              </div>
                              <div className="mt-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  {hasDistinctStatus && <StatusBadge
                                    label={ev.status}
                                    tone={operationalState === 'attention'
                                      ? 'danger'
                                      : operationalState === 'active' || operationalState === 'completed'
                                        ? 'success'
                                        : 'analytics'}
                                  />}
                                  <StatusBadge label={operationalMeta.label} tone={operationalMeta.tone} />
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-text-secondary">{getEventAction(ev, operationalState)}</p>
                              {ev.type === 'shift' && (
                                <div className="text-text-secondary text-xs mt-2 truncate">
                                  📍 {(ev as ShiftEvent).clientSite}
                                  {isAdmin && (ev as ShiftEvent).guardName ? ` — ${(ev as ShiftEvent).guardName}` : ''}
                                </div>
                              )}
                              {ev.type === 'trip' && (ev as TripEvent).destination && (
                                <div className="text-text-secondary text-xs mt-2 truncate">
                                  🚗 {(ev as TripEvent).destination}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
                <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle p-4" aria-label="Selected date agenda pages">
                  <button type="button" className="soc-btn soc-btn-neutral disabled:opacity-50" disabled={safeAgendaPage === 1} onClick={() => setAgendaPage(safeAgendaPage - 1)}>Previous</button>
                  <span className="text-xs text-text-secondary" aria-live="polite">Page {safeAgendaPage} of {agendaPageCount}</span>
                  <button type="button" className="soc-btn soc-btn-neutral disabled:opacity-50" disabled={safeAgendaPage === agendaPageCount} onClick={() => setAgendaPage(safeAgendaPage + 1)}>Next</button>
                </nav>
              </div>

            </BentoCard>

          </div>}

          {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="soc-modal-backdrop"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="soc-modal-panel w-full max-w-sm rounded border border-border bg-surface p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Shift details"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${EVENT_COLORS[selectedEvent.type].dot}`} />
                <span className={`text-xs font-medium ${EVENT_COLORS[selectedEvent.type].text}`}>
                  {TYPE_LABELS[selectedEvent.type]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h3 className="text-text-primary font-bold text-base mb-3">{selectedEvent.title}</h3>

            <div className="space-y-2 text-sm">
              <Row label="Date" value={formatDate(selectedEvent.date)} />
              <Row label="Time" value={formatTime(selectedEvent.startTime)} />
              <Row label="Status" value={selectedEvent.status} capitalize />

              {selectedEvent.type === 'shift' && (() => {
                const s = selectedEvent as ShiftEvent
                return <>
                  <Row label="Client Site" value={s.clientSite} />
                  {s.endTime && <Row label="End Time" value={formatTime(s.endTime)} />}
                  {isAdmin && s.guardName && <Row label="Guard" value={s.guardName} />}
                </>
              })()}

              {selectedEvent.type === 'trip' && (() => {
                const t = selectedEvent as TripEvent
                return <>
                  {t.destination && <Row label="Destination" value={t.destination} />}
                  {t.carModel && <Row label="Vehicle" value={t.carModel} />}
                  {t.carPlate && <Row label="Plate" value={t.carPlate} />}
                </>
              })()}

              {selectedEvent.type === 'mission' && (() => {
                const m = selectedEvent as MissionEvent
                return <>
                  {m.location && <Row label="Location" value={m.location} />}
                  {m.clientName && <Row label="Client" value={m.clientName} />}
                </>
              })()}

              {selectedEvent.type === 'maintenance' && (() => {
                const m = selectedEvent as MaintenanceEvent
                return <>
                  {m.firearmId && <Row label="Firearm ID" value={m.firearmId.slice(0, 8) + '...'} />}
                </>
              })()}
            </div>
          </div>
        </div>
      )}
    </OperationalShell>
  )
}

const Row: FC<{ label: string; value: string; capitalize?: boolean }> = ({ label, value, capitalize }) => (
  <div className="flex justify-between gap-2">
    <span className="text-text-tertiary shrink-0">{label}</span>
    <span className={`text-text-primary text-right ${capitalize ? 'capitalize' : ''}`}>{value}</span>
  </div>
)

export default CalendarDashboard
