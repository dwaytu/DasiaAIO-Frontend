import { useState, useEffect, useMemo, useCallback, FC } from 'react'
import { API_BASE_URL } from '../config'
import { parseResponseBody } from '../utils/api'
import Sidebar from './Sidebar'
import Header from './Header'
import { User } from '../App'
import SecurityBentoGrid from './SecurityBentoGrid'
import BentoGrid, { BentoCard } from './BentoGrid'

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

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  shift:       { bg: 'bg-blue-900/60',   border: 'border-blue-500',   text: 'text-blue-200',   dot: 'bg-blue-400' },
  trip:        { bg: 'bg-amber-900/60',  border: 'border-amber-500',  text: 'text-amber-200',  dot: 'bg-amber-400' },
  mission:     { bg: 'bg-purple-900/60', border: 'border-purple-500', text: 'text-purple-200', dot: 'bg-purple-400' },
  maintenance: { bg: 'bg-red-900/60',    border: 'border-red-500',    text: 'text-red-200',    dot: 'bg-red-400' },
}

const TYPE_LABELS: Record<string, string> = {
  shift: 'Guard Shift',
  trip: 'Armored Car Trip',
  mission: 'Mission',
  maintenance: 'Maintenance',
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
  const isAdmin = user.role === 'admin' || user.role === 'superadmin' || user.role === 'supervisor'

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

  // Build nav items matching admin/user dashboard patterns
  const adminNavItems = [
    { view: 'dashboard',    label: 'Dashboard',       group: 'MAIN MENU' },
    { view: 'approvals',    label: 'Approvals',       group: 'MAIN MENU' },
    { view: 'calendar',     label: 'Calendar',        group: 'MAIN MENU' },
    { view: 'analytics',    label: 'Analytics',       group: 'MAIN MENU' },
    { view: 'trips',        label: 'Trip Management', group: 'OPERATIONS' },
    { view: 'schedule',     label: 'Schedule',        group: 'OPERATIONS' },
    { view: 'missions',     label: 'Missions',        group: 'OPERATIONS' },
    { view: 'performance',  label: 'Performance',     group: 'OPERATIONS' },
    { view: 'merit',        label: 'Merit Scores',    group: 'OPERATIONS' },
    { view: 'firearms',     label: 'Firearms',        group: 'RESOURCES' },
    { view: 'allocation',   label: 'Allocation',      group: 'RESOURCES' },
    { view: 'permits',      label: 'Permits',         group: 'RESOURCES' },
    { view: 'maintenance',  label: 'Maintenance',     group: 'RESOURCES' },
    { view: 'armored-cars', label: 'Armored Cars',    group: 'RESOURCES' },
  ]
  const userNavItems = [
    { view: 'dashboard', label: 'Dashboard',  group: 'MAIN MENU' },
    { view: 'calendar',  label: 'Calendar',   group: 'MAIN MENU' },
    { view: 'schedule',  label: 'Schedule',   group: 'MAIN MENU' },
    { view: 'firearms',  label: 'Firearms',   group: 'RESOURCES' },
    { view: 'permits',   label: 'My Permits', group: 'RESOURCES' },
    { view: 'support',   label: 'Contacts',   group: 'RESOURCES' },
  ]
  const navItems = isAdmin ? adminNavItems : userNavItems

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
      console.error('Failed to fetch shifts:', err)
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
      console.error('Failed to fetch trips:', err)
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
      console.error('Failed to fetch missions:', err)
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
      console.error('Failed to fetch maintenance events:', err)
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

        <main className="flex-1 overflow-auto p-3 sm:p-6 bg-background">
          {/* Subtitle row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <p className="text-text-secondary text-sm">
              {isAdmin ? 'View all shifts, trips, missions & maintenance' : 'Your upcoming shifts and assignments'}
            </p>
            <button
              onClick={fetchAllEvents}
              className="self-start sm:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-500 rounded-lg text-red-300 text-sm">{error}</div>
          )}

          {/* Security Bento Grid - Mission-Critical Dashboard */}
          <div className="mb-8">
            <SecurityBentoGrid
              loading={loading}
              data={{
                activeGuardsCount: 24,
                activeGuardsTotal: 32,
                pendingAlertsCount: 3,
                pendingAlertsLevel: 'warning',
                equipmentHealthPercentage: 97,
                equipmentHealthStatus: 'operational',
              }}
              activityMapContent={
                <div className="h-64 bg-surface-elevated rounded-lg flex items-center justify-center">
                  <p className="text-text-secondary text-sm">Activity Timeline - Mission Data</p>
                </div>
              }
              onActiveGuardsClick={() => onViewChange?.('users')}
              onPendingAlertsClick={() => onViewChange?.('alerts')}
              onEquipmentStatusClick={() => onViewChange?.('equipment')}
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-5">
            {Object.entries(TYPE_LABELS).map(([key, label]) => {
              const c = EVENT_COLORS[key]
              return (
                <button
                  key={key}
                  onClick={() => setFilterType(f => f === key ? 'all' : key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    filterType === key || filterType === 'all'
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
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-border text-text-primary hover:bg-surface-hover"
              >
                Show All
              </button>
            )}
          </div>

          <BentoGrid className="items-start">
            {/* Main calendar — hero card (2 cols × 2 rows) */}
            <BentoCard isMain className="!p-0 overflow-hidden">
              {/* Month nav */}
              <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-b-2 border-blue-500/30">
                <button onClick={prevMonth} className="p-2 hover:bg-blue-500/20 rounded-lg text-text-secondary hover:text-blue-300 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-text-primary font-bold text-lg sm:text-2xl tracking-tight">
                  {MONTH_NAMES[currentMonth]} <span className="text-blue-400">{currentYear}</span>
                </h2>
                <button onClick={nextMonth} className="p-2 hover:bg-blue-500/20 rounded-lg text-text-secondary hover:text-blue-300 transition-all">
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
                <div className="grid grid-cols-7 gap-1 p-3 bg-gradient-to-br from-background to-surface/30">
                  {calendarCells.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="h-24 sm:h-28 rounded-lg bg-surface/20" />
                    }
                    const dateKey = getDateKey(day)
                    const dayEvents = filteredEventsByDate[dateKey] || []
                    const isToday = dateKey === todayKey
                    const isSelected = dateKey === selectedDate
                    return (
                      <button
                        key={dateKey}
                        onClick={() => setSelectedDate(dateKey)}
                        className={`h-24 sm:h-28 rounded-lg p-2 text-left transition-all relative border-2
                          ${isToday 
                            ? 'bg-blue-500/20 border-blue-400 shadow-lg shadow-blue-500/20' 
                            : isSelected 
                            ? 'bg-blue-900/30 border-blue-500'
                            : 'bg-surface border-border hover:border-blue-400/60 hover:bg-surface-hover/40'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-sm sm:text-base font-bold w-7 h-7 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-blue-500 text-white' : isSelected ? 'bg-blue-400/40 text-blue-200' : 'text-text-primary'}`}>
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
              )}
            </BentoCard>

            {/* Day detail panel — 2 cols */}
            <BentoCard colSpan={2} className="!p-0 overflow-hidden flex flex-col min-h-[360px]">
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-b-2 border-blue-500/30">
                  <h3 className="text-text-primary font-bold text-lg">{formatDate(selectedDate)}</h3>
                  <p className="text-text-secondary text-sm mt-1">{selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''} scheduled</p>
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
                              <div className={`text-xs mt-2 px-2 py-1 rounded-full bg-white/10 w-fit capitalize font-medium`}>
                                {ev.status}
                              </div>
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
                <h4 className="text-text-primary text-base font-bold mb-4">📊 This Month Summary</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(TYPE_LABELS).map(([key, label]) => {
                    const c = EVENT_COLORS[key]
                    const count = eventStats[key] || 0
                    return (
                      <div key={key} className={`p-4 rounded-lg border-2 transition-all hover:shadow-lg ${c.bg} border ${c.border}`}>
                        <div className={`text-2xl font-black ${c.text} mb-1`}>{count}</div>
                        <div className="text-text-secondary text-xs font-semibold uppercase tracking-wide">{label}s</div>
                      </div>
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

