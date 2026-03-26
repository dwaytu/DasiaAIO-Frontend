import { useState, useEffect, useMemo, useCallback, FC } from 'react'
import { API_BASE_URL } from '../config'
import { parseResponseBody } from '../utils/api'
import Sidebar from './Sidebar'
import Header from './Header'
import { User } from '../App'
import SecurityBentoGrid from './SecurityBentoGrid'
import BentoGrid, { BentoCard } from './BentoGrid'
import SectionHeader from './dashboard/ui/SectionHeader'
import Timeline from './dashboard/ui/Timeline'
import StatCard from './dashboard/ui/StatCard'
import StatusBadge from './dashboard/ui/StatusBadge'
import LiveFreshnessPill from './dashboard/ui/LiveFreshnessPill'
import { isElevatedRole } from '../types/auth'
import { getSidebarNav } from '../config/navigation'
import { logError } from '../utils/logger'

interface CalendarDashboardProps {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface ShiftEvent {
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

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; chip: string }> = {
  shift:       { bg: 'bg-[color:var(--color-info-bg)]', border: 'border-[color:var(--color-info-border)]', text: 'text-[color:var(--color-info-text)]', dot: 'bg-[color:var(--color-info-text)]', chip: 'soc-chip status-info' },
  trip:        { bg: 'bg-[color:var(--color-warning-bg)]', border: 'border-[color:var(--color-warning-border)]', text: 'text-[color:var(--color-warning-text)]', dot: 'bg-[color:var(--color-warning-text)]', chip: 'soc-chip status-warning' },
  mission:     { bg: 'bg-[color:var(--color-surface-elevated)]', border: 'border-[color:var(--color-border-elevated)]', text: 'text-[color:var(--color-text-primary)]', dot: 'bg-[color:var(--color-text-primary)]', chip: 'soc-chip status-neutral' },
  maintenance: { bg: 'bg-[color:var(--color-danger-bg)]', border: 'border-[color:var(--color-danger-border)]', text: 'text-[color:var(--color-danger-text)]', dot: 'bg-[color:var(--color-danger-text)]', chip: 'soc-chip status-danger' },
}

const TYPE_LABELS: Record<string, string> = {
  shift: 'Guard Shift',
  trip: 'Armored Car Trip',
  mission: 'Mission',
  maintenance: 'Maintenance',
}

type OperationalState = 'scheduled' | 'active' | 'attention' | 'completed'

const EVENT_STATE_META: Record<OperationalState, { label: string; tone: 'success' | 'warning' | 'danger' | 'analytics' }> = {
  scheduled: { label: 'Scheduled', tone: 'analytics' },
  active: { label: 'In Progress', tone: 'success' },
  attention: { label: 'Needs Attention', tone: 'danger' },
  completed: { label: 'Completed', tone: 'warning' },
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

function isoToDateKey(iso: string): string {
  return iso.slice(0, 10)
}

function safeIsoToDateKey(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return isoToDateKey(parsed.toISOString())
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

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const CalendarDashboard: FC<CalendarDashboardProps> = ({ user, onLogout, onViewChange, activeView: _activeView }) => {
  const isAdmin = isElevatedRole(user.role)

  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(() => today.toISOString().slice(0, 10))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now())

  const navItems = getSidebarNav(user.role)

  const fetchShifts = useCallback(async (): Promise<ShiftEvent[]> => {
    try {
      const token = localStorage.getItem('token')
      const url = isAdmin
        ? `${API_BASE_URL}/api/guard-replacement/shifts`
        : `${API_BASE_URL}/api/guard-replacement/guard/${user.id}/shifts`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return []
      const data = await parseResponseBody(res)
      const shifts: any[] = data.shifts || (Array.isArray(data) ? data : [])
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
      logError('Failed to fetch shifts:', err)
      return []
    }
  }, [isAdmin, user.id])

  const fetchTrips = useCallback(async (): Promise<TripEvent[]> => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/trips`, {
        headers: { Authorization: `Bearer ${token}` }
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
      logError('Failed to fetch trips:', err)
      return []
    }
  }, [])

  const fetchMissions = useCallback(async (): Promise<MissionEvent[]> => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/missions`, {
        headers: { Authorization: `Bearer ${token}` }
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
      logError('Failed to fetch missions:', err)
      return []
    }
  }, [])

  const fetchMaintenanceEvents = useCallback(async (): Promise<MaintenanceEvent[]> => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/firearm-maintenance/pending`, {
        headers: { Authorization: `Bearer ${token}` }
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
      logError('Failed to fetch maintenance events:', err)
      return []
    }
  }, [])

  const fetchAllEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const results = await Promise.allSettled([
        fetchShifts(),
        fetchTrips(),
        isAdmin ? fetchMissions() : Promise.resolve([]),
        isAdmin ? fetchMaintenanceEvents() : Promise.resolve([]),
      ])
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
      setError('Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }, [fetchMaintenanceEvents, fetchMissions, fetchShifts, fetchTrips, isAdmin])

  useEffect(() => {
    fetchAllEvents()
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

  const mobileAgendaEvents = useMemo(() => {
    const now = new Date().getTime()
    return events
      .filter((ev) => filterType === 'all' || ev.type === filterType)
      .filter((ev) => new Date(ev.startTime).getTime() >= now)
      .slice(0, 10)
  }, [events, filterType])

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const todayKey = today.toISOString().slice(0, 10)
  const selectedDateAttentionCount = useMemo(
    () => selectedDateEvents.filter((event) => getOperationalState(event, todayKey) === 'attention').length,
    [selectedDateEvents, todayKey],
  )

  const getDateKey = (day: number) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // Handle navigation
  const handleNavigate = (view: string) => {
    // Only calendar stays internal to CalendarDashboard
    // All other views (schedule, dashboard, firearms, etc.) route to parent
    if (view === 'calendar') {
      return
    }
    onViewChange?.(view)
  }

  // Calendardashboard always shows activeView as calendar since it's always internal
  const currentActiveView = 'calendar'

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden">
      <a href="#maincontent" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-text-primary focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-focus-ring)]">
        Skip to main content
      </a>
      {/* Sidebar */}
      <Sidebar
        items={navItems}
        activeView={currentActiveView}
        onNavigate={handleNavigate}
        onLogoClick={() => handleNavigate('dashboard')}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={user}
          onLogout={onLogout}
          title={isAdmin ? 'Operations Calendar' : 'My Schedule Calendar'}
          onMenuClick={() => setMobileMenuOpen(true)}
          onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined}
        />

        <main id="maincontent" tabIndex={-1} className="flex-1 overflow-auto p-3 sm:p-6 bg-background">
          <section className="soc-surface mb-6 p-4 md:p-5">
            <SectionHeader
              title="Operations Calendar"
              subtitle={isAdmin ? 'View all shifts, trips, missions and maintenance windows in one timeline.' : 'Track your upcoming shifts and assignments in a single schedule view.'}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <LiveFreshnessPill updatedAt={lastRefreshAt} label="Calendar feed" />
                  <button
                    onClick={fetchAllEvents}
                    className="soc-btn self-start sm:self-auto"
                  >
                    Refresh
                  </button>
                </div>
              }
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Guard Shifts" value={eventStats.shift} tone="guard" />
              <StatCard label="Vehicle Trips" value={eventStats.trip} tone="vehicle" />
              <StatCard label="Missions" value={eventStats.mission} tone="mission" />
              <StatCard label="Maintenance" value={eventStats.maintenance} tone="maintenance" />
            </div>
          </section>

          {error && (
            <div className="mb-4 soc-alert-error">{error}</div>
          )}

          {/* Security Bento Grid - Mission-Critical Dashboard */}
          <div className="mb-8">
            <SecurityBentoGrid
              loading={loading}
              data={bentoMetrics}
              activityMapContent={
                <div className="h-64 overflow-y-auto rounded-lg border border-border-subtle bg-surface p-3">
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
                <StatusBadge label="Completed" tone="warning" />
              </div>
            </div>
          </div>

          <BentoGrid className="items-start">
            {/* Main calendar — hero card (2 cols × 2 rows) */}
            <BentoCard isMain className="!p-0 overflow-hidden">
              {/* Month nav */}
              <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-[color:var(--color-surface)] to-[color:var(--color-surface-elevated)] border-b border-border-subtle">
                <button onClick={prevMonth} aria-label="Previous month" className="p-2 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-text-primary transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-text-primary font-bold text-lg sm:text-2xl tracking-tight">
                  {MONTH_NAMES[currentMonth]} <span className="text-text-secondary">{currentYear}</span>
                </h2>
                <button onClick={nextMonth} aria-label="Next month" className="p-2 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-text-primary transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 px-3 pt-3 pb-2 bg-surface-elevated/50 border-b border-border">
                {DAY_NAMES.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-bold text-text-primary uppercase tracking-widest">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              {loading ? (
                <div className="flex items-center justify-center py-16 text-text-secondary text-sm">Loading events&hellip;</div>
              ) : (
                <>
                  <div className="hidden grid-cols-7 gap-1 p-3 bg-gradient-to-br from-background to-surface/30 md:grid">
                  {calendarCells.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="h-24 sm:h-28 rounded-lg bg-surface/20" />
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
                        className={`h-24 sm:h-28 rounded-lg p-2 text-left transition-all relative border-2
                          ${isToday 
                            ? 'bg-[color:var(--color-info-bg)] border-[color:var(--color-info-border)] shadow-lg shadow-black/20' 
                            : isSelected 
                            ? 'bg-[color:var(--color-surface-elevated)] border-[color:var(--color-border-elevated)]'
                            : dayHasAttention
                            ? 'bg-surface border-[color:var(--color-danger-border)] hover:border-[color:var(--color-danger-border)] hover:bg-surface-hover/40'
                            : 'bg-surface border-border hover:border-blue-400/60 hover:bg-surface-hover/40'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-sm sm:text-base font-bold w-7 h-7 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-[color:var(--color-info-border)] text-white' : isSelected ? 'bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)]' : 'text-text-primary'}`}>
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
                          <div className="flex flex-col gap-1">
                            {dayEvents.slice(0, 2).map((ev, i) => {
                              const c = EVENT_COLORS[ev.type]
                              return (
                                <div key={i} className={`text-xs font-medium px-2 py-1 rounded-full truncate ${c.bg} ${c.text} border ${c.border}`}>
                                  {ev.title.length > 12 ? ev.title.substring(0, 10) + '…' : ev.title}
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
                  <div className="space-y-2 p-3 md:hidden">
                    <h3 className="soc-card-title">Mobile Agenda</h3>
                    {mobileAgendaEvents.length === 0 ? (
                      <p className="soc-empty-state">No upcoming events.</p>
                    ) : (
                      mobileAgendaEvents.map((ev) => {
                        const c = EVENT_COLORS[ev.type]
                        return (
                          <button
                            key={`mobile-${ev.id}`}
                            onClick={() => {
                              setSelectedDate(ev.date)
                              setSelectedEvent(ev)
                            }}
                            className={`w-full rounded-lg border p-3 text-left ${c.bg} ${c.border}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className={`truncate text-sm font-semibold ${c.text}`}>{ev.title}</p>
                              <span className="text-xs text-text-secondary">{formatTime(ev.startTime)}</span>
                            </div>
                            <div className="mt-2">
                              <StatusBadge
                                label={TYPE_LABELS[ev.type]}
                                tone={ev.type === 'shift' ? 'guard' : ev.type === 'trip' ? 'vehicle' : ev.type === 'mission' ? 'mission' : 'maintenance'}
                              />
                              <div className="mt-1">
                                <StatusBadge
                                  label={EVENT_STATE_META[getOperationalState(ev, todayKey)].label}
                                  tone={EVENT_STATE_META[getOperationalState(ev, todayKey)].tone}
                                />
                              </div>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </BentoCard>

            {/* Day detail panel — 2 cols */}
            <BentoCard colSpan={2} className="!p-0 overflow-hidden flex flex-col min-h-[360px]">
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-gradient-to-r from-[color:var(--color-surface)] to-[color:var(--color-surface-elevated)] border-b border-border-subtle">
                  <h3 className="text-text-primary font-bold text-lg">{formatDate(selectedDate)}</h3>
                  <p className="text-text-secondary text-sm mt-1">{selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''} scheduled</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge label={`Attention ${selectedDateAttentionCount}`} tone={selectedDateAttentionCount > 0 ? 'danger' : 'success'} />
                    <StatusBadge label={`Filter ${filterType === 'all' ? 'All Types' : TYPE_LABELS[filterType]}`} tone="analytics" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {selectedDateEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <svg className="w-12 h-12 text-text-tertiary/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-text-tertiary text-sm font-medium">No events scheduled</p>
                      <p className="text-text-tertiary/60 text-xs mt-1">Pick another day or create a new event</p>
                    </div>
                  ) : (
                    selectedDateEvents.map(ev => {
                      const c = EVENT_COLORS[ev.type]
                      const operationalState = getOperationalState(ev, todayKey)
                      const operationalMeta = EVENT_STATE_META[operationalState]
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:scale-[1.02] active:scale-95 
                            ${c.bg} ${c.border} hover:shadow-lg hover:shadow-current/20`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                            <div className="min-w-0 flex-1">
                              <div className={`font-bold text-sm truncate ${c.text}`}>{ev.title}</div>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <div className="text-text-secondary text-xs font-medium">{formatTime(ev.startTime)}</div>
                                <div className="text-text-tertiary text-xs uppercase tracking-wide font-semibold capitalize">
                                  {TYPE_LABELS[ev.type]}
                                </div>
                              </div>
                              <div className="mt-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge
                                    label={ev.status}
                                    tone={ev.status === 'completed' ? 'success' : ev.status === 'cancelled' ? 'danger' : 'warning'}
                                  />
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
              </div>

            </BentoCard>

            {/* Monthly summary — admin only */}
            {isAdmin && (
              <BentoCard colSpan={2}>
                <h4 className="text-text-primary text-base font-bold mb-4">This Month Summary</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(TYPE_LABELS).map(([key, label]) => {
                    const count = eventStats[key] || 0
                    return (
                      <StatCard
                        key={key}
                        label={`${label}s`}
                        value={count}
                        tone={key === 'shift' ? 'guard' : key === 'trip' ? 'vehicle' : key === 'mission' ? 'mission' : 'maintenance'}
                      />
                    )
                  })}
                </div>
              </BentoCard>
            )}
          </BentoGrid>
        </main>
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl max-w-sm w-full p-5 shadow-2xl"
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
                onClick={() => setSelectedEvent(null)}
                className="text-text-tertiary hover:text-text-primary transition-colors"
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
    </div>
  )
}

const Row: FC<{ label: string; value: string; capitalize?: boolean }> = ({ label, value, capitalize }) => (
  <div className="flex justify-between gap-2">
    <span className="text-text-tertiary flex-shrink-0">{label}</span>
    <span className={`text-text-primary text-right ${capitalize ? 'capitalize' : ''}`}>{value}</span>
  </div>
)

export default CalendarDashboard

