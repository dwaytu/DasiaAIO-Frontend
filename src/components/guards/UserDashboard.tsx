import { FC, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL, detectRuntimePlatform } from '../../config'
import { EMERGENCY_CONTACTS, phoneToTelHref } from '../../constants/emergencyContacts'
import type { User as AppUser } from '../../context/AuthContext'
import { logError } from '../../utils/logger'
import { sanitizeErrorMessage } from '../../utils/sanitize'
import { fetchJsonOrThrow, getAuthToken } from '../../utils/api'
import { enqueueOfflineAction, getPendingCount } from '../../utils/offlineQueue'
import { useUI } from '../../hooks/useUI'
import { useLocationConsent } from '../../hooks/useLocationConsent'
import GuardResourcesTab from '../dashboard/GuardResourcesTab'
import GuardMapTab from '../dashboard/GuardMapTab'
import SupportTickets from './SupportTickets'
import EmergencyContactsBar from './EmergencyContactsBar'
import DashboardCard from '../dashboard/ui/DashboardCard'
import SectionHeader from '../dashboard/ui/SectionHeader'
import { GuardInboxPanel } from '../inbox/GuardInboxPanel'
import ProfileModalContent from '../profile/ProfileModalContent'
import HeaderGlobalActions from '../shared/HeaderGlobalActions'
import OffDutyPanel from './OffDutyPanel'
import PanicButton from './PanicButton'

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

type GuardSection = 'inbox' | 'mission' | 'resources' | 'support' | 'map'

type IncidentPriority = 'low' | 'medium' | 'high' | 'critical'

interface IncidentFormState {
  description: string
  priority: IncidentPriority
}

interface LastKnownLocation {
  latitude: number
  longitude: number
  accuracyMeters: number | null
  recordedAt: string
  source: string
}

const TAGUM_CENTER: [number, number] = [7.4478, 125.8078]

function resolveSectionFromView(activeView?: string): GuardSection {
  if (activeView === 'inbox') return 'inbox'
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



function isOfflineRequestError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    !navigator.onLine ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('failed to fetch') ||
    message.includes('timed out')
  )
}

const UserDashboard: FC<UserDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [activeSection, setActiveSection] = useState<GuardSection>(() => resolveSectionFromView(activeView))

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [scheduleItems, setScheduleItems] = useState<ShiftItem[]>([])
  const [firearmItems, setFirearmItems] = useState<AllocationItem[]>([])
  const [permitItems, setPermitItems] = useState<PermitItem[]>([])

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncError, setSyncError] = useState<string>('')
  const [actionStatus, setActionStatus] = useState<string>('')
  const { isNetworkOnline } = useUI()
  const {
    hasLocationConsent,
    geoPermissionState,
    geoNotice,
    locationHeartbeatStatus,
    lastResolvedLocation,
    lastHeartbeatAt,
    lastHeartbeatApproximate,
    requestGeoPermission: requestGeoPermissionFromContext,
    retryLocationHeartbeat,
  } = useLocationConsent()

  const [incidentModalOpen, setIncidentModalOpen] = useState<boolean>(false)
  const [incidentForm, setIncidentForm] = useState<IncidentFormState>({
    description: '',
    priority: 'high',
  })
  const [incidentStatus, setIncidentStatus] = useState<string>('')
  const [incidentSubmitting, setIncidentSubmitting] = useState<boolean>(false)

  const [instructionsOpen, setInstructionsOpen] = useState<boolean>(false)

  const [checkInStatus, setCheckInStatus] = useState<Record<string, 'idle' | 'checked_in'>>({})
  const [checkInTimes, setCheckInTimes] = useState<Record<string, Date>>({})
  const [elapsedTime, setElapsedTime] = useState<Record<string, string>>({})
  const [checkInSubmitting, setCheckInSubmitting] = useState<Record<string, boolean>>({})

  const [dismissedTrackingNoticeKey, setDismissedTrackingNoticeKey] = useState<string | null>(null)


  const [pendingCount, setPendingCount] = useState<number>(0)

  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false)
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setActiveSection(resolveSectionFromView(activeView))
  }, [activeView])

  const lastKnownLocation = useMemo<LastKnownLocation | null>(() => {
    if (!lastResolvedLocation || !lastHeartbeatAt) {
      return null
    }

    return {
      latitude: lastResolvedLocation.latitude,
      longitude: lastResolvedLocation.longitude,
      accuracyMeters: lastResolvedLocation.accuracyMeters,
      recordedAt: lastHeartbeatAt,
      source: lastHeartbeatApproximate ? 'approximate' : lastResolvedLocation.source,
    }
  }, [lastHeartbeatApproximate, lastHeartbeatAt, lastResolvedLocation])

  const runtimePlatform = useMemo(() => detectRuntimePlatform(), [])

  const closeProfileModal = useCallback(() => {
    setProfileModalOpen(false)
    window.setTimeout(() => {
      profileTriggerRef.current?.focus()
    }, 0)
  }, [])

  useEffect(() => {
    if (!profileModalOpen) {
      return undefined
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProfileModal()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [closeProfileModal, profileModalOpen])

  useEffect(() => {
    let disposed = false
    const poll = async () => {
      try {
        const count = await getPendingCount()
        if (!disposed) setPendingCount(count)
      } catch { /* ignore */ }
    }
    void poll()
    const interval = window.setInterval(() => void poll(), 5000)
    return () => { disposed = true; window.clearInterval(interval) }
  }, [])

  const getAuthHeaders = useCallback((extraHeaders: Record<string, string> = {}) => {
    const token = getAuthToken()

    if (!token) return extraHeaders

    return {
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    }
  }, [])

  const refreshData = useCallback(async (initial = false, signal?: AbortSignal) => {
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
        { headers: getAuthHeaders(), signal },
        'Unable to load attendance records',
      ),
      fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-replacement/guard/${user.id}/shifts`,
        { headers: getAuthHeaders(), signal },
        'Unable to load schedule',
      ),
      fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-allocations/${user.id}`,
        { headers: getAuthHeaders(), signal },
        'Unable to load firearm allocations',
      ),
      fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-firearm-permits/${user.id}`,
        { headers: getAuthHeaders(), signal },
        'Unable to load permits',
      ),
    ] as const

    const labels = ['attendance', 'schedule', 'firearms', 'permits']
    const settled = await Promise.allSettled(requests)
    const failures: string[] = []

    settled.forEach((result, index) => {
      if (result.status === 'rejected') {
        const reason = result.reason
        const isAbortError =
          reason?.name === 'AbortError' ||
          (typeof DOMException !== 'undefined' && reason instanceof DOMException && reason.code === 20)

        // Ignore aborted requests because a re-fired effect will immediately retry.
        if (isAbortError) {
          return
        }

        failures.push(labels[index])
        return
      }

      const data = result.value
      if (index === 0) setAttendance(Array.isArray(data?.attendance) ? data.attendance : [])
      if (index === 1) setScheduleItems(Array.isArray(data?.shifts) ? data.shifts : [])
      if (index === 2) setFirearmItems(Array.isArray(data?.allocations) ? data.allocations : [])
      if (index === 3) setPermitItems(Array.isArray(data?.permits) ? data.permits : [])
    })

    if (failures.length > 0) {
      setSyncError(`Couldn't load some data: ${failures.join(', ')}. Tap Retry.`)
    }

    setIsInitialLoading(false)
    setIsSyncing(false)
  }, [getAuthHeaders, user?.id])

  useEffect(() => {
    const controller = new AbortController()
    void refreshData(true, controller.signal)
    return () => { controller.abort() }
  }, [refreshData])

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

  const trackingStatusLabel = useMemo(() => {
    if (locationHeartbeatStatus === 'active') {
      return lastHeartbeatApproximate ? 'Tracking Active (Approximate)' : 'Tracking Active'
    }

    if (locationHeartbeatStatus === 'no-consent') return 'Tracking Blocked (Consent Required)'
    if (locationHeartbeatStatus === 'no-toa') return 'Tracking Blocked (Terms Required)'
    if (locationHeartbeatStatus === 'no-permission') return 'Tracking Waiting for Permission'
    return 'Tracking Paused'
  }, [lastHeartbeatApproximate, locationHeartbeatStatus])

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

  const dutyStatusConfig = useMemo(() => {
    switch (dutyStatus) {
      case 'On Post':
        return { bannerClass: 'bg-success-bg border-success-border', textClass: 'text-success-text', label: 'ON POST' }
      case 'Standby':
        return { bannerClass: 'bg-info-bg border-info-border', textClass: 'text-info-text', label: 'STANDBY' }
      case 'Awaiting Check In':
        return { bannerClass: 'bg-warning-bg border-warning-border', textClass: 'text-warning-text', label: 'AWAITING CHECK IN' }
      case 'Completed':
        return { bannerClass: 'bg-surface-elevated border-border', textClass: 'text-text-secondary', label: 'SHIFT COMPLETED' }
      default:
        return { bannerClass: 'bg-surface border-border', textClass: 'text-text-tertiary', label: 'OFF DUTY' }
    }
  }, [dutyStatus])

  const mapEmbedUrl = useMemo(() => {
    const latitude = lastKnownLocation?.latitude ?? TAGUM_CENTER[0]
    const longitude = lastKnownLocation?.longitude ?? TAGUM_CENTER[1]

    const delta = 0.008
    const left = (longitude - delta).toFixed(6)
    const right = (longitude + delta).toFixed(6)
    const bottom = (latitude - delta).toFixed(6)
    const top = (latitude + delta).toFixed(6)
    const markerLat = latitude.toFixed(6)
    const markerLon = longitude.toFixed(6)

    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${markerLat}%2C${markerLon}`
  }, [lastKnownLocation])

  const mapExternalUrl = useMemo(() => {
    const latitude = lastKnownLocation?.latitude ?? TAGUM_CENTER[0]
    const longitude = lastKnownLocation?.longitude ?? TAGUM_CENTER[1]
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`
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
      if (isOfflineRequestError(error)) {
        await enqueueOfflineAction({
          url: `${API_BASE_URL}/api/guard-replacement/attendance/check-in`,
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: { guard_id: user.id, shift_id: shift.id },
        })
        setActionStatus('Check-in saved — will send when you\'re back online.')
      } else {
        const message = sanitizeErrorMessage(error instanceof Error ? error.message : 'Check-in failed')
        setActionStatus(message)
      }
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
      if (isOfflineRequestError(error)) {
        await enqueueOfflineAction({
          url: `${API_BASE_URL}/api/guard-replacement/attendance/check-out`,
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: { attendance_id: recentAttendance.id },
        })
        setActionStatus('Check-out saved — will send when you\'re back online.')
      } else {
        const message = sanitizeErrorMessage(error instanceof Error ? error.message : 'Check-out failed')
        setActionStatus(message)
      }
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

    if (!incidentForm.description.trim()) {
      setIncidentStatus('Please describe what happened.')
      return
    }

    setIncidentSubmitting(true)
    setIncidentStatus('')

    const description = incidentForm.description.trim()
    const title = description.length > 50 ? description.slice(0, 50).replace(/\s+\S*$/, '') + '\u2026' : description
    const location = lastKnownLocation
      ? `${lastKnownLocation.latitude}, ${lastKnownLocation.longitude}`
      : 'Location unavailable'

    const payload = {
      title,
      description,
      location,
      priority: incidentForm.priority,
    }

    try {
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/incidents`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        },
        'Failed to submit incident report',
      )

      setIncidentStatus('Incident report submitted.')
      setIncidentForm({ description: '', priority: 'high' })
      setIncidentModalOpen(false)
    } catch (error) {
      try {
        const token = getAuthToken()
        await enqueueOfflineAction({
          url: `${API_BASE_URL}/api/incidents`,
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: payload,
        })
        setIncidentStatus('Saved \u2014 will send when back online.')
        setIncidentForm({ description: '', priority: 'high' })
        setIncidentModalOpen(false)
      } catch {
        const message = sanitizeErrorMessage(error instanceof Error ? error.message : 'Failed to submit incident report')
        setIncidentStatus(message)
      }
    } finally {
      setIncidentSubmitting(false)
    }
  }

  const missionLocation = currentShift?.client_site || 'No active post'
  const missionShiftTime = currentShift ? formatTimeWindow(currentShift.start_time, currentShift.end_time) : 'No shift today'
  const missionElapsed = currentShift ? elapsedTime[currentShift.id] || '0h 0m' : '0h 0m'
  const currentShiftCheckedIn = currentShift ? checkInStatus[currentShift.id] === 'checked_in' : false
  const isTrackingActiveWithoutSchedule = !currentShift && locationHeartbeatStatus === 'active'
  const trackingExecutionNote = runtimePlatform === 'capacitor'
    ? 'Mobile tracking sends updates while SENTINEL stays open in the foreground. Background tracking is not enabled in this build.'
    : 'Keep this dashboard tab open to continue sending location updates.'
  const trackingLastUpdateLabel = lastKnownLocation
    ? new Date(lastKnownLocation.recordedAt).toLocaleString()
    : 'Waiting for first location heartbeat'
  const trackingAccuracyLabel = lastKnownLocation?.accuracyMeters != null
    ? `${Math.round(lastKnownLocation.accuracyMeters)} m`
    : 'n/a'
  const trackingSourceLabel = lastKnownLocation?.source || 'unavailable'
  const missionReadinessNote = !isNetworkOnline
    ? 'Reconnect before sending mission updates or reporting new activity.'
    : locationHeartbeatStatus === 'no-toa'
      ? 'Accept the Terms of Agreement so location heartbeat can run.'
      : !hasLocationConsent
      ? 'Review location consent so operations can verify your patrol position.'
      : locationHeartbeatStatus === 'no-permission'
        ? 'Allow location permission for precise fixes. Approximate fallback can still run.'
        : locationHeartbeatStatus === 'paused'
          ? 'Heartbeat is paused. Retry location to resume updates.'
          : isTrackingActiveWithoutSchedule
            ? 'Tracking is active without a scheduled shift so command can still monitor readiness.'
            : 'Tracking and sync are ready for this watch.'

  const locationBlockingNotice = useMemo(() => {
    if (locationHeartbeatStatus === 'active' && geoPermissionState === 'granted') {
      return null
    }

    if (locationHeartbeatStatus === 'no-consent') {
      return {
        key: 'no-consent',
        title: 'Location sharing paused',
        message: 'Location consent is required before heartbeat updates can run.',
        action: 'open-profile' as const,
        actionLabel: 'Enable Consent',
      }
    }

    if (locationHeartbeatStatus === 'no-toa') {
      return {
        key: 'no-toa',
        title: 'Location sharing paused',
        message: 'Accept the Terms of Agreement to enable location heartbeat.',
        action: 'open-profile' as const,
        actionLabel: 'Review Terms',
      }
    }

    if (locationHeartbeatStatus === 'no-permission' || geoPermissionState === 'denied' || geoPermissionState === 'prompt') {
      return {
        key: 'no-permission',
        title: 'Precise location permission required',
        message: lastHeartbeatAt
          ? 'Tracking is running with approximate positioning. Allow precise location to improve map accuracy.'
          : 'Allow location access to start heartbeat updates.',
        action: 'request-permission' as const,
        actionLabel: 'Enable Location',
      }
    }

    if (locationHeartbeatStatus === 'paused') {
      return {
        key: 'paused',
        title: 'Location heartbeat paused',
        message: 'A recent location sample failed. Retry now to resume heartbeat updates.',
        action: 'retry-location' as const,
        actionLabel: 'Retry Location',
      }
    }

    return {
      key: 'tracking-warning',
      title: 'Location sharing paused',
      message: 'Heartbeat updates are temporarily unavailable. Retry location to continue sharing your position.',
      action: 'retry-location' as const,
      actionLabel: '',
    }
  }, [geoPermissionState, hasLocationConsent, lastHeartbeatAt, locationHeartbeatStatus])

  useEffect(() => {
    if (!locationBlockingNotice) {
      setDismissedTrackingNoticeKey(null)
      return
    }

    if (dismissedTrackingNoticeKey && dismissedTrackingNoticeKey !== locationBlockingNotice.key) {
      setDismissedTrackingNoticeKey(null)
    }
  }, [dismissedTrackingNoticeKey, locationBlockingNotice])

  const navItems: Array<{ key: GuardSection; label: string }> = [
    { key: 'mission', label: 'Mission' },
    { key: 'resources', label: 'Resources' },
    { key: 'support', label: 'Support' },
    { key: 'map', label: 'Map' },
  ]

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <a href="#maincontent" className="skip-link">Skip to main content</a>

      <header className="sticky top-0 z-[var(--z-header)] border-b border-border bg-surface/95 px-4 py-3 backdrop-blur" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Field Operations</p>
            <p className="truncate text-lg font-bold text-text-primary">{user.fullName || user.full_name || user.username}</p>
          </div>
          <HeaderGlobalActions
            user={user}
            onLogout={onLogout}
            onNavigateToInbox={() => onViewChange?.('inbox')}
            onNavigateToProfile={() => setProfileModalOpen(true)}
            onNavigateToSettings={() => onViewChange?.('settings')}
            profileButtonRef={profileTriggerRef}
            guardMode
          />
        </div>
      </header>

      <main
        id="maincontent"
        tabIndex={-1}
        className="guard-sticky-main mx-auto h-[calc(100dvh-var(--guard-main-reserved-height))] w-full max-w-5xl overflow-y-auto px-4 pt-4"
      >
        <section className="guard-section-frame" aria-label="Guard mission workspace">
          {!isNetworkOnline ? (
            <div className="rounded border border-danger-border bg-danger-bg p-4 text-danger-text" role="status" aria-live="polite">
              <p className="font-semibold">No connection</p>
              <p className="mt-1 text-sm">You're offline. Your actions are saved and will send when you reconnect.</p>
            </div>
          ) : null}

          {locationBlockingNotice && dismissedTrackingNoticeKey !== locationBlockingNotice.key ? (
            <div className="rounded border border-warning-border bg-warning-bg p-3 text-warning-text" role="status" aria-live="polite">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{locationBlockingNotice.title}</p>
                  <p className="mt-1 text-xs">{locationBlockingNotice.message}</p>
                  {locationBlockingNotice.action === 'request-permission' ? (
                    <button
                      type="button"
                      onClick={() => {
                        void requestGeoPermissionFromContext()
                      }}
                      className="mt-2 min-h-10 rounded-md border border-warning-border px-3 py-1.5 text-xs font-semibold"
                    >
                      {locationBlockingNotice.actionLabel}
                    </button>
                  ) : null}
                  {locationBlockingNotice.action === 'open-profile' ? (
                    <button
                      type="button"
                      onClick={() => setProfileModalOpen(true)}
                      className="mt-2 min-h-10 rounded-md border border-warning-border px-3 py-1.5 text-xs font-semibold"
                    >
                      {locationBlockingNotice.actionLabel}
                    </button>
                  ) : null}
                  {locationBlockingNotice.action === 'retry-location' ? (
                    <button
                      type="button"
                      onClick={() => {
                        void retryLocationHeartbeat()
                      }}
                      className="mt-2 min-h-10 rounded-md border border-warning-border px-3 py-1.5 text-xs font-semibold"
                    >
                      {locationBlockingNotice.actionLabel || 'Retry Location'}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedTrackingNoticeKey(locationBlockingNotice.key)}
                  className="min-h-10 rounded-md border border-warning-border px-2 py-1 text-xs font-semibold"
                  aria-label="Dismiss location sharing paused notice"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {pendingCount > 0 ? (
            <div className="flex items-center gap-2 rounded border border-warning-border bg-warning-bg p-3 text-warning-text text-sm" role="status" aria-live="polite">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-warning-text text-warning-bg text-xs font-bold">{pendingCount}</span>
              <span>{pendingCount === 1 ? '1 action waiting to send' : `${pendingCount} actions waiting to send`}</span>
            </div>
          ) : null}

          {syncError ? (
            <div className="rounded border border-warning-border bg-warning-bg p-4 text-warning-text" role="status" aria-live="polite">
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
            <div className="rounded border border-info-border bg-info-bg p-3 text-sm text-info-text" role="status" aria-live="polite">
              {actionStatus}
            </div>
          ) : null}

          {isInitialLoading ? (
            <div className="space-y-3" aria-live="polite">
              <div className="h-28 animate-pulse rounded bg-surface-elevated" />
              <div className="h-24 animate-pulse rounded bg-surface-elevated" />
              <div className="h-24 animate-pulse rounded bg-surface-elevated" />
            </div>
          ) : null}

          {!isInitialLoading && activeSection === 'inbox' ? (
            <div className="guard-section-frame">
              <GuardInboxPanel
                userId={user.id}
                onAction={(type, _id) => {
                  if (type === 'mission') setActiveSection('mission')
                }}
              />
            </div>
          ) : null}

          {!isInitialLoading && activeSection === 'mission' ? (
            <div className="guard-section-frame">
              <SectionHeader title="Mission" />

              {dutyStatus === 'Off Duty' ? <OffDutyPanel scheduleItems={scheduleItems} /> : null}

              <>
              {/* Zone 1: StatusHero */}
              <section
                aria-label="Current duty status"
                className={`rounded border p-5 ${dutyStatusConfig.bannerClass}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className={`text-2xl font-black tracking-tight ${dutyStatusConfig.textClass}`}>
                      {dutyStatusConfig.label}
                    </span>
                    {currentShift ? (
                      <div className="mt-2 space-y-0.5">
                        <p className={`text-lg font-bold ${dutyStatusConfig.textClass}`}>{missionLocation}</p>
                        <p className={`text-sm font-medium opacity-75 ${dutyStatusConfig.textClass}`}>{missionShiftTime}</p>
                        {currentShiftCheckedIn ? (
                          <p className={`text-sm font-semibold ${dutyStatusConfig.textClass}`}>Elapsed: {missionElapsed}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className={`mt-2 text-sm ${dutyStatusConfig.textClass}`}>No shift assigned. Stand by or contact your supervisor.</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isSyncing ? (
                      <span className={`rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider opacity-60 ${dutyStatusConfig.textClass}`}>
                        Syncing
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                        locationHeartbeatStatus === 'active'
                          ? 'border border-success-border bg-success-bg text-success-text'
                          : 'border border-border-subtle bg-surface-elevated text-text-tertiary'
                      }`}
                      aria-label={locationHeartbeatStatus === 'active' ? 'Location tracking active' : 'Location tracking not fully active'}
                    >
                      <span aria-hidden="true">{locationHeartbeatStatus === 'active' ? '●' : '○'}</span>
                      {trackingStatusLabel}
                    </span>
                  </div>
                </div>
                {missionReadinessNote ? (
                  <p className={`mt-3 rounded border border-current/10 px-3 py-2 text-xs font-medium opacity-80 ${dutyStatusConfig.textClass}`}>
                    {missionReadinessNote}
                  </p>
                ) : null}
                <dl className="mt-3 grid grid-cols-1 gap-2 rounded border border-current/10 bg-surface/40 p-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide opacity-75">Last update</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text-primary">{trackingLastUpdateLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide opacity-75">Accuracy</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text-primary">{trackingAccuracyLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide opacity-75">Source</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text-primary">{trackingSourceLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide opacity-75">Schedule mode</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text-primary">
                      {isTrackingActiveWithoutSchedule ? 'Active without schedule' : 'Standard tracking mode'}
                    </dd>
                  </div>
                </dl>
                <p className={`mt-2 text-xs opacity-85 ${dutyStatusConfig.textClass}`}>{trackingExecutionNote}</p>
                {geoNotice ? (
                  <p className={`mt-1 text-xs ${dutyStatusConfig.textClass}`}>{geoNotice}</p>
                ) : null}
              </section>

              {/* Zone 2: QuickActions */}
              <div className="space-y-3">
                {currentShift ? (
                  <button
                    type="button"
                    onClick={() => { void handlePrimaryCheckAction() }}
                    className={`min-h-14 w-full rounded px-4 py-3 text-base font-extrabold tracking-wide ${
                      checkInStatus[currentShift.id] === 'checked_in'
                        ? 'border border-danger-border bg-danger-bg text-danger-text'
                        : 'border border-success-border bg-success-bg text-success-text'
                    }`}
                  >
                    {checkInStatus[currentShift.id] === 'checked_in'
                      ? '✓ Check Out – End Shift'
                      : 'Check In – Start Shift'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIncidentStatus('')
                    setIncidentModalOpen(true)
                  }}
                  className="min-h-12 w-full rounded border-2 border-danger-border bg-danger-bg px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-danger-text"
                >
                  ⚠ Report Incident
                </button>
                <button
                  type="button"
                  onClick={() => setInstructionsOpen(true)}
                  className="min-h-10 w-full rounded border border-info-border bg-info-bg px-4 py-2 text-xs font-semibold text-info-text"
                >
                  View Instructions
                </button>
              </div>

              {/* Zone 3: TodaysSchedule */}
              {activeShifts.length > 0 ? (
                <DashboardCard title="Today's Shifts">
                  <section aria-label="Today's shifts">
                    <ul className="space-y-2">
                      {activeShifts.map((shift) => {
                        const checkedIn = checkInStatus[shift.id] === 'checked_in'
                        return (
                          <li
                            key={shift.id}
                            className={`rounded border p-4 ${
                              checkedIn
                                ? 'border-success-border bg-success-bg'
                                : 'border-border-subtle bg-surface-elevated'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className={`text-sm font-bold ${checkedIn ? 'text-success-text' : 'text-text-primary'}`}>
                                  {shift.client_site}
                                </p>
                                <p className={`text-xs ${checkedIn ? 'text-success-text opacity-70' : 'text-text-secondary'}`}>
                                  {formatTimeWindow(shift.start_time, shift.end_time)}
                                  {checkedIn && elapsedTime[shift.id] ? ` · ${elapsedTime[shift.id]}` : ''}
                                </p>
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
                                className={`min-h-10 rounded-md px-3 py-2 text-sm font-semibold ${
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
                  </section>
                </DashboardCard>
              ) : (
                <div className="rounded border border-border-subtle bg-surface-elevated p-4 text-center">
                  <p className="text-sm font-semibold text-text-secondary">No shifts scheduled for today</p>
                  <p className="mt-1 text-xs text-text-tertiary">Check the Support tab for schedule requests</p>
                </div>
              )}
              </>
            </div>
          ) : null}

          {!isInitialLoading && activeSection === 'resources' ? (
            <GuardResourcesTab firearmItems={firearmItems} permitItems={permitItems} />
          ) : null}

          {!isInitialLoading && activeSection === 'support' ? (
            <SupportTickets userId={user.id} />
          ) : null}

          {!isInitialLoading && activeSection === 'map' ? (
            <GuardMapTab
              mapEmbedUrl={mapEmbedUrl}
              mapExternalUrl={mapExternalUrl}
              lastKnownLocation={lastKnownLocation}
              trackingStatusLabel={trackingStatusLabel}
              trackingActiveWithoutSchedule={isTrackingActiveWithoutSchedule}
              onSwitchToMission={() => setActiveSection('mission')}
            />
          ) : null}
        </section>
      </main>

      <div className="guard-sticky-region" data-testid="guard-sticky-region">
        <EmergencyContactsBar />
        <section className="guard-sticky-inner" aria-label="Guard primary navigation">
          <nav aria-label="Guard primary navigation">
            <ul className="guard-sticky-nav">
              {navItems.map((item) => {
                const isActive = activeSection === item.key
                const isDisabled = false

                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setActiveSection(item.key)}
                      className={`min-h-11 w-full rounded-md px-2 py-2 text-xs font-semibold transition-colors outline outline-offset-[-2px] outline-transparent ${
                        isActive
                          ? 'bg-info text-white forced-colors:text-[ButtonText] forced-colors:outline forced-colors:outline-2 forced-colors:outline-[Highlight]'
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
        </section>
      </div>

      <PanicButton userId={user.id} userDisplayName={user.full_name || user.username || user.id} />

      {profileModalOpen ? (
        <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Guard profile settings"
            className="flex max-h-[min(92dvh,960px)] w-full max-w-5xl flex-col overflow-hidden rounded border border-border bg-background shadow-xl"
          >
            <div className="soc-scroll-area flex-1 overflow-y-auto p-4 md:p-6">
              <ProfileModalContent
                user={user}
                mode="modal"
                onBack={closeProfileModal}
                onClose={closeProfileModal}
              />
            </div>
          </section>
        </div>
      ) : null}

      {instructionsOpen ? (
        <div className="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation" onKeyDown={(e) => { if (e.key === 'Escape') setInstructionsOpen(false) }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="guard-instructions-title"
            className="w-full max-w-xl rounded border border-border bg-surface p-5 shadow-xl"
          >
            <h2 id="guard-instructions-title" className="text-xl font-bold text-text-primary">Field Instructions</h2>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>Confirm assignment details before arrival at your post.</li>
              <li>Check in immediately once on-site and keep location tracking active.</li>
              <li>Report incidents with clear title, location, and priority level.</li>
              <li>Escalate critical threats to Operations Desk without delay.</li>
              <li>Check out only after formal handoff or shift completion.</li>
            </ul>
            <div className="mt-4 rounded border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">
              {EMERGENCY_CONTACTS.filter((c) => c.role === 'operations' || c.role === 'supervisor').map((c, i) => (
                <span key={c.role}>
                  {i > 0 && <br />}
                  {c.label}: <a href={phoneToTelHref(c.phone)} className="underline">{c.phone}</a>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInstructionsOpen(false)}
              autoFocus
              className="mt-4 min-h-11 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
            >
              Close Instructions
            </button>
          </section>
        </div>
      ) : null}

      {incidentModalOpen ? (
        <div className="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="presentation" onKeyDown={(e) => { if (e.key === 'Escape') setIncidentModalOpen(false) }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-report-title"
            className="w-full max-w-xl rounded border border-border bg-surface p-5 shadow-xl"
          >
            <h2 id="incident-report-title" className="text-xl font-bold text-text-primary">Report Incident</h2>
            <form className="mt-3 space-y-3" onSubmit={handleIncidentSubmit}>
              <label className="block text-sm font-semibold text-text-secondary" htmlFor="incident-description">What happened?</label>
              <textarea
                id="incident-description"
                autoFocus
                value={incidentForm.description}
                onChange={(event) => setIncidentForm((previous) => ({ ...previous, description: event.target.value }))}
                className="min-h-32 w-full rounded border border-border bg-background px-3 py-2 text-text-primary"
                placeholder="Describe the situation"
                required
              />

              <label className="block text-sm font-semibold text-text-secondary" htmlFor="incident-priority">Priority</label>
              <select
                id="incident-priority"
                value={incidentForm.priority}
                onChange={(event) => setIncidentForm((previous) => ({ ...previous, priority: event.target.value as IncidentPriority }))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text-primary"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <p className="flex items-center gap-1 text-xs text-text-secondary" aria-live="polite">
                <span aria-hidden="true">{"\uD83D\uDCCD"}</span>
                {lastKnownLocation
                  ? `Location: ${lastKnownLocation.latitude.toFixed(4)}, ${lastKnownLocation.longitude.toFixed(4)} \u2713`
                  : 'Getting your location\u2026'}
              </p>

              {incidentStatus ? <p className="text-sm text-text-secondary">{incidentStatus}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={incidentSubmitting}
                  className="min-h-11 rounded-md border border-danger-border bg-danger-bg px-4 py-2 text-sm font-semibold text-danger-text"
                >
                  {incidentSubmitting ? 'Submitting...' : 'Submit Report'}
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

