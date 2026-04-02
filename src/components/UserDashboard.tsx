import { FC, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, detectRuntimePlatform } from '../config'
import { User as AppUser } from '../App'
import { getRequiredAccuracyMeters, getTrackingAccuracyMode } from '../utils/trackingPolicy'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthToken } from '../utils/api'
import {
  getLocationPermissionState,
  hasAcceptedLocationConsent,
  LOCATION_TRACKING_TOGGLE_KEY,
  requestRuntimeLocationPermission,
  resolveLocationWithFallback,
} from '../utils/location'

interface UserDashboardProps {
  user: AppUser
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface AttendanceRecord {
  id: string
  check_in_time: string
  check_out_time?: string
  status: string
}

interface ShiftItem {
  id: string
  client_site: string
  start_time: string
  end_time: string
  status: string
}

interface AllocationItem {
  id: string
  firearm_id: string
  firearm_model: string
  firearm_caliber: string
  firearm_serial_number: string
  allocation_date: string
  status: string
}

interface PermitItem {
  id: string
  permit_type: string
  issued_date: string
  expiry_date: string
  status: string
}

interface SupportTicketItem {
  id: string
  subject: string
  message: string
  status: string
  created_at: string
}

type GuardSection = 'mission' | 'resources' | 'support' | 'map'

type IncidentPriority = 'low' | 'medium' | 'high' | 'critical'

interface IncidentFormState {
  title: string
  description: string
  location: string
  priority: IncidentPriority
}

interface LastKnownLocation {
  latitude: number
  longitude: number
  accuracyMeters: number | null
  recordedAt: string
  source: string
}

function resolveSectionFromView(activeView?: string): GuardSection {
  if (activeView === 'support') return 'support'
  if (activeView === 'firearms' || activeView === 'permits') return 'resources'
  if (activeView === 'map') return 'map'
  return 'mission'
}

function formatTimeWindow(startTime: string, endTime: string): string {
  const start = new Date(startTime)
  const end = new Date(endTime)

  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function calcHours(checkIn: string, checkOut?: string): string {
  if (!checkOut) return '0.0'
  const start = new Date(checkIn).getTime()
  const end = new Date(checkOut).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return '0.0'
  const duration = Math.max(0, (end - start) / (1000 * 60 * 60))
  return duration.toFixed(1)
}

const UserDashboard: FC<UserDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [activeSection, setActiveSection] = useState<GuardSection>(() => resolveSectionFromView(activeView))

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [scheduleItems, setScheduleItems] = useState<ShiftItem[]>([])
  const [firearmItems, setFirearmItems] = useState<AllocationItem[]>([])
  const [permitItems, setPermitItems] = useState<PermitItem[]>([])
  const [ticketItems, setTicketItems] = useState<SupportTicketItem[]>([])

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncError, setSyncError] = useState<string>('')
  const [actionStatus, setActionStatus] = useState<string>('')
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  const [scheduleForm, setScheduleForm] = useState({
    clientSite: '',
    date: '',
    startTime: '',
    endTime: '',
  })
  const [scheduleStatus, setScheduleStatus] = useState<string>('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState<boolean>(false)

  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' })
  const [ticketStatus, setTicketStatus] = useState<string>('')
  const [ticketSubmitting, setTicketSubmitting] = useState<boolean>(false)

  const [incidentModalOpen, setIncidentModalOpen] = useState<boolean>(false)
  const [incidentForm, setIncidentForm] = useState<IncidentFormState>({
    title: '',
    description: '',
    location: '',
    priority: 'high',
  })
  const [incidentStatus, setIncidentStatus] = useState<string>('')
  const [incidentSubmitting, setIncidentSubmitting] = useState<boolean>(false)

  const [instructionsOpen, setInstructionsOpen] = useState<boolean>(false)

  const [checkInStatus, setCheckInStatus] = useState<Record<string, 'idle' | 'checked_in'>>({})
  const [checkInTimes, setCheckInTimes] = useState<Record<string, Date>>({})
  const [elapsedTime, setElapsedTime] = useState<Record<string, string>>({})
  const [checkInSubmitting, setCheckInSubmitting] = useState<Record<string, boolean>>({})

  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState<boolean>(false)
  const [hasLocationConsent, setHasLocationConsent] = useState<boolean>(false)
  const [locationTrackingMessage, setLocationTrackingMessage] = useState<string>('')
  const [locationPermissionState, setLocationPermissionState] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown')
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | null>(null)
  const [lastKnownLocation, setLastKnownLocation] = useState<LastKnownLocation | null>(null)

  const [mapExpanded, setMapExpanded] = useState<boolean>(false)

  useEffect(() => {
    setActiveSection(resolveSectionFromView(activeView))
  }, [activeView])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(LOCATION_TRACKING_TOGGLE_KEY)
    setLocationTrackingEnabled(stored === 'true')
    setHasLocationConsent(hasAcceptedLocationConsent())
  }, [])

  useEffect(() => {
    if (!hasLocationConsent) {
      setLocationPermissionState('unknown')
      return
    }

    void getLocationPermissionState().then((state) => {
      if (state === 'unsupported') {
        setLocationPermissionState('unknown')
        return
      }
      setLocationPermissionState(state)
    })
  }, [hasLocationConsent])

  const getAuthHeaders = useCallback((extraHeaders: Record<string, string> = {}) => {
    const token = getAuthToken()

    if (!token) return extraHeaders

    return {
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    }
  }, [])

  const refreshData = useCallback(async (initial = false) => {
    if (!user?.id) {
      setIsInitialLoading(false)
      setIsSyncing(false)
      return
    }

    if (initial) {
      setIsInitialLoading(true)
    }

    setIsSyncing(true)
    setSyncError('')

    const requests = [
      fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/attendance/${user.id}`,
        { headers: getAuthHeaders() },
        'Unable to load attendance records',
      ),
      fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-replacement/guard/${user.id}/shifts`,
        { headers: getAuthHeaders() },
        'Unable to load schedule',
      ),
      fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-allocations/${user.id}`,
        { headers: getAuthHeaders() },
        'Unable to load firearm allocations',
      ),
      fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-firearm-permits/${user.id}`,
        { headers: getAuthHeaders() },
        'Unable to load permits',
      ),
      fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/support-tickets/${user.id}`,
        { headers: getAuthHeaders() },
        'Unable to load support tickets',
      ),
    ] as const

    const labels = ['attendance', 'schedule', 'firearms', 'permits', 'support tickets']
    const settled = await Promise.allSettled(requests)
    const failures: string[] = []

    settled.forEach((result, index) => {
      if (result.status === 'rejected') {
        failures.push(labels[index])
        return
      }

      const data = result.value
      if (index === 0) setAttendance(Array.isArray(data?.attendance) ? data.attendance : [])
      if (index === 1) setScheduleItems(Array.isArray(data?.shifts) ? data.shifts : [])
      if (index === 2) setFirearmItems(Array.isArray(data?.allocations) ? data.allocations : [])
      if (index === 3) setPermitItems(Array.isArray(data?.permits) ? data.permits : [])
      if (index === 4) setTicketItems(Array.isArray(data?.tickets) ? data.tickets : [])
    })

    if (failures.length > 0) {
      setSyncError(`Some data could not be loaded: ${failures.join(', ')}.`)
    }

    setIsInitialLoading(false)
    setIsSyncing(false)
  }, [getAuthHeaders, user?.id])

  useEffect(() => {
    void refreshData(true)
  }, [refreshData])

  useEffect(() => {
    if (!locationTrackingEnabled) return
    if (!hasLocationConsent) {
      setLocationTrackingMessage('Location tracking is disabled because location consent has not been accepted.')
      setLocationTrackingEnabled(false)
      localStorage.setItem(LOCATION_TRACKING_TOGGLE_KEY, 'false')
      return
    }

    const token = getAuthToken()
    if (!token || !user?.id) return

    let lastSent = 0
    let disposed = false

    const isMobileClient = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const trackingMode = getTrackingAccuracyMode()
    const requiredAccuracyMeters = getRequiredAccuracyMeters(isMobileClient, trackingMode)
    const runtimePlatform = detectRuntimePlatform()

    const sendHeartbeat = async () => {
      const now = Date.now()
      if (now - lastSent < 15000) return
      lastSent = now

      try {
        const location = await resolveLocationWithFallback(runtimePlatform)
        if (disposed) return

        setLocationAccuracyMeters(location.accuracyMeters)
        setLastKnownLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyMeters: location.accuracyMeters ?? null,
          recordedAt: new Date().toISOString(),
          source: location.source,
        })

        if (
          location.source !== 'ip' &&
          location.accuracyMeters != null &&
          location.accuracyMeters > requiredAccuracyMeters
        ) {
          setLocationTrackingMessage('Location fix is too broad for precise tracking. Move to an open area and wait for GPS to stabilize.')
          return
        }

        await fetchJsonOrThrow(
          `${API_BASE_URL}/api/tracking/heartbeat`,
          {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              entityType: 'guard',
              entityId: user.id,
              label: user.fullName || user.full_name || user.username,
              status: 'active',
              latitude: location.latitude,
              longitude: location.longitude,
              heading: location.heading,
              speedKph: location.speedKph,
              accuracyMeters: location.accuracyMeters,
            }),
          },
          'Unable to send location heartbeat',
        )

        if (disposed) return

        if (location.source === 'ip') {
          setLocationPermissionState('denied')
          setLocationTrackingMessage('Live tracking is active using approximate IP fallback.')
        } else {
          setLocationPermissionState('granted')
          setLocationTrackingMessage('Live location tracking is active.')
        }
      } catch {
        if (disposed) return
        setLocationTrackingMessage('Location heartbeat failed. Check connection and retry.')
      }
    }

    void sendHeartbeat()
    const intervalId = window.setInterval(() => {
      void sendHeartbeat()
    }, 20000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [getAuthHeaders, hasLocationConsent, locationTrackingEnabled, user?.fullName, user?.full_name, user?.id, user?.username])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      Object.entries(checkInTimes).forEach(([shiftId, checkInTime]) => {
        if (checkInStatus[shiftId] === 'checked_in') {
          const elapsedSeconds = Math.floor((Date.now() - checkInTime.getTime()) / 1000)
          const hours = Math.floor(elapsedSeconds / 3600)
          const minutes = Math.floor((elapsedSeconds % 3600) / 60)
          setElapsedTime((previous) => ({
            ...previous,
            [shiftId]: `${hours}h ${minutes}m`,
          }))
        }
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [checkInStatus, checkInTimes])

  const requestLocationPermission = async () => {
    setLocationTrackingMessage('Requesting location access...')
    const state = await requestRuntimeLocationPermission(detectRuntimePlatform())

    if (state === 'granted') {
      setLocationPermissionState('granted')
      setLocationTrackingMessage('Location access granted. Live tracking is active.')
      return
    }

    if (state === 'unsupported') {
      setLocationPermissionState('unknown')
      setLocationTrackingMessage('Precise location is unavailable in this runtime. IP fallback can still be used.')
      return
    }

    setLocationPermissionState('denied')
    setLocationTrackingMessage('Location access was denied. Tracking can continue with approximate fallback.')
  }

  const toggleLocationTracking = () => {
    if (!hasLocationConsent) {
      setLocationTrackingEnabled(false)
      localStorage.setItem(LOCATION_TRACKING_TOGGLE_KEY, 'false')
      setLocationTrackingMessage('Location consent is required before enabling live tracking.')
      return
    }

    const nextValue = !locationTrackingEnabled
    setLocationTrackingEnabled(nextValue)
    localStorage.setItem(LOCATION_TRACKING_TOGGLE_KEY, String(nextValue))

    if (nextValue) {
      void requestLocationPermission()
    } else {
      setLocationTrackingMessage('Live location tracking is turned off.')
      setLocationAccuracyMeters(null)
    }
  }

  const activeShifts = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return scheduleItems
      .filter((shift) => {
        const shiftStart = new Date(shift.start_time)
        return shiftStart >= today && shiftStart < tomorrow
      })
      .sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime())
  }, [scheduleItems])

  const currentShift = useMemo(() => {
    if (activeShifts.length === 0) return null

    const now = Date.now()
    const inProgress = activeShifts.find((shift) => {
      const start = new Date(shift.start_time).getTime()
      const end = new Date(shift.end_time).getTime()
      return now >= start && now <= end
    })

    if (inProgress) return inProgress

    const upcoming = activeShifts.find((shift) => now < new Date(shift.start_time).getTime())
    if (upcoming) return upcoming

    return activeShifts[0]
  }, [activeShifts])

  const dutyStatus = useMemo(() => {
    if (!currentShift) return 'Off Duty'

    const shiftState = checkInStatus[currentShift.id]
    if (shiftState === 'checked_in') return 'On Post'

    const now = Date.now()
    const start = new Date(currentShift.start_time).getTime()
    const end = new Date(currentShift.end_time).getTime()

    if (now < start) return 'Standby'
    if (now > end) return 'Completed'

    return 'Awaiting Check In'
  }, [checkInStatus, currentShift])

  const locationAccuracyLabel = useMemo(() => {
    if (locationAccuracyMeters == null) return 'No Fix'
    if (locationAccuracyMeters <= 15) return 'High'
    if (locationAccuracyMeters <= 40) return 'Medium'
    return 'Low'
  }, [locationAccuracyMeters])

  const mapEmbedUrl = useMemo(() => {
    if (!lastKnownLocation) return ''

    const delta = 0.008
    const left = (lastKnownLocation.longitude - delta).toFixed(6)
    const right = (lastKnownLocation.longitude + delta).toFixed(6)
    const bottom = (lastKnownLocation.latitude - delta).toFixed(6)
    const top = (lastKnownLocation.latitude + delta).toFixed(6)
    const markerLat = lastKnownLocation.latitude.toFixed(6)
    const markerLon = lastKnownLocation.longitude.toFixed(6)

    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${markerLat}%2C${markerLon}`
  }, [lastKnownLocation])

  const mapExternalUrl = useMemo(() => {
    if (!lastKnownLocation) return ''
    return `https://www.openstreetmap.org/?mlat=${lastKnownLocation.latitude}&mlon=${lastKnownLocation.longitude}#map=16/${lastKnownLocation.latitude}/${lastKnownLocation.longitude}`
  }, [lastKnownLocation])

  const handleCheckIn = async (shift: ShiftItem) => {
    if (!user?.id) return

    setActionStatus('')
    setCheckInSubmitting((previous) => ({ ...previous, [shift.id]: true }))

    try {
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-replacement/attendance/check-in`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ guard_id: user.id, shift_id: shift.id }),
        },
        'Check-in failed',
      )

      setCheckInStatus((previous) => ({ ...previous, [shift.id]: 'checked_in' }))
      setCheckInTimes((previous) => ({ ...previous, [shift.id]: new Date() }))
      setActionStatus('Checked in successfully.')
      await refreshData(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check-in failed'
      setActionStatus(message)
      logError('Check-in error:', error)
    } finally {
      setCheckInSubmitting((previous) => ({ ...previous, [shift.id]: false }))
    }
  }

  const handleCheckOut = async (shift: ShiftItem) => {
    if (!user?.id) return

    const recentAttendance = attendance.find(
      (record) =>
        record.status === 'checked_in' &&
        new Date(record.check_in_time).toDateString() === new Date().toDateString(),
    )

    if (!recentAttendance) {
      setActionStatus('No active check-in found for this shift.')
      return
    }

    setActionStatus('')
    setCheckInSubmitting((previous) => ({ ...previous, [shift.id]: true }))

    try {
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-replacement/attendance/check-out`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ attendance_id: recentAttendance.id }),
        },
        'Check-out failed',
      )

      setCheckInStatus((previous) => ({ ...previous, [shift.id]: 'idle' }))
      setCheckInTimes((previous) => {
        const next = { ...previous }
        delete next[shift.id]
        return next
      })
      setElapsedTime((previous) => {
        const next = { ...previous }
        delete next[shift.id]
        return next
      })

      setActionStatus('Checked out successfully.')
      await refreshData(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check-out failed'
      setActionStatus(message)
      logError('Check-out error:', error)
    } finally {
      setCheckInSubmitting((previous) => ({ ...previous, [shift.id]: false }))
    }
  }

  const handlePrimaryCheckAction = async () => {
    if (!currentShift) {
      setActionStatus('No current assignment available for check in or out.')
      return
    }

    if (checkInStatus[currentShift.id] === 'checked_in') {
      await handleCheckOut(currentShift)
      return
    }

    await handleCheckIn(currentShift)
  }

  const handleIncidentSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!incidentForm.title.trim() || !incidentForm.description.trim() || !incidentForm.location.trim()) {
      setIncidentStatus('Title, description, and location are required.')
      return
    }

    setIncidentSubmitting(true)
    setIncidentStatus('')

    try {
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/incidents`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            title: incidentForm.title.trim(),
            description: incidentForm.description.trim(),
            location: incidentForm.location.trim(),
            priority: incidentForm.priority,
          }),
        },
        'Failed to submit incident report',
      )

      setIncidentStatus('Incident report submitted.')
      setIncidentForm({ title: '', description: '', location: '', priority: 'high' })
      setIncidentModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit incident report'
      setIncidentStatus(message)
    } finally {
      setIncidentSubmitting(false)
    }
  }

  const handleScheduleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.id) return

    if (!scheduleForm.clientSite || !scheduleForm.date || !scheduleForm.startTime || !scheduleForm.endTime) {
      setScheduleStatus('All fields are required.')
      return
    }

    const startLocal = new Date(`${scheduleForm.date}T${scheduleForm.startTime}`)
    const endLocal = new Date(`${scheduleForm.date}T${scheduleForm.endTime}`)

    if (Number.isNaN(startLocal.getTime()) || Number.isNaN(endLocal.getTime())) {
      setScheduleStatus('Invalid date or time.')
      return
    }

    if (endLocal <= startLocal) {
      setScheduleStatus('End time must be after start time.')
      return
    }

    setScheduleSubmitting(true)
    setScheduleStatus('')

    try {
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-replacement/shifts`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            guard_id: user.id,
            start_time: startLocal.toISOString(),
            end_time: endLocal.toISOString(),
            client_site: scheduleForm.clientSite,
          }),
        },
        'Failed to request schedule',
      )

      setScheduleStatus('Schedule request submitted.')
      setScheduleForm({ clientSite: '', date: '', startTime: '', endTime: '' })
      await refreshData(false)
    } catch (error) {
      setScheduleStatus(error instanceof Error ? error.message : 'Failed to request schedule.')
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const handleTicketSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.id) return

    if (!ticketForm.subject || !ticketForm.message) {
      setTicketStatus('Subject and message are required.')
      return
    }

    setTicketSubmitting(true)
    setTicketStatus('')

    try {
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/support-tickets`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            guard_id: user.id,
            subject: ticketForm.subject,
            message: ticketForm.message,
          }),
        },
        'Failed to create support ticket',
      )

      setTicketStatus('Support ticket submitted.')
      setTicketForm({ subject: '', message: '' })
      await refreshData(false)
    } catch (error) {
      setTicketStatus(error instanceof Error ? error.message : 'Failed to create support ticket.')
    } finally {
      setTicketSubmitting(false)
    }
  }

  const missionLocation = currentShift?.client_site || 'No active post'
  const missionShiftTime = currentShift ? formatTimeWindow(currentShift.start_time, currentShift.end_time) : 'No shift today'
  const missionAssignment = currentShift ? 'Assigned' : 'Unassigned'
  const missionElapsed = currentShift ? elapsedTime[currentShift.id] || '0h 0m' : '0h 0m'

  const missionCards = [
    { label: 'Current Assignment', value: missionAssignment },
    { label: 'Location or Post', value: missionLocation },
    { label: 'Duty Status', value: dutyStatus },
    { label: 'Shift Time', value: missionShiftTime },
  ]

  const navItems: Array<{ key: GuardSection | 'profile'; label: string }> = [
    { key: 'mission', label: 'Mission' },
    { key: 'resources', label: 'Resources' },
    { key: 'support', label: 'Support' },
    { key: 'map', label: 'Map' },
    { key: 'profile', label: 'Profile' },
  ]

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <a href="#maincontent" className="skip-link">Skip to main content</a>

      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Field Operations</p>
            <p className="truncate text-lg font-bold text-text-primary">{user.fullName || user.full_name || user.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void refreshData(false) }}
              className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-hover"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-11 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-text hover:brightness-95"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main
        id="maincontent"
        tabIndex={-1}
        className="mx-auto h-[calc(100dvh-4.25rem)] w-full max-w-5xl overflow-y-auto px-4 pb-[calc(14.5rem+env(safe-area-inset-bottom,0px))] pt-4"
      >
        <section className="space-y-4" aria-label="Guard mission workspace">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text-primary">Mission Screen</h1>
            <p className="text-sm text-text-secondary">Fast field workflow for assignments, actions, and support under pressure.</p>
          </div>

          {!isOnline ? (
            <div className="rounded-xl border border-danger-border bg-danger-bg p-4 text-danger-text" role="status" aria-live="polite">
              <p className="font-semibold">No connection</p>
              <p className="mt-1 text-sm">Your device is offline. Reconnect to sync mission updates.</p>
            </div>
          ) : null}

          {syncError ? (
            <div className="rounded-xl border border-warning-border bg-warning-bg p-4 text-warning-text" role="status" aria-live="polite">
              <p className="font-semibold">Partial sync issue</p>
              <p className="mt-1 text-sm">{syncError}</p>
              <button
                type="button"
                onClick={() => { void refreshData(false) }}
                className="mt-3 min-h-11 rounded-md border border-warning-border px-3 py-2 text-sm font-semibold"
              >
                Retry Sync
              </button>
            </div>
          ) : null}

          {actionStatus ? (
            <div className="rounded-xl border border-info-border bg-info-bg p-3 text-sm text-info-text" role="status" aria-live="polite">
              {actionStatus}
            </div>
          ) : null}

          {isInitialLoading ? (
            <div className="space-y-3" aria-live="polite">
              <div className="h-28 animate-pulse rounded-xl bg-surface-elevated" />
              <div className="h-24 animate-pulse rounded-xl bg-surface-elevated" />
              <div className="h-24 animate-pulse rounded-xl bg-surface-elevated" />
            </div>
          ) : null}

          {!isInitialLoading && activeSection === 'mission' ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-text-primary">Current Assignment</h2>
                  <span className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                    {isSyncing ? 'Syncing' : 'Live'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {missionCards.map((card) => (
                    <article key={card.label} className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{card.label}</p>
                      <p className="mt-1 text-base font-bold text-text-primary">{card.value}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-text-primary">Field Tracking</h2>
                <p className="mt-1 text-sm text-text-secondary">Keep your location heartbeat active for dispatch visibility.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleLocationTracking}
                    disabled={!hasLocationConsent}
                    className={`min-h-11 rounded-md px-4 py-2 text-sm font-semibold ${
                      !hasLocationConsent
                        ? 'cursor-not-allowed bg-surface-elevated text-text-tertiary'
                        : locationTrackingEnabled
                          ? 'bg-danger-bg text-danger-text border border-danger-border'
                          : 'bg-success-bg text-success-text border border-success-border'
                    }`}
                  >
                    {locationTrackingEnabled ? 'Turn Off Tracking' : 'Turn On Tracking'}
                  </button>
                  <span className="rounded-full border border-border-subtle bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                    Permission: {hasLocationConsent ? locationPermissionState : 'consent-required'}
                  </span>
                  <span className="rounded-full border border-border-subtle bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                    Accuracy: {locationAccuracyMeters != null ? `${Math.round(locationAccuracyMeters)}m (${locationAccuracyLabel})` : 'No Fix'}
                  </span>
                </div>
                {locationTrackingMessage ? (
                  <p className="mt-2 text-xs text-text-secondary" role="status">{locationTrackingMessage}</p>
                ) : null}
              </section>

              <section className="rounded-2xl border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-text-primary">Today\'s Shift Timeline</h2>
                  <span className="rounded-full border border-border-subtle bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                    Elapsed: {missionElapsed}
                  </span>
                </div>

                {activeShifts.length === 0 ? (
                  <p className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No shifts assigned for today.</p>
                ) : (
                  <ul className="space-y-3">
                    {activeShifts.map((shift) => {
                      const checkedIn = checkInStatus[shift.id] === 'checked_in'
                      return (
                        <li key={shift.id} className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{shift.client_site}</p>
                              <p className="text-xs text-text-secondary">{formatTimeWindow(shift.start_time, shift.end_time)}</p>
                            </div>
                            <button
                              type="button"
                              disabled={checkInSubmitting[shift.id]}
                              onClick={() => {
                                if (checkedIn) {
                                  void handleCheckOut(shift)
                                  return
                                }
                                void handleCheckIn(shift)
                              }}
                              className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${
                                checkedIn
                                  ? 'border border-danger-border bg-danger-bg text-danger-text'
                                  : 'border border-success-border bg-success-bg text-success-text'
                              }`}
                            >
                              {checkInSubmitting[shift.id]
                                ? 'Processing...'
                                : checkedIn
                                  ? 'Check Out'
                                  : 'Check In'}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-text-primary">Recent Attendance</h2>
                {attendance.length === 0 ? (
                  <p className="mt-2 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No attendance records available.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {attendance.slice(0, 5).map((record) => (
                      <li key={record.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                        <p className="text-sm font-semibold text-text-primary">
                          {new Date(record.check_in_time).toLocaleDateString()} - {new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Check Out: {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not yet'}
                        </p>
                        <p className="text-xs text-text-secondary">Hours: {calcHours(record.check_in_time, record.check_out_time)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {!isInitialLoading && activeSection === 'resources' ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-text-primary">Assigned Firearms</h2>
                {firearmItems.length === 0 ? (
                  <p className="mt-2 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No active firearm allocations.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {firearmItems.map((item) => (
                      <li key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                        <p className="text-sm font-semibold text-text-primary">{item.firearm_model} ({item.firearm_caliber})</p>
                        <p className="text-xs text-text-secondary">Serial: {item.firearm_serial_number}</p>
                        <p className="text-xs text-text-secondary">Allocated: {new Date(item.allocation_date).toLocaleDateString()}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-text-primary">Permit Records</h2>
                {permitItems.length === 0 ? (
                  <p className="mt-2 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No permit records found.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {permitItems.map((item) => (
                      <li key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                        <p className="text-sm font-semibold text-text-primary">{item.permit_type}</p>
                        <p className="text-xs text-text-secondary">Issued: {new Date(item.issued_date).toLocaleDateString()}</p>
                        <p className="text-xs text-text-secondary">Expires: {new Date(item.expiry_date).toLocaleDateString()}</p>
                        <p className="text-xs text-text-secondary">Status: {item.status}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {!isInitialLoading && activeSection === 'support' ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-text-primary">Field Instructions</h2>
                <p className="mt-1 text-sm text-text-secondary">Open your current protocol list, escalation chain, and radio discipline reminders.</p>
                <button
                  type="button"
                  onClick={() => setInstructionsOpen(true)}
                  className="mt-3 min-h-11 rounded-md border border-info-border bg-info-bg px-4 py-2 text-sm font-semibold text-info-text"
                >
                  Open Instructions
                </button>
              </section>

              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-text-primary">Request Schedule Change</h2>
                <form className="mt-3 grid grid-cols-1 gap-3" onSubmit={handleScheduleSubmit}>
                  <label className="text-sm font-semibold text-text-secondary" htmlFor="schedule-client-site">Client Site</label>
                  <input
                    id="schedule-client-site"
                    type="text"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                    value={scheduleForm.clientSite}
                    onChange={(event) => setScheduleForm((previous) => ({ ...previous, clientSite: event.target.value }))}
                    placeholder="Enter post or client site"
                  />

                  <label className="text-sm font-semibold text-text-secondary" htmlFor="schedule-date">Date</label>
                  <input
                    id="schedule-date"
                    type="date"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                    value={scheduleForm.date}
                    onChange={(event) => setScheduleForm((previous) => ({ ...previous, date: event.target.value }))}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-text-secondary" htmlFor="schedule-start-time">Start Time</label>
                      <input
                        id="schedule-start-time"
                        type="time"
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                        value={scheduleForm.startTime}
                        onChange={(event) => setScheduleForm((previous) => ({ ...previous, startTime: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-text-secondary" htmlFor="schedule-end-time">End Time</label>
                      <input
                        id="schedule-end-time"
                        type="time"
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                        value={scheduleForm.endTime}
                        onChange={(event) => setScheduleForm((previous) => ({ ...previous, endTime: event.target.value }))}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={scheduleSubmitting}
                    className="min-h-11 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
                  >
                    {scheduleSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  {scheduleStatus ? <p className="text-sm text-text-secondary">{scheduleStatus}</p> : null}
                </form>
              </section>

              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-text-primary">Contact and Support</h2>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <article className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                    <p className="text-sm font-semibold text-text-primary">Operations Desk</p>
                    <p className="text-xs text-text-secondary">+63 912 345 6789 · ops@sentinel-security.com</p>
                  </article>
                  <article className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                    <p className="text-sm font-semibold text-text-primary">Site Supervisor</p>
                    <p className="text-xs text-text-secondary">+63 901 234 5678 · supervisor@sentinel-security.com</p>
                  </article>
                  <article className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                    <p className="text-sm font-semibold text-text-primary">HR and Compliance</p>
                    <p className="text-xs text-text-secondary">+63 955 321 4567 · hr@sentinel-security.com</p>
                  </article>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-text-primary">Submit Support Ticket</h2>
                <form className="mt-3 space-y-3" onSubmit={handleTicketSubmit}>
                  <label className="text-sm font-semibold text-text-secondary" htmlFor="support-subject">Subject</label>
                  <input
                    id="support-subject"
                    type="text"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                    value={ticketForm.subject}
                    onChange={(event) => setTicketForm((previous) => ({ ...previous, subject: event.target.value }))}
                    placeholder="Enter ticket subject"
                  />

                  <label className="text-sm font-semibold text-text-secondary" htmlFor="support-message">Message</label>
                  <textarea
                    id="support-message"
                    className="min-h-[110px] w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                    value={ticketForm.message}
                    onChange={(event) => setTicketForm((previous) => ({ ...previous, message: event.target.value }))}
                    placeholder="Describe your issue"
                  />

                  <button
                    type="submit"
                    disabled={ticketSubmitting}
                    className="min-h-11 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
                  >
                    {ticketSubmitting ? 'Submitting...' : 'Create Ticket'}
                  </button>
                  {ticketStatus ? <p className="text-sm text-text-secondary">{ticketStatus}</p> : null}
                </form>

                <div className="mt-4">
                  <h3 className="text-base font-semibold text-text-primary">My Tickets</h3>
                  {ticketItems.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No tickets filed yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {ticketItems.map((ticket) => (
                        <li key={ticket.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-text-primary">{ticket.subject}</p>
                            <span className="rounded-full border border-border-subtle bg-background px-2 py-1 text-xs font-semibold text-text-secondary">
                              {ticket.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">{ticket.message}</p>
                          <p className="mt-1 text-xs text-text-tertiary">{new Date(ticket.created_at).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {!isInitialLoading && activeSection === 'map' ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-text-primary">Map Screen</h2>
                  <button
                    type="button"
                    onClick={() => setMapExpanded((previous) => !previous)}
                    className="min-h-11 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-primary"
                  >
                    {mapExpanded ? 'Collapse Map' : 'Open Map'}
                  </button>
                </div>
                <p className="mt-1 text-sm text-text-secondary">Map is separated from mission controls so it never blocks action buttons or check-in workflows.</p>

                {mapExpanded ? (
                  <div className="mt-3 space-y-3">
                    {mapEmbedUrl ? (
                      <>
                        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated">
                          <iframe
                            title="Guard location map"
                            src={mapEmbedUrl}
                            className="h-[320px] w-full"
                            loading="lazy"
                          />
                        </div>
                        {mapExternalUrl ? (
                          <a
                            href={mapExternalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-primary"
                          >
                            Open Full Map in New Tab
                          </a>
                        ) : null}
                      </>
                    ) : (
                      <p className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">
                        No live coordinates yet. Enable tracking from Mission screen, then reopen map.
                      </p>
                    )}
                  </div>
                ) : null}

                {lastKnownLocation ? (
                  <div className="mt-3 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-xs text-text-secondary">
                    <p>Last known position: {lastKnownLocation.latitude.toFixed(6)}, {lastKnownLocation.longitude.toFixed(6)}</p>
                    <p>Source: {lastKnownLocation.source}</p>
                    <p>Updated: {new Date(lastKnownLocation.recordedAt).toLocaleString()}</p>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </section>
      </main>

      <div
        className="fixed inset-x-0 z-[42] px-3"
        style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-2 rounded-2xl border border-border bg-surface/95 p-2 backdrop-blur sm:grid-cols-3" aria-label="Primary guard actions">
          <button
            type="button"
            onClick={() => {
              setIncidentStatus('')
              setIncidentModalOpen(true)
            }}
            className="min-h-12 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm font-bold text-danger-text"
          >
            Report Incident
          </button>
          <button
            type="button"
            onClick={() => { void handlePrimaryCheckAction() }}
            className="min-h-12 rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm font-bold text-success-text"
          >
            {currentShift && checkInStatus[currentShift.id] === 'checked_in' ? 'Check Out' : 'Check In'}
          </button>
          <button
            type="button"
            onClick={() => setInstructionsOpen(true)}
            className="min-h-12 rounded-lg border border-info-border bg-info-bg px-4 py-3 text-sm font-bold text-info-text"
          >
            View Instructions
          </button>
        </section>
      </div>

      <nav
        aria-label="Guard primary navigation"
        className="fixed bottom-0 left-0 right-0 z-[44] border-t border-border-elevated bg-surface px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2"
      >
        <ul className="mx-auto grid w-full max-w-5xl grid-cols-5 gap-1">
          {navItems.map((item) => {
            const isProfile = item.key === 'profile'
            const isActive = !isProfile && activeSection === item.key
            const isDisabled = isProfile && !onViewChange

            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (item.key === 'profile') {
                      onViewChange?.('profile')
                      return
                    }
                    setActiveSection(item.key)
                  }}
                  className={`min-h-11 w-full rounded-md px-2 py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-info text-white'
                      : 'bg-surface-elevated text-text-secondary'
                  } ${isDisabled ? 'opacity-40' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {instructionsOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="guard-instructions-title"
            className="w-full max-w-xl rounded-2xl border border-border bg-surface p-5 shadow-xl"
          >
            <h2 id="guard-instructions-title" className="text-xl font-bold text-text-primary">Field Instructions</h2>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>Confirm assignment details before arrival at your post.</li>
              <li>Check in immediately once on-site and keep location tracking active.</li>
              <li>Report incidents with clear title, location, and priority level.</li>
              <li>Escalate critical threats to Operations Desk without delay.</li>
              <li>Check out only after formal handoff or shift completion.</li>
            </ul>
            <div className="mt-4 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">
              Operations Desk: +63 912 345 6789
              <br />
              Site Supervisor: +63 901 234 5678
            </div>
            <button
              type="button"
              onClick={() => setInstructionsOpen(false)}
              className="mt-4 min-h-11 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
            >
              Close Instructions
            </button>
          </section>
        </div>
      ) : null}

      {incidentModalOpen ? (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-report-title"
            className="w-full max-w-xl rounded-2xl border border-border bg-surface p-5 shadow-xl"
          >
            <h2 id="incident-report-title" className="text-xl font-bold text-text-primary">Report Incident</h2>
            <form className="mt-3 space-y-3" onSubmit={handleIncidentSubmit}>
              <label className="block text-sm font-semibold text-text-secondary" htmlFor="incident-title">Title</label>
              <input
                id="incident-title"
                type="text"
                value={incidentForm.title}
                onChange={(event) => setIncidentForm((previous) => ({ ...previous, title: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                placeholder="Short incident summary"
                required
              />

              <label className="block text-sm font-semibold text-text-secondary" htmlFor="incident-location">Location</label>
              <input
                id="incident-location"
                type="text"
                value={incidentForm.location}
                onChange={(event) => setIncidentForm((previous) => ({ ...previous, location: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                placeholder="Site or area"
                required
              />

              <label className="block text-sm font-semibold text-text-secondary" htmlFor="incident-priority">Priority</label>
              <select
                id="incident-priority"
                value={incidentForm.priority}
                onChange={(event) => setIncidentForm((previous) => ({ ...previous, priority: event.target.value as IncidentPriority }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <label className="block text-sm font-semibold text-text-secondary" htmlFor="incident-description">Description</label>
              <textarea
                id="incident-description"
                value={incidentForm.description}
                onChange={(event) => setIncidentForm((previous) => ({ ...previous, description: event.target.value }))}
                className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                placeholder="Describe what happened"
                required
              />

              {incidentStatus ? <p className="text-sm text-text-secondary">{incidentStatus}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={incidentSubmitting}
                  className="min-h-11 rounded-md border border-danger-border bg-danger-bg px-4 py-2 text-sm font-semibold text-danger-text"
                >
                  {incidentSubmitting ? 'Submitting...' : 'Submit Incident'}
                </button>
                <button
                  type="button"
                  onClick={() => setIncidentModalOpen(false)}
                  className="min-h-11 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default UserDashboard
