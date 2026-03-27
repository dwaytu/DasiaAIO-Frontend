import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { detectRuntimePlatform } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'
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

const UserDashboard: FC<UserDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'overview' | 'schedule' | 'firearms' | 'permits' | 'support'>(() => {
    // If activeView is 'schedule', 'firearms', 'permits', or 'support', use that
    if (activeView === 'schedule' || activeView === 'firearms' || activeView === 'permits' || activeView === 'support') {
      return activeView
    }
    return 'overview'
  })
  const [scheduleItems, setScheduleItems] = useState<ShiftItem[]>([])
  const [firearmItems, setFirearmItems] = useState<AllocationItem[]>([])
  const [permitItems, setPermitItems] = useState<PermitItem[]>([])
  const [ticketItems, setTicketItems] = useState<SupportTicketItem[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [scheduleForm, setScheduleForm] = useState({
    clientSite: '',
    date: '',
    startTime: '',
    endTime: ''
  })
  const [scheduleStatus, setScheduleStatus] = useState<string>('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState<boolean>(false)
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' })
  const [ticketStatus, setTicketStatus] = useState<string>('')
  const [ticketSubmitting, setTicketSubmitting] = useState<boolean>(false)
  const [activeShifts, setActiveShifts] = useState<ShiftItem[]>([])
  const [checkInStatus, setCheckInStatus] = useState<{ [key: string]: 'idle' | 'checked_in' | 'elapsed' }>({})
  const [elapsedTime, setElapsedTime] = useState<{ [key: string]: string }>({})
  const [checkInTimes, setCheckInTimes] = useState<{ [key: string]: Date }>({})
  const [checkInSubmitting, setCheckInSubmitting] = useState<{ [key: string]: boolean }>({})
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState<boolean>(false)
  const [hasLocationConsent, setHasLocationConsent] = useState<boolean>(false)
  const [locationTrackingMessage, setLocationTrackingMessage] = useState<string>('')
  const [locationPermissionState, setLocationPermissionState] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown')
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | null>(null)
  const navItems = [
    { view: 'overview', label: 'Dashboard', group: 'MAIN MENU' },
    { view: 'calendar', label: 'Calendar', group: 'MAIN MENU' },
    { view: 'schedule', label: 'Schedule', group: 'MAIN MENU' },
    { view: 'firearms', label: 'Firearms', group: 'RESOURCES' },
    { view: 'permits', label: 'My Permits', group: 'RESOURCES' },
    { view: 'support', label: 'Contacts', group: 'RESOURCES' },
  ]

  useEffect(() => {
    if (!user?.id) return
    fetchAttendance(user.id)
    fetchSchedule(user.id)
    fetchFirearms(user.id)
    fetchPermits(user.id)
    fetchTickets(user.id)
  }, [user?.id])

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

  useEffect(() => {
    if (!locationTrackingEnabled) return
    if (!hasLocationConsent) {
      setLocationTrackingMessage('Location tracking is disabled because consent has not been accepted.')
      setLocationTrackingEnabled(false)
      localStorage.setItem(LOCATION_TRACKING_TOGGLE_KEY, 'false')
      return
    }

    const token = getAuthToken()
    if (!token) return

    let lastSent = 0
    const isMobileClient = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const trackingMode = getTrackingAccuracyMode()
    const REQUIRED_ACCURACY_METERS = getRequiredAccuracyMeters(isMobileClient, trackingMode)
    const platform = detectRuntimePlatform()
    let disposed = false

    const sendHeartbeat = async () => {
        const now = Date.now()
        if (now - lastSent < 15000) return
        lastSent = now

        try {
          const location = await resolveLocationWithFallback(platform)
          const accuracyMeters = location.accuracyMeters
          setLocationAccuracyMeters(accuracyMeters)

          if (
            location.source !== 'ip' &&
            accuracyMeters != null &&
            accuracyMeters > REQUIRED_ACCURACY_METERS
          ) {
            setLocationTrackingMessage(
              isMobileClient
                ? 'Location fix is too broad to plot accurately. Move to an open area and wait for stronger GPS.'
                : 'Desktop location is often Wi-Fi/IP based and may drift. For reliable tracking, open this dashboard on your phone with GPS enabled.'
            )
            return
          }

          await fetchJsonOrThrow(
            `${API_BASE_URL}/api/tracking/heartbeat`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                entityType: 'guard',
                entityId: user.id,
                label: user.fullName || user.full_name || user.username,
                status: 'active',
                latitude: location.latitude,
                longitude: location.longitude,
                heading: location.heading,
                speedKph: location.speedKph,
                accuracyMeters,
              }),
            },
            'Unable to send location heartbeat.',
          )

          if (disposed) return

          if (location.source === 'ip') {
            setLocationPermissionState('denied')
            setLocationTrackingMessage('Live tracking is active using approximate IP-based location fallback.')
          } else {
            setLocationPermissionState('granted')
            setLocationTrackingMessage('Live location tracking is active.')
          }
        } catch {
          if (disposed) return
          setLocationTrackingMessage('Location heartbeat failed. Check your connection.')
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
  }, [hasLocationConsent, locationTrackingEnabled, user.id, user.username, user.fullName, user.full_name])

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
      setLocationTrackingMessage('Precise location is unavailable in this runtime. IP-based fallback will be used.')
      return
    }

    setLocationPermissionState('denied')
    setLocationTrackingMessage('Location access was denied. Tracking can continue with approximate IP-based fallback.')
  }

  const toggleLocationTracking = () => {
    if (!hasLocationConsent) {
      setLocationTrackingEnabled(false)
      localStorage.setItem(LOCATION_TRACKING_TOGGLE_KEY, 'false')
      setLocationTrackingMessage('Location consent is required before enabling live tracking.')
      return
    }

    const next = !locationTrackingEnabled
    setLocationTrackingEnabled(next)
    localStorage.setItem(LOCATION_TRACKING_TOGGLE_KEY, String(next))
    if (next) {
      void requestLocationPermission()
    } else {
      setLocationTrackingMessage('Live location tracking is turned off.')
      setLocationAccuracyMeters(null)
    }
  }

  const locationAccuracyQuality =
    locationAccuracyMeters == null
      ? 'unknown'
      : locationAccuracyMeters <= 15
        ? 'high'
        : locationAccuracyMeters <= 40
          ? 'medium'
          : 'low'

  // Filter today's shifts
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todaysShifts = scheduleItems.filter(shift => {
      const shiftStart = new Date(shift.start_time)
      return shiftStart >= today && shiftStart < tomorrow
    })

    setActiveShifts(todaysShifts)
  }, [scheduleItems])

  // Update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(checkInTimes).forEach(([shiftId, checkInTime]) => {
        if (checkInStatus[shiftId] === 'checked_in') {
          const now = new Date()
          const elapsed = Math.floor((now.getTime() - checkInTime.getTime()) / 1000)
          const hours = Math.floor(elapsed / 3600)
          const minutes = Math.floor((elapsed % 3600) / 60)
          const seconds = elapsed % 60
          setElapsedTime(prev => ({
            ...prev,
            [shiftId]: `${hours}h ${minutes}m ${seconds}s`
          }))
        }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [checkInStatus, checkInTimes])

  const fetchAttendance = async (guardId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/attendance/${guardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setAttendance(data.attendance || [])
      }
    } catch (err) {
      logError('Error fetching attendance:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSchedule = async (guardId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/guard/${guardId}/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setScheduleItems(data.shifts || [])
      }
    } catch (err) {
      logError('Error fetching schedule:', err)
    }
  }

  const fetchFirearms = async (guardId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/guard-allocations/${guardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setFirearmItems(data.allocations || [])
      }
    } catch (err) {
      logError('Error fetching firearms:', err)
    }
  }

  const fetchPermits = async (guardId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/guard-firearm-permits/${guardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setPermitItems(data.permits || [])
      }
    } catch (err) {
      logError('Error fetching permits:', err)
    }
  }

  const fetchTickets = async (guardId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/support-tickets/${guardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setTicketItems(data.tickets || [])
      }
    } catch (err) {
      logError('Error fetching tickets:', err)
    }
  }

  const isLicenseExpired = () => {
    const expiryDate = user?.licenseExpiryDate || user?.license_expiry_date
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  const daysUntilExpiry = () => {
    const expiryDate = user?.licenseExpiryDate || user?.license_expiry_date
    if (!expiryDate) return null
    const days = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  const getStatusBadgeColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'present':
        return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
      case 'checked_in':
        return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
      case 'checked_out':
        return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
      case 'absent':
        return 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
      case 'late':
        return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
      default:
        return 'bg-background text-text-primary'
    }
  }

  const formatShiftTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  const calcHours = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return 0
    const start = new Date(checkIn).getTime()
    const end = new Date(checkOut).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) return 0
    return Math.max(0, (end - start) / (1000 * 60 * 60))
  }

  const handleScheduleSubmit = async (event: React.FormEvent) => {
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
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          guard_id: user.id,
          start_time: startLocal.toISOString(),
          end_time: endLocal.toISOString(),
          client_site: scheduleForm.clientSite
        })
      })

      if (!response.ok) {
        let errorMsg = 'Failed to request schedule.'
        try {
          const data = await response.json()
          errorMsg = data.error || data.message || errorMsg
        } catch {
          // If response is not JSON, try to get text
          try {
            const text = await response.text()
            errorMsg = text || errorMsg
          } catch {
            errorMsg = `Server error: ${response.status} ${response.statusText}`
          }
        }
        setScheduleStatus(errorMsg)
        return
      }

      setScheduleStatus('Schedule request submitted.')
      setScheduleForm({ clientSite: '', date: '', startTime: '', endTime: '' })
      fetchSchedule(user.id)
    } catch (err) {
      setScheduleStatus(err instanceof Error ? err.message : 'Failed to request schedule.')
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const handleTicketSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id) return

    if (!ticketForm.subject || !ticketForm.message) {
      setTicketStatus('Subject and message are required.')
      return
    }

    setTicketSubmitting(true)
    setTicketStatus('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/support-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          guard_id: user.id,
          subject: ticketForm.subject,
          message: ticketForm.message
        })
      })

      if (!response.ok) {
        const data = await response.json()
        setTicketStatus(data.error || 'Failed to create ticket.')
        return
      }

      setTicketStatus('Ticket submitted successfully.')
      setTicketForm({ subject: '', message: '' })
      fetchTickets(user.id)
    } catch (err) {
      setTicketStatus(err instanceof Error ? err.message : 'Failed to create ticket.')
    } finally {
      setTicketSubmitting(false)
    }
  }

  const handleNavigate = (section: 'overview' | 'schedule' | 'firearms' | 'permits' | 'support' | 'calendar') => {
    if (section === 'calendar') {
      onViewChange?.('calendar')
      return
    }
    setActiveSection(section as 'overview' | 'schedule' | 'firearms' | 'permits' | 'support')
  }

  const handleCheckIn = async (shift: ShiftItem) => {
    if (!user?.id) return

    setCheckInSubmitting(prev => ({ ...prev, [shift.id]: true }))
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          guard_id: user.id,
          shift_id: shift.id
        })
      })

      if (!response.ok) {
        const data = await response.json()
        logError('Check-in failed:', data)
        return
      }

      const data = await response.json()
      setCheckInStatus(prev => ({ ...prev, [shift.id]: 'checked_in' }))
      setCheckInTimes(prev => ({ ...prev, [shift.id]: new Date() }))
      console.log('Check-in successful:', data.attendanceId)
    } catch (err) {
      logError('Check-in error:', err)
    } finally {
      setCheckInSubmitting(prev => ({ ...prev, [shift.id]: false }))
    }
  }

  const handleCheckOut = async (shift: ShiftItem) => {
    if (!user?.id) return

    // Find the most recent attendance for this shift
    const recentAttendance = attendance.find(a => 
      a.status === 'checked_in' && 
      new Date(a.check_in_time).toDateString() === new Date().toDateString()
    )

    if (!recentAttendance) {
      logError('No active check-in found', 'missing_recent_attendance')
      return
    }

    setCheckInSubmitting(prev => ({ ...prev, [shift.id]: true }))

    try {
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/attendance/check-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          attendance_id: recentAttendance.id
        })
      })

      if (!response.ok) {
        const data = await response.json()
        logError('Check-out failed:', data)
        return
      }

      setCheckInStatus(prev => ({ ...prev, [shift.id]: 'idle' }))
      setCheckInTimes(prev => {
        const newTimes = { ...prev }
        delete newTimes[shift.id]
        return newTimes
      })
      setElapsedTime(prev => {
        const newTimes = { ...prev }
        delete newTimes[shift.id]
        return newTimes
      })

      // Refresh attendance records
      if (user?.id) {
        await fetchAttendance(user.id)
      }

      console.log('Check-out successful')
    } catch (err) {
      logError('Check-out error:', err)
    } finally {
      setCheckInSubmitting(prev => ({ ...prev, [shift.id]: false }))
    }
  }

  const handleRefresh = async () => {
    if (!user?.id) return
    setLoading(true)
    await Promise.all([
      fetchAttendance(user.id),
      fetchSchedule(user.id),
      fetchFirearms(user.id),
      fetchPermits(user.id),
      fetchTickets(user.id)
    ])
    setLoading(false)
  }

  return (
    <div className="flex h-screen w-screen bg-background font-sans">
      <Sidebar
        items={navItems}
        activeView={activeSection}
        onNavigate={(view) => handleNavigate(view as typeof activeSection)}
        onLogoClick={() => handleNavigate('overview')}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title={
            activeSection === 'overview' ? `Welcome, ${user?.username}` :
            activeSection === 'schedule' ? 'My Schedule' :
            activeSection === 'firearms' ? 'Assigned Firearms' :
            activeSection === 'permits' ? 'My Permits' :
            'Contact Support'
          }
          badgeLabel={activeSection === 'overview' ? 'Overview' : activeSection.replace('-', ' ')}
          onLogout={onLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined}
          rightSlot={
            <button
              onClick={handleRefresh}
              className="px-3 py-2 text-sm font-semibold text-text-primary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              Refresh
            </button>
          }
        />

        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
          <div className="space-y-8">
            {/* Profile Section */}
            {activeSection === 'overview' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">My Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-4 bg-surface-elevated rounded-lg border border-border">
                  <label className="text-sm font-semibold text-text-secondary block mb-2">Full Name</label>
                  <p className="text-text-primary font-medium">{user?.fullName || user?.full_name || 'N/A'}</p>
                </div>
                <div className="p-4 bg-surface-elevated rounded-lg border border-border">
                  <label className="text-sm font-semibold text-text-secondary block mb-2">Email</label>
                  <p className="text-text-primary font-medium">{user?.email || 'N/A'}</p>
                </div>
                <div className="p-4 bg-surface-elevated rounded-lg border border-border">
                  <label className="text-sm font-semibold text-text-secondary block mb-2">Phone</label>
                  <p className="text-text-primary font-medium">{user?.phoneNumber || user?.phone_number || 'N/A'}</p>
                </div>
                <div className="p-4 bg-surface-elevated rounded-lg border border-border">
                  <label className="text-sm font-semibold text-text-secondary block mb-2">License Number</label>
                  <p className="text-text-primary font-medium">{user?.licenseNumber || user?.license_number || 'N/A'}</p>
                </div>
                <div className="p-4 bg-surface-elevated rounded-lg border border-border">
                  <label className="text-sm font-semibold text-text-secondary block mb-2">License Issued Date</label>
                  <p className="text-text-primary font-medium">
                    {(user?.licenseIssuedDate || user?.license_issued_date)
                      ? new Date(user.licenseIssuedDate || user.license_issued_date).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div className="p-4 bg-surface-elevated rounded-lg border border-border md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-semibold text-text-secondary block mb-2">Address</label>
                  <p className="text-text-primary font-medium">{user?.address || 'N/A'}</p>
                </div>
              </div>
              </section>
            )}

            {/* License Status */}
            {activeSection === 'overview' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">License Status</h2>
              <div className={`p-6 rounded-lg border flex items-center justify-between ${
                isLicenseExpired()
                  ? 'bg-red-500/10 border-red-500/40'
                  : 'bg-emerald-500/10 border-emerald-500/40'
              }`}>
                <div>
                  <p className="text-sm font-semibold text-text-secondary mb-1">License Expiry Date</p>
                  <p className="text-lg font-bold text-text-primary">
                    {(user?.licenseExpiryDate || user?.license_expiry_date)
                      ? new Date(user.licenseExpiryDate || user.license_expiry_date).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div className={`px-6 py-3 rounded-lg text-center ${
                  isLicenseExpired()
                    ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                }`}>
                  {isLicenseExpired() ? (
                    <>
                      <div className="text-2xl mb-1">⚠️</div>
                      <div className="font-bold">EXPIRED</div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl mb-1">✓</div>
                      <div className="font-bold">ACTIVE</div>
                      {daysUntilExpiry() !== null && (
                        <div className="text-sm mt-1">{daysUntilExpiry()} days left</div>
                      )}
                    </>
                  )}
                </div>
              </div>
              </section>
            )}

            {activeSection === 'overview' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Live Location Tracking</h2>
                <div className="rounded-lg border border-border-subtle bg-surface-elevated p-4">
                  <p className="text-sm text-text-secondary">
                    Use your device location permission for real-time guard tracking. For best accuracy, keep GPS enabled and allow precise location.
                  </p>
                  {!hasLocationConsent ? (
                    <p className="mt-2 text-sm font-semibold text-amber-300">
                      Location consent is not accepted. Tracking remains disabled until consent is granted in the Terms prompt.
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleLocationTracking}
                      disabled={!hasLocationConsent}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                        !hasLocationConsent
                          ? 'cursor-not-allowed bg-slate-600 text-slate-200'
                          : locationTrackingEnabled
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {locationTrackingEnabled ? 'Turn Off Live Location' : 'Turn On Live Location'}
                    </button>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        locationTrackingEnabled
                          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                          : 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30'
                      }`}
                    >
                      {locationTrackingEnabled ? 'Tracking Enabled' : 'Tracking Disabled'}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        !hasLocationConsent
                          ? 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30'
                          : locationPermissionState === 'granted'
                          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                          : locationPermissionState === 'denied'
                            ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
                            : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                      }`}
                    >
                      Permission: {hasLocationConsent ? locationPermissionState : 'consent-required'}
                    </span>
                  </div>
                  <div className="mt-3 rounded-md border border-border-subtle bg-background px-3 py-2">
                    <p className="text-xs font-semibold text-text-secondary">Location Accuracy Meter</p>
                    <p className="text-sm font-bold text-text-primary">
                      {locationAccuracyMeters != null ? `${Math.round(locationAccuracyMeters)} m` : 'No fix yet'}
                    </p>
                    <p className="text-xs text-text-secondary">
                      Quality: {locationAccuracyQuality === 'high' ? 'High (GPS-level)' : locationAccuracyQuality === 'medium' ? 'Moderate' : locationAccuracyQuality === 'low' ? 'Low, may drift' : 'Waiting for position'}
                    </p>
                    {locationAccuracyQuality === 'low' ? (
                      <p className="mt-1 text-xs font-semibold text-danger-text" role="status">
                        Warning: location accuracy is low. Keep precise location enabled for better map precision.
                      </p>
                    ) : null}
                  </div>
                  {locationTrackingMessage ? <p className="mt-3 text-xs text-text-secondary">{locationTrackingMessage}</p> : null}
                </div>
              </section>
            )}

            {/* Active Shift Section */}
            {activeSection === 'overview' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Today's Shifts</h2>
                {activeShifts && activeShifts.length > 0 ? (
                  <div className="space-y-4">
                    {activeShifts.map((shift) => (
                      <div key={shift.id} className="bg-surface-elevated rounded-lg border border-blue-500/40 p-6 flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-text-primary mb-2">{shift.client_site}</h3>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-text-secondary font-semibold">Time</p>
                              <p className="text-text-primary">{formatShiftTime(shift.start_time, shift.end_time)}</p>
                            </div>
                            <div>
                              <p className="text-text-secondary font-semibold">Status</p>
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                checkInStatus[shift.id] === 'checked_in'
                                  ? 'bg-green-500/15 text-green-300 ring-1 ring-green-500/30'
                                  : 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
                              }`}>
                                {checkInStatus[shift.id] === 'checked_in' ? 'Checked In' : 'Ready to Check In'}
                              </span>
                            </div>
                            {elapsedTime[shift.id] && (
                              <div>
                                <p className="text-text-secondary font-semibold">Elapsed Time</p>
                                <p className="text-emerald-300 font-mono">{elapsedTime[shift.id]}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3">
                          {checkInStatus[shift.id] !== 'checked_in' ? (
                            <button
                              onClick={() => handleCheckIn(shift)}
                              disabled={checkInSubmitting[shift.id]}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-70"
                            >
                              {checkInSubmitting[shift.id] ? 'Checking In...' : 'Check In'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCheckOut(shift)}
                              disabled={checkInSubmitting[shift.id]}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-70"
                            >
                              {checkInSubmitting[shift.id] ? 'Checking Out...' : 'Check Out'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-text-secondary">No shifts assigned for today</p>
                )}
              </section>
            )}

            {/* Attendance Section */}
            {activeSection === 'overview' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Recent Attendance</h2>
              {loading ? (
                <div className="text-center py-8 text-text-secondary">Loading attendance records...</div>
              ) : attendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead className="thead-glass">
                      <tr>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Date</th>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Check-In</th>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Check-Out</th>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Hours</th>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 5).map((record) => (
                        <tr key={record.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                          <td className="px-6 py-3 text-text-primary">{new Date(record.check_in_time).toLocaleDateString()}</td>
                          <td className="px-6 py-3 text-text-primary">{new Date(record.check_in_time).toLocaleTimeString()}</td>
                          <td className="px-6 py-3 text-text-primary">{record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : '-'}</td>
                          <td className="px-6 py-3 text-text-primary">{calcHours(record.check_in_time, record.check_out_time).toFixed(1)} hrs</td>
                          <td className="px-6 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(record.status)}`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-text-secondary">No attendance records found</p>
              )}
              </section>
            )}

            {activeSection === 'schedule' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Shift Schedule</h2>
                <form className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleScheduleSubmit}>
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-text-secondary block mb-2">Client Site</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-border px-3 py-2 text-text-primary"
                      placeholder="Site name"
                      value={scheduleForm.clientSite}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, clientSite: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary block mb-2">Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-border px-3 py-2 text-text-primary"
                      value={scheduleForm.date}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, date: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary block mb-2">Start Time</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-border px-3 py-2 text-text-primary"
                      value={scheduleForm.startTime}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, startTime: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary block mb-2">End Time</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-border px-3 py-2 text-text-primary"
                      value={scheduleForm.endTime}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, endTime: event.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-4 flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={scheduleSubmitting}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-70"
                    >
                      {scheduleSubmitting ? 'Submitting...' : 'Request Schedule'}
                    </button>
                    {scheduleStatus && (
                      <span className="text-sm font-semibold text-text-primary">{scheduleStatus}</span>
                    )}
                  </div>
                </form>
                {scheduleItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead className="thead-glass">
                        <tr>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Site</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Date</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Time</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleItems.map((item) => (
                          <tr key={item.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                            <td className="px-6 py-3 text-text-primary">{item.client_site}</td>
                            <td className="px-6 py-3 text-text-primary">{new Date(item.start_time).toLocaleDateString()}</td>
                            <td className="px-6 py-3 text-text-primary">{formatShiftTime(item.start_time, item.end_time)}</td>
                            <td className="px-6 py-3">
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-text-secondary">No shifts scheduled</p>
                )}
              </section>
            )}

            {activeSection === 'firearms' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Assigned Firearms</h2>
                {firearmItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead className="thead-glass">
                        <tr>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Serial Number</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Model</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Caliber</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Status</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Allocated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {firearmItems.map((item) => (
                          <tr key={item.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                            <td className="px-6 py-3 text-text-primary">{item.firearm_serial_number}</td>
                            <td className="px-6 py-3 text-text-primary">{item.firearm_model}</td>
                            <td className="px-6 py-3 text-text-primary">{item.firearm_caliber}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${item.status === 'active' ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-background text-text-primary'}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-text-primary">{new Date(item.allocation_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-text-secondary">No active allocations</p>
                )}
              </section>
            )}

            {activeSection === 'permits' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">My Permits</h2>
                {permitItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead className="thead-glass">
                        <tr>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Permit ID</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Type</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Issued</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Expiry</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permitItems.map((item) => (
                          <tr key={item.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                            <td className="px-6 py-3 text-text-primary">{item.id}</td>
                            <td className="px-6 py-3 text-text-primary">{item.permit_type}</td>
                            <td className="px-6 py-3 text-text-primary">{new Date(item.issued_date).toLocaleDateString()}</td>
                            <td className="px-6 py-3 text-text-primary">{new Date(item.expiry_date).toLocaleDateString()}</td>
                            <td className="px-6 py-3">
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-text-secondary">No permits found</p>
                )}
              </section>
            )}

            {activeSection === 'support' && (
              <section className="bg-surface rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Contacts Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="rounded-lg border border-border p-5">
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Operations Desk</h3>
                    <p className="text-sm text-text-secondary mb-3">24/7 support for urgent issues.</p>
                    <div className="text-sm text-text-primary">
                      <div>Phone: +63 912 345 6789</div>
                      <div>Email: ops@sentinel-security.com</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-5">
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Site Supervisor</h3>
                    <p className="text-sm text-text-secondary mb-3">For on-site scheduling changes.</p>
                    <div className="text-sm text-text-primary">
                      <div>Phone: +63 901 234 5678</div>
                      <div>Email: supervisor@sentinel-security.com</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-5">
                    <h3 className="text-lg font-semibold text-text-primary mb-2">HR and Compliance</h3>
                    <p className="text-sm text-text-secondary mb-3">Licensing and permit concerns.</p>
                    <div className="text-sm text-text-primary">
                      <div>Phone: +63 955 321 4567</div>
                      <div>Email: hr@sentinel-security.com</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-5">
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Submit a Ticket</h3>
                    <p className="text-sm text-text-secondary mb-3">We will respond within 24 hours.</p>
                    <form className="space-y-3" onSubmit={handleTicketSubmit}>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border px-3 py-2 text-text-primary"
                        placeholder="Subject"
                        value={ticketForm.subject}
                        onChange={(event) => setTicketForm((prev) => ({ ...prev, subject: event.target.value }))}
                      />
                      <textarea
                        className="w-full rounded-lg border border-border px-3 py-2 text-text-primary min-h-[96px]"
                        placeholder="Message"
                        value={ticketForm.message}
                        onChange={(event) => setTicketForm((prev) => ({ ...prev, message: event.target.value }))}
                      />
                      <button
                        type="submit"
                        disabled={ticketSubmitting}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-70"
                      >
                        {ticketSubmitting ? 'Submitting...' : 'Create Ticket'}
                      </button>
                      {ticketStatus && (
                        <div className="text-sm font-semibold text-text-primary">{ticketStatus}</div>
                      )}
                    </form>
                  </div>
                </div>

                <div className="bg-surface-elevated rounded-lg border border-border p-5">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">My Tickets</h3>
                  {ticketItems.length > 0 ? (
                    <div className="space-y-3">
                      {ticketItems.map((ticket) => (
                        <div key={ticket.id} className="bg-surface rounded-lg border border-border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-text-primary">{ticket.subject}</h4>
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30">
                              {ticket.status}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary mb-2">{ticket.message}</p>
                          <div className="text-xs text-text-tertiary">{new Date(ticket.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">No tickets yet.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default UserDashboard

