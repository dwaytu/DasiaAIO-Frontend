import { startTransition, useState, useEffect, useMemo, useCallback, FC, Suspense, lazy } from 'react'
import { useNavigate } from 'react-router'
import EditUserModal from '../EditUserModal'
import EditScheduleModal from '../EditScheduleModal'
import AnalyticsDashboard from '../AnalyticsDashboard'
import TripManagement from '../TripManagement'
import NotificationCenter, { Notification, createNotification } from '../NotificationCenter'
import { API_BASE_URL } from '../../config'
import type { User as AppUser } from '../../context/AuthContext'
import { getSidebarNav } from '../../config/navigation'
import { normalizeRole } from '../../types/auth'
import CommandCenterDashboard from '../dashboard/CommandCenterDashboard'
import OperationalMapPanel from '../dashboard/OperationalMapPanel'
import ResourceManagementPanel from './ResourceManagementPanel'
import { OperationalEventProvider } from '../../context/OperationalEventContext'
import AssignmentPicker from '../dashboard/AssignmentPicker'
import { TableLoadingState } from '../dashboard/ui/DashboardLoadingState'
import EmptyState from '../shared/EmptyState'
import SentinelModal from '../shared/SentinelModal'
import ConfirmationDialog from '../shared/ConfirmationDialog'
import RejectApprovalDialog from '../shared/RejectApprovalDialog'
import { CalendarPlus, ClipboardX, CalendarX2, Target } from 'lucide-react'
import Allowed from '../rbac/Allowed'
import DeniedFallback from '../rbac/DeniedFallback'
import OperationalShell from '../layout/OperationalShell'
import { ROUTES, VIEW_TO_ROUTE } from '../../router/routes'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { can } from '../../utils/permissions'
import {
  getPersonRecencyMinutes,
  getTrackingAccuracyMode,
  getVehicleRecencyMinutes,
  TrackingAccuracyMode,
} from '../../utils/trackingPolicy'
import { logError } from '../../utils/logger'
import { SupervisorInboxPanel } from '../inbox/SupervisorInboxPanel'
import { AdminInboxPanel } from '../inbox/AdminInboxPanel'
import { SuperadminInboxPanel } from '../inbox/SuperadminInboxPanel'
import { useOperationalMapData } from '../../hooks/useOperationalMapData'
import CreateGuardAccountModal from './CreateGuardAccountModal'
import GuardPasswordModal from './GuardPasswordModal'
import { localScheduleToUtc } from '../../utils/scheduleDateTime'
import OperationalRequestsPanel from '../requests/OperationalRequestsPanel'
import GuardSearchSelect from '../shared/GuardSearchSelect'
import SearchableSelect from '../shared/SearchableSelect'

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

const AuditDashboard = lazy(() => import('../AuditDashboard'))

interface User {
  id: string
  email: string
  username: string
  role: string
  last_seen_at?: string
  full_name?: string
  phone_number?: string
  guard_code?: string | null
  license_number?: string
  license_issued_date?: string
  license_expiry_date?: string
  address?: string
  [key: string]: any
}

interface PendingUserDeletion {
  users: User[]
  bulk: boolean
}

const ONLINE_WINDOW_MS = 3 * 60 * 1000
const USER_PAGE_SIZE = 10

const isUserOnline = (lastSeenAt?: string) => {
  if (!lastSeenAt) return false
  const lastSeen = new Date(lastSeenAt).getTime()
  if (Number.isNaN(lastSeen)) return false
  return Date.now() - lastSeen <= ONLINE_WINDOW_MS
}

const truncateText = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}...`
}

type UserDerivedStatus = 'active' | 'inactive' | 'pending' | 'suspended'

const getRelativeLastLogin = (lastSeenAt?: string) => {
  if (!lastSeenAt) return 'Never'
  const ts = new Date(lastSeenAt).getTime()
  if (Number.isNaN(ts)) return 'Unknown'

  const diffMs = Date.now() - ts
  if (diffMs < 0) return 'Just now'
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < minuteMs) return 'Just now'
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)} minutes ago`
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)} hours ago`
  if (diffMs < 2 * dayMs) return 'Yesterday'
  if (diffMs < 7 * dayMs) return `${Math.floor(diffMs / dayMs)} days ago`
  return new Date(ts).toLocaleDateString()
}

const getPreciseLastSeen = (lastSeenAt?: string) => {
  if (!lastSeenAt) return 'No signal'
  const ts = new Date(lastSeenAt).getTime()
  if (Number.isNaN(ts)) return 'Unknown'

  const diffMs = Math.max(Date.now() - ts, 0)
  if (diffMs < 60 * 1000) return `${Math.round(diffMs / 1000)}s ago`
  if (diffMs < 60 * 60 * 1000) return `${Math.round(diffMs / (60 * 1000))}m ago`
  return `${Math.round(diffMs / (60 * 60 * 1000))}h ago`
}

const getUserDerivedStatus = (user: User, pendingIds: Set<string>): UserDerivedStatus => {
  if (pendingIds.has(user.id)) return 'pending'
  if (user.suspended === true || user.status === 'suspended' || user.verified === false) return 'suspended'
  return isUserOnline(user.last_seen_at) ? 'active' : 'inactive'
}

const UserAvatar: FC<{ user: User }> = ({ user }) => {
  const normalizedRole = user.role === 'user' ? 'guard' : normalizeRole(user.role)
  const initial = (user.full_name || user.username || '?').charAt(0).toUpperCase()
  const avatarColor = normalizedRole === 'superadmin' || normalizedRole === 'admin'
    ? 'bg-info-bg text-info-text'
    : normalizedRole === 'supervisor'
      ? 'bg-warning-bg text-warning-text'
      : 'bg-success-bg text-success-text'

  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor}`} aria-hidden="true">
      {initial}
    </div>
  )
}

const RoleBadge: FC<{ roleRaw: string }> = ({ roleRaw }) => {
  const role = normalizeRole(roleRaw)
  const rolePill = role === 'superadmin' || role === 'admin'
    ? 'bg-info-bg text-info-text ring-1 ring-info-border'
    : role === 'supervisor'
      ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      : 'bg-success-bg text-success-text ring-1 ring-success-border'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${rolePill}`}>
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2a4 4 0 110 8 4 4 0 010-8zM3 16a7 7 0 0114 0v1H3v-1z" />
      </svg>
      {role}
    </span>
  )
}

const StatusIndicator: FC<{ status: UserDerivedStatus }> = ({ status }) => {
  const statusConfig: Record<UserDerivedStatus, { dot: string; glow: string; label: string; pill: string }> = {
    active: {
      dot: 'bg-(--color-success)',
      glow: '0 0 6px rgba(52,211,153,0.7)',
      label: 'Active',
      pill: 'bg-success-bg text-success-text ring-1 ring-success-border',
    },
    inactive: {
      dot: 'bg-text-tertiary',
      glow: '0 0 6px rgba(161,161,170,0.7)',
      label: 'Inactive',
      pill: 'soc-status-neutral',
    },
    pending: {
      dot: 'bg-(--color-warning)',
      glow: '0 0 6px rgba(251,191,36,0.7)',
      label: 'Pending',
      pill: 'bg-warning-bg text-warning-text ring-1 ring-warning-border',
    },
    suspended: {
      dot: 'bg-(--color-danger)',
      glow: '0 0 6px rgba(248,113,113,0.7)',
      label: 'Suspended',
      pill: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
    },
  }

  const current = statusConfig[status]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${current.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} style={{ boxShadow: current.glow }} aria-hidden="true" />
      {current.label}
    </span>
  )
}

interface PendingApprovalUser {
  id: string
  email: string
  username: string
  role: string
  full_name?: string
  phone_number?: string
  license_number?: string
  license_issued_date?: string
  license_expiry_date?: string
  verified: boolean
  approval_status: string
  created_by_name?: string
  created_at: string
}

interface ClientSiteOption {
  id: string
  name: string
  address?: string | null
  isActive?: boolean
}

interface SuperadminDashboardProps {
  user: AppUser
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface SuperadminOperationsMapSectionProps {
  trackingAccuracyMode: TrackingAccuracyMode
}

const SuperadminOperationsMapSection: FC<SuperadminOperationsMapSectionProps> = ({ trackingAccuracyMode }) => {
  const { trackingPoints, hasTrackingAccess } = useOperationalMapData()

  const mapCounts = useMemo(() => {
    if (!hasTrackingAccess || trackingPoints.length === 0) {
      return { recentVehicleReports: 0, recentGuardReports: 0 }
    }

    const personRecencyMinutes = getPersonRecencyMinutes(trackingAccuracyMode)
    const vehicleRecencyMinutes = getVehicleRecencyMinutes(trackingAccuracyMode)
    const now = Date.now()
    const recentGuardReportIds = new Set<string>()
    const recentVehicleReportIds = new Set<string>()

    for (const point of trackingPoints) {
      const recordedAt = new Date(point.recordedAt).getTime()
      if (Number.isNaN(recordedAt)) continue

      const pointAgeMinutes = (now - recordedAt) / 60000
      const pointKey = point.entityId || point.userId || point.id
      if (!pointKey) continue

      if (point.entityType.toLowerCase() === 'vehicle') {
        const movementStatus = point.movementStatus?.trim().toLowerCase()
        if (pointAgeMinutes <= vehicleRecencyMinutes && movementStatus !== 'offline') {
          recentVehicleReportIds.add(pointKey)
        }
        continue
      }

      if (pointAgeMinutes <= personRecencyMinutes) {
        recentGuardReportIds.add(pointKey)
      }
    }

    return {
      recentVehicleReports: recentVehicleReportIds.size,
      recentGuardReports: recentGuardReportIds.size,
    }
  }, [hasTrackingAccess, trackingAccuracyMode, trackingPoints])

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
      <section className="soc-surface p-4 md:p-5 mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Intelligence</p>
        <h1 className="text-2xl font-black uppercase tracking-wide text-text-primary">Operations Map</h1>
        <p className="mt-1 text-sm text-text-secondary">Live geospatial view with guard movement intelligence, geofence alerts, and client location management.</p>
      </section>
      <div className="soc-surface p-0 overflow-hidden rounded" style={{ minHeight: '600px' }}>
        <OperationalEventProvider>
          <OperationalMapPanel
            recentVehicleReports={mapCounts.recentVehicleReports}
            recentGuardReports={mapCounts.recentGuardReports}
          />
        </OperationalEventProvider>
      </div>
    </div>
  )
}

const SuperadminDashboard: FC<SuperadminDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [, setStats] = useState<any>({})
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null)
  const [editingShift, setEditingShift] = useState<any | null>(null)
  const [error, setError] = useState<string>('')
  const [activeSection, setActiveSection] = useState<'inbox' | 'dashboard' | 'approvals' | 'requests' | 'schedule' | 'missions' | 'analytics' | 'trips' | 'audit-log' | 'manage' | 'operations-map'>('dashboard')
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false)
  const [missions, setMissions] = useState<any[]>([])
  const [missionsLoading, setMissionsLoading] = useState<boolean>(false)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalUser[]>([])
  const [selectedApproval, setSelectedApproval] = useState<PendingApprovalUser | null>(null)
  const [rejectionApproval, setRejectionApproval] = useState<PendingApprovalUser | null>(null)
  const [approvalsLoading, setApprovalsLoading] = useState<boolean>(false)
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [missionFormData, setMissionFormData] = useState({
    mission_name: '',
    date: '',
    start_time: '',
    end_time: '',
    destination: '',
    priority: 'medium',
    special_requirements: ''
  })
  const [missionResponse, setMissionResponse] = useState<any>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [trackingAccuracyMode] = useState<TrackingAccuracyMode>(getTrackingAccuracyMode())
  const [userPage, setUserPage] = useState(1)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false)
  const [pendingUserDeletion, setPendingUserDeletion] = useState<PendingUserDeletion | null>(null)
  const [availableGuards, setAvailableGuards] = useState<User[]>([])
  const [availableClientSites, setAvailableClientSites] = useState<ClientSiteOption[]>([])
  const [availableFirearms, setAvailableFirearms] = useState<any[]>([])
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [selectedGuards, setSelectedGuards] = useState<string>('')
  const [selectedFirearms, setSelectedFirearms] = useState<string>('')
  const [selectedVehicles, setSelectedVehicles] = useState<string>('')
  const [showAddScheduleForm, setShowAddScheduleForm] = useState<boolean>(false)
  const [, setRefreshing] = useState<boolean>(false)
  const [clientSitesLoading, setClientSitesLoading] = useState<boolean>(false)
  const [clientSitesError, setClientSitesError] = useState<string>('')
  const [createGuardModalOpen, setCreateGuardModalOpen] = useState<boolean>(false)
  const [scheduleFormData, setScheduleFormData] = useState({
    guard_id: '',
    client_site: '',
    date: '',
    start_time: '',
    end_time: ''
  })
  const normalizedViewerRole = normalizeRole(user.role)
  const isSuperadminViewer = normalizedViewerRole === 'superadmin'
  const isAdminViewer = normalizedViewerRole === 'admin'
  const isSupervisorViewer = normalizedViewerRole === 'supervisor'
  const canManageUsers = can(normalizedViewerRole, 'manage_users')
  const canApproveGuards = normalizedViewerRole === 'admin' || normalizedViewerRole === 'superadmin'
  const canCreateGuardAccounts =
    normalizedViewerRole === 'superadmin' ||
    normalizedViewerRole === 'admin' ||
    normalizedViewerRole === 'supervisor'
  const canViewUserDirectory = canManageUsers || canCreateGuardAccounts
  const navItems = getSidebarNav(user.role)
  const navigate = useNavigate()
  const handleInboxAction = useCallback((type: string) => {
    if (type === 'operational-request') {
      navigate(ROUTES.REQUESTS)
    } else if (type === 'approval') {
      navigate(ROUTES.APPROVALS)
    } else if (type === 'firearm') {
      navigate(ROUTES.FIREARMS)
    } else if (type === 'shift') {
      navigate(ROUTES.SCHEDULE)
    }
  }, [navigate])

  const canViewUserRow = (targetRoleRaw: string) => {
    const targetRole = normalizeRole(targetRoleRaw)
    if (isSuperadminViewer) return true
    if (isAdminViewer) return targetRole !== 'superadmin'
    if (isSupervisorViewer) return targetRole === 'guard'
    return false
  }
  const canEditUserRow = (targetRoleRaw: string) => {
    const targetRole = normalizeRole(targetRoleRaw)
    if (isSuperadminViewer) return true
    if (isAdminViewer) return targetRole !== 'superadmin'
    if (isSupervisorViewer) return targetRole === 'guard'
    return false
  }
  const sectionTitle =
    activeSection === 'inbox' ? 'Inbox' :
    activeSection === 'dashboard' ? 'Dashboard' :
    activeSection === 'approvals' ? 'Guard Approvals' :
    activeSection === 'requests' ? 'Operational Requests' :
    activeSection === 'schedule' ? 'Guard Schedules' :
    activeSection === 'missions' ? 'Mission Assignment' :
    activeSection === 'analytics' ? 'Analytics & Reports' :
    activeSection === 'trips' ? 'Trip Management' :
    activeSection === 'audit-log' ? 'System Audit Log' :
    activeSection === 'manage' ? 'Resource Management' :
    activeSection === 'operations-map' ? 'Operations Map' : 'Dashboard'
  const badgeLabel =
    activeSection === 'dashboard' ? 'Overview' :
    activeSection === 'approvals' ? 'Approvals' :
    activeSection === 'requests' ? 'Requests' :
    activeSection === 'trips' ? 'Trips' :
    activeSection === 'audit-log' ? 'Audit Log' :
    activeSection === 'manage' ? 'Management' :
    activeSection === 'operations-map' ? 'Ops Map' :
    activeSection.replace('-', ' ')

  const addNotification = (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => {
    const notification = createNotification(type, title, message)
    setNotifications(prev => [...prev, notification])
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  useEffect(() => {
    const controller = new AbortController()

    if (canViewUserDirectory) {
      void fetchData(controller.signal)
    } else {
      setLoading(false)
      setUsers([])
      setStats({
        totalUsers: 0,
        superadmins: 0,
        admins: 0,
        supervisors: 0,
        guards: 0,
      })
    }
    fetchGuardsAndFirearms()
    if (activeSection === 'dashboard') {
      if (canApproveGuards) fetchPendingApprovals()
      fetchShifts()
      fetchMissions()
    } else if (activeSection === 'approvals') {
      if (canApproveGuards) fetchPendingApprovals()
    } else if (activeSection === 'schedule') {
      fetchShifts()
      fetchClientSites()
    } else if (activeSection === 'missions') {
      fetchMissions()
    }

    return () => controller.abort()
  }, [activeSection, canViewUserDirectory, canApproveGuards])

  useEffect(() => {
    if (!activeView) return
    const viewToSection: Record<string, 'inbox' | 'dashboard' | 'approvals' | 'requests' | 'schedule' | 'missions' | 'analytics' | 'trips' | 'audit-log' | 'manage' | 'operations-map'> = {
      inbox: 'inbox',
      users: 'dashboard',
      dashboard: 'dashboard',
      approvals: 'approvals',
      requests: 'requests',
      schedule: 'schedule',
      missions: 'missions',
      analytics: 'analytics',
      trips: 'trips',
      'audit-log': 'audit-log',
      manage: 'manage',
      'operations-map': 'operations-map',
    }
    const nextSection = viewToSection[activeView]
    if (nextSection) {
      setActiveSection((previousSection) => previousSection === nextSection ? previousSection : nextSection)
    }
  }, [activeView])

  const fetchData = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const data = await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/users?page_size=200`,
        { headers: getAuthHeaders(), signal },
        'Failed to fetch users',
      )
      const users = Array.isArray(data) ? data : (data.users || data || [])
      setUsers(users)
      
      // Calculate stats
      const superadminCount = users.filter((u: User) => u.role === 'superadmin').length
      const adminCount = users.filter((u: User) => u.role === 'admin').length
      const supervisorCount = users.filter((u: User) => u.role === 'supervisor').length
      const guardCount = users.filter((u: User) => normalizeRole(u.role) === 'guard').length
      
      setStats({
        totalUsers: users.length,
        superadmins: superadminCount,
        admins: adminCount,
        supervisors: supervisorCount,
        guards: guardCount,
      })
    } catch (err) {
      if (signal?.aborted || isAbortError(err)) return
      logError('Error fetching data:', err)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const fetchShifts = async () => {
    try {
      setShiftsLoading(true)
      const data = await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/guard-replacement/shifts`,
        { headers: getAuthHeaders() },
        'Failed to fetch shifts',
      )
      setShifts(data.shifts || [])
      setError('')
    } catch (err) {
      setError('Error loading shifts: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setShiftsLoading(false)
    }
  }

  const fetchMissions = async () => {
    try {
      setMissionsLoading(true)
      const data = await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/missions`,
        { headers: getAuthHeaders() },
        'Failed to fetch missions',
      )
      setMissions(data.missions || [])
      setError('')
    } catch (err) {
      setError('Error loading missions: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setMissionsLoading(false)
    }
  }

  const fetchClientSites = async () => {
    try {
      setClientSitesLoading(true)
      setClientSitesError('')
      const data = await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/tracking/client-sites`,
        { headers: getAuthHeaders() },
        'Failed to fetch client sites',
      )
      const sites = Array.isArray(data?.sites) ? data.sites : []
      const normalizedSites = sites
        .filter((site: any) => typeof site?.name === 'string' && site.name.trim().length > 0)
        .filter((site: any) => site.isActive !== false)
        .map((site: any) => ({
          id: String(site.id || site.name),
          name: String(site.name),
          address: typeof site.address === 'string' && site.address.trim().length > 0 ? site.address : null,
          isActive: site.isActive !== false,
        }))
      setAvailableClientSites(normalizedSites)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch client sites'
      setClientSitesError(message)
      logError('Error fetching client sites:', err)
    } finally {
      setClientSitesLoading(false)
    }
  }

  const fetchPendingApprovals = async () => {
    try {
      setApprovalsLoading(true)
      const data = await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/users/pending-approvals`,
        { headers: getAuthHeaders() },
        'Failed to fetch pending approvals',
      )
      const pendingList = Array.isArray(data) ? data : (data.users || data || [])
      setPendingApprovals(pendingList)
      setError('')
    } catch (err) {
      setError('Error loading pending approvals: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setApprovalsLoading(false)
    }
  }

  const fetchGuardsAndFirearms = async () => {
    try {
      const [guardsData, firearmsData, vehiclesData] = await Promise.all([
        fetchJsonOrThrow<any>(
          `${API_BASE_URL}/api/guards`,
          { headers: getAuthHeaders() },
          'Failed to fetch guards',
        ),
        fetchJsonOrThrow<any>(
          `${API_BASE_URL}/api/firearms`,
          { headers: getAuthHeaders() },
          'Failed to fetch firearms',
        ),
        fetchJsonOrThrow<any>(
          `${API_BASE_URL}/api/armored-cars`,
          { headers: getAuthHeaders() },
          'Failed to fetch armored cars',
        ),
      ])

      const guards = Array.isArray(guardsData) ? guardsData : (guardsData?.guards || [])
      setAvailableGuards(guards)

      const firearms = Array.isArray(firearmsData) ? firearmsData : (firearmsData?.firearms || [])
      setAvailableFirearms(firearms.filter((f: any) => {
        const expiry = f.licenseExpiryDate || f.license_expiry_date
        return f.status === 'available' && expiry && new Date(expiry).getTime() > Date.now()
      }))

      const vehicles = Array.isArray(vehiclesData)
        ? vehiclesData
        : (vehiclesData?.armored_cars || vehiclesData?.vehicles || [])
      setAvailableVehicles(vehicles.filter((v: any) => ['available', 'operational'].includes(String(v.status).toLowerCase())))
    } catch (err) {
      logError('Error fetching assignment resources:', err)
    }
  }

  const handleMissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setMissionsLoading(true)
      setError('')
      
      // Validate selections
      if (!selectedGuards) {
        addNotification('error', 'Validation Error', 'Please select a guard')
        setMissionsLoading(false)
        return
      }
      if (!selectedFirearms) {
        addNotification('error', 'Validation Error', 'Please select a firearm')
        setMissionsLoading(false)
        return
      }
      if (!selectedVehicles) {
        addNotification('error', 'Validation Error', 'Please select a vehicle')
        setMissionsLoading(false)
        return
      }
      
      const data = await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/missions/assign`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...missionFormData,
          guards_required: selectedGuards ? 1 : 0,
          firearms_required: selectedFirearms ? 1 : 0,
          vehicles_required: selectedVehicles ? 1 : 0,
          guard_id: selectedGuards,
          firearm_id: selectedFirearms,
          vehicle_id: selectedVehicles,
        })
      }, 'Failed to assign mission')
      setMissionResponse(data)
      
      // Add success notification
      addNotification(
        'success',
        'Mission Assigned Successfully',
        `Mission ${missionFormData.mission_name} assigned with ${data.allocated_resources?.guards?.length || 0} guards, ${data.allocated_resources?.firearms?.length || 0} firearms, and ${data.allocated_resources?.vehicles?.length || 0} vehicles`
      )
      
      // Reset form
      setMissionFormData({
        mission_name: '',
        date: '',
        start_time: '',
        end_time: '',
        destination: '',
        priority: 'medium',
        special_requirements: ''
      })
      setSelectedGuards('')
      setSelectedFirearms('')
      setSelectedVehicles('')

      // Refresh missions list
      await fetchMissions()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign mission'
      setError(message)
      addNotification('error', 'Mission Assignment Failed', message)
    } finally {
      setMissionsLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    if (view === 'approvals' && !canApproveGuards) return
    const route = VIEW_TO_ROUTE[view]
    if (route) {
      startTransition(() => { void navigate(route) })
    } else if (onViewChange) {
      onViewChange(view)
    }
  }

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const hasRequiredFields = scheduleFormData.guard_id
      && scheduleFormData.client_site
      && scheduleFormData.date
      && scheduleFormData.start_time
      && scheduleFormData.end_time

    if (!hasRequiredFields) {
      const message = 'Select a guard, client site, date, start time, and end time before creating a schedule.'
      setError(message)
      addNotification('error', 'Schedule Incomplete', message)
      return
    }

    try {
      setShiftsLoading(true)
      setError('')

      const { startTime, endTime } = localScheduleToUtc(
        scheduleFormData.date,
        scheduleFormData.start_time,
        scheduleFormData.end_time,
      )
      
      const payload = {
        guardId: scheduleFormData.guard_id,
        clientSite: scheduleFormData.client_site,
        startTime,
        endTime,
        status: 'scheduled'
      }

      await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/guard-replacement/shifts`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      }, 'Failed to create schedule')

      addNotification('success', 'Schedule Created', 'Guard schedule created successfully')
      
      // Reset form
      setScheduleFormData({
        guard_id: '',
        client_site: '',
        date: '',
        start_time: '',
        end_time: ''
      })
      setShowAddScheduleForm(false)

      // Refresh shifts list
      await fetchShifts()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create schedule'
      setError(message)
      addNotification('error', 'Schedule Creation Failed', message)
    } finally {
      setShiftsLoading(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
  }

  const handleSaveUser = async (updatedData: Partial<User>) => {
    if (!editingUser) return

    try {
      await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/user/${editingUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updatedData),
      }, 'Failed to update user')

      // Refresh user list
      await fetchData()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
      throw err
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/user/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }, 'Failed to delete user')

      // Refresh user list
      await fetchData()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const requestDeleteUser = (userId: string, userEmail: string) => {
    const targetUser = users.find((candidate) => candidate.id === userId)
    setPendingUserDeletion({
      users: [targetUser ?? { id: userId, email: userEmail, username: userEmail, role: '' }],
      bulk: false,
    })
  }

  const rolePriority: Record<'superadmin' | 'admin' | 'supervisor' | 'guard', number> = {
    superadmin: 0,
    admin: 1,
    supervisor: 2,
    guard: 3,
  }

  const roleScopedUsers = users.filter(u => canViewUserRow(u.role))

  const pendingApprovalIds = useMemo(() => new Set(pendingApprovals.map(p => p.id)), [pendingApprovals])

  const userStatusById = useMemo(() => {
    const map = new Map<string, UserDerivedStatus>()
    for (const userRow of roleScopedUsers) {
      map.set(userRow.id, getUserDerivedStatus(userRow, pendingApprovalIds))
    }
    return map
  }, [roleScopedUsers, pendingApprovalIds])

  const filteredUsers = roleScopedUsers.filter((u) => {
    if (!searchQuery) return true
    const normalizedQuery = searchQuery.toLowerCase()
    const email = (u.email || '').toLowerCase()
    const username = (u.username || '').toLowerCase()
    const fullName = (u.full_name || '').toLowerCase()
    return email.includes(normalizedQuery) || username.includes(normalizedQuery) || fullName.includes(normalizedQuery)
  })
    .sort((a, b) => {
      const roleA = normalizeRole(a.role)
      const roleB = normalizeRole(b.role)
      const roleOrderA = roleA == null ? Number.MAX_SAFE_INTEGER : rolePriority[roleA]
      const roleOrderB = roleB == null ? Number.MAX_SAFE_INTEGER : rolePriority[roleB]
      const roleDelta = roleOrderA - roleOrderB
      if (roleDelta !== 0) return roleDelta

      const nameA = (a.full_name || a.username || a.email || '').toLowerCase()
      const nameB = (b.full_name || b.username || b.email || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

  const totalVisibleUsers = filteredUsers.length
  const totalUserPages = Math.max(1, Math.ceil(totalVisibleUsers / USER_PAGE_SIZE))
  const pagedUsers = filteredUsers.slice((userPage - 1) * USER_PAGE_SIZE, userPage * USER_PAGE_SIZE)

  useEffect(() => {
    setUserPage((page) => Math.min(page, totalUserPages))
  }, [totalUserPages])

  const summaryStats = useMemo(() => {
    const active = roleScopedUsers.filter(u => getUserDerivedStatus(u, pendingApprovalIds) === 'active').length
    const pending = roleScopedUsers.filter(u => getUserDerivedStatus(u, pendingApprovalIds) === 'pending').length
    const supervisors = roleScopedUsers.filter(u => normalizeRole(u.role) === 'supervisor').length
    const guards = roleScopedUsers.filter(u => normalizeRole(u.role) === 'guard').length
    return {
      total: roleScopedUsers.length,
      active,
      pending,
      supervisors,
      guards,
    }
  }, [roleScopedUsers, pendingApprovalIds])

  const selectableUserIds = pagedUsers
    .filter(u => canEditUserRow(u.role) && u.id !== user.id)
    .map(u => u.id)

  const allSelectableChecked = selectableUserIds.length > 0 && selectableUserIds.every(id => selectedUserIds.includes(id))

  const toggleUserSelection = (targetId: string) => {
    setSelectedUserIds((prev) => prev.includes(targetId) ? prev.filter(id => id !== targetId) : [...prev, targetId])
  }

  const toggleSelectAllVisible = () => {
    if (allSelectableChecked) {
      setSelectedUserIds((prev) => prev.filter(id => !selectableUserIds.includes(id)))
      return
    }
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...selectableUserIds])))
  }

  const canResetGuardPassword = normalizeRole(user.role) === 'admin' || normalizeRole(user.role) === 'superadmin'

  const handleResetPasswordAction = (targetUser: User) => {
    if (!canResetGuardPassword || normalizeRole(targetUser.role) !== 'guard') return
    setPasswordResetUser(targetUser)
  }

  const handleSuspendAction = (targetUser: User) => {
    addNotification(
      'warning',
      'Suspend Unavailable',
      `Suspension endpoint is not configured yet for ${targetUser.email}.`
    )
  }

  const handleApproveIfPending = async (targetUser: User) => {
    if (!pendingApprovalIds.has(targetUser.id)) return
    await handleApprovalAction(targetUser.id, 'approve')
  }

  const handleBulkApproveSelected = async () => {
    const pendingSelected = selectedUserIds.filter(id => pendingApprovalIds.has(id))
    if (pendingSelected.length === 0) {
      addNotification('info', 'No Pending Accounts Selected', 'Select at least one pending account to approve.')
      return
    }

    try {
      setBulkProcessing(true)
      await Promise.all(pendingSelected.map((id) => handleApprovalAction(id, 'approve')))
      addNotification('success', 'Bulk Approval Complete', `${pendingSelected.length} account(s) approved.`)
      setSelectedUserIds((prev) => prev.filter(id => !pendingSelected.includes(id)))
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkDeleteSelected = () => {
    if (!canManageUsers) {
      addNotification('info', 'Delete Not Available', 'Supervisors can edit guard records but cannot delete accounts.')
      return
    }

    const deletableUsers = filteredUsers.filter(u => selectedUserIds.includes(u.id) && canEditUserRow(u.role) && u.id !== user.id)
    if (deletableUsers.length === 0) {
      addNotification('info', 'No Deletable Users Selected', 'Select users you are allowed to remove.')
      return
    }

    setPendingUserDeletion({ users: deletableUsers, bulk: true })
  }

  const confirmUserDeletion = async () => {
    if (!pendingUserDeletion) return

    if (!pendingUserDeletion.bulk) {
      const targetUser = pendingUserDeletion.users[0]
      await deleteUser(targetUser.id)
      return
    }

    try {
      setBulkProcessing(true)
      await Promise.all(
        pendingUserDeletion.users.map((targetUser) =>
          fetchJsonOrThrow<any>(`${API_BASE_URL}/api/user/${targetUser.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          }, `Failed to delete ${targetUser.email}`)
        )
      )
      addNotification('success', 'Bulk Delete Complete', `${pendingUserDeletion.users.length} account(s) deleted.`)
      await fetchData()
      setSelectedUserIds([])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bulk delete failed'
      setError(message)
      addNotification('error', 'Bulk Delete Failed', message)
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkSuspendSelected = () => {
    addNotification(
      'warning',
      'Bulk Suspend Unavailable',
      'Suspend endpoint is not configured yet. Add backend suspend support to enable this action.'
    )
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      const tasks: Promise<any>[] = [fetchData()]
      if (canApproveGuards && (activeSection === 'dashboard' || activeSection === 'approvals')) tasks.push(fetchPendingApprovals())
      if (activeSection === 'dashboard' || activeSection === 'schedule') tasks.push(fetchShifts())
      if (activeSection === 'dashboard' || activeSection === 'missions') tasks.push(fetchMissions())
      await Promise.all(tasks)
    } finally {
      window.setTimeout(() => setRefreshing(false), 500)
    }
  }

  const handleApprovalAction = async (targetUserId: string, action: 'approve' | 'reject', reason?: string): Promise<boolean> => {
    try {
      setProcessingApprovalId(targetUserId)
      await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/users/${targetUserId}/approval`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action, reason }),
      }, `Failed to ${action} account`)

      addNotification(
        'success',
        action === 'approve' ? 'Guard Approved' : 'Guard Rejected',
        action === 'approve' ? 'Guard account approved successfully' : 'Guard account rejected successfully'
      )
      await fetchPendingApprovals()
      await fetchData()
      setError('')
      return true
    } catch (err) {
      const message = `Unable to ${action} this guard account. Try again.`
      setError(message)
      addNotification('error', 'Approval Action Failed', message)
      return false
    } finally {
      setProcessingApprovalId(null)
    }
  }

  const openRejectionDialog = (approval: PendingApprovalUser) => {
    setRejectionApproval(approval)
    setError('')
  }

  return (
    <>
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
      <OperationalShell
        user={user}
        title={sectionTitle}
        badgeLabel={badgeLabel}
        navItems={navItems}
        activeView={activeSection}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        mobileMenuOpen={mobileMenuOpen}
        onMenuOpen={() => setMobileMenuOpen(true)}
        onMenuClose={() => setMobileMenuOpen(false)}
        onLogoClick={() => navigate(ROUTES.DASHBOARD)}
        error={error}
      >

        {activeSection === 'inbox' ? (
          <div className="p-6">
            {isSuperadminViewer ? (
              <SuperadminInboxPanel userId={user.id} onAction={handleInboxAction} />
            ) : isAdminViewer ? (
              <AdminInboxPanel userId={user.id} onAction={handleInboxAction} />
            ) : (
              <SupervisorInboxPanel userId={user.id} onAction={handleInboxAction} />
            )}
          </div>
        ) : activeSection === 'dashboard' && error ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <section className="w-full max-w-xl rounded border border-danger-border bg-danger-bg/70 p-6 text-left shadow-lg backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-danger-text/80">Command Overview Unavailable</p>
              <h2 className="mt-2 text-2xl font-bold text-danger-text">SENTINEL cannot reach the backend services.</h2>
              <p className="mt-3 text-sm leading-6 text-danger-text/90">
                Core command-center data is temporarily unavailable. Check the backend connection, then retry to restore analytics, mission status, and live operational summaries.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-danger-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
                >
                  Retry Dashboard
                </button>
                {canApproveGuards && (
                  <button
                    type="button"
                    onClick={() => handleNavigate('approvals')}
                    className="inline-flex min-h-11 items-center justify-center rounded border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
                  >
                    Open Approvals
                  </button>
                )}
              </div>
            </section>
          </div>
        ) : activeSection === 'dashboard' && loading ? (
          <div className="flex-1 flex flex-col gap-6 p-4 md:p-8 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
            {/* Command center skeleton */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded border border-border-subtle bg-surface-elevated px-3 py-4">
                  <div className="h-3 w-20 rounded bg-border-subtle" />
                  <div className="mt-2 h-6 w-12 rounded bg-border-subtle" />
                </div>
              ))}
            </div>
            {/* Table skeleton */}
            <div className="rounded border border-border-subtle bg-surface overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border-subtle">
                <div className="h-5 w-40 rounded bg-border-subtle" />
                <div className="h-8 w-44 rounded bg-border-subtle" />
              </div>
              <div className="divide-y divide-border-subtle">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-4">
                    <div className="h-9 w-9 rounded-full bg-border-subtle shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-border-subtle" />
                      <div className="h-3 w-48 rounded bg-border-subtle" />
                    </div>
                    <div className="h-6 w-16 rounded-full bg-border-subtle" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeSection === 'dashboard' ? (
          <div className="w-full animate-fade-in space-y-4 md:space-y-6">
            <CommandCenterDashboard
              onNavigate={handleNavigate}
              quickActions={[
                { label: 'Assign Shift', tone: 'indigo', onClick: () => handleNavigate('schedule') },
                ...(canApproveGuards ? [{ label: 'Approve Guard', tone: 'emerald' as const, onClick: () => handleNavigate('approvals') }] : []),
                { label: 'Allocate Firearm', tone: 'blue', onClick: () => onViewChange?.('allocation') },
                { label: 'Assign Vehicle', tone: 'amber', onClick: () => onViewChange?.('armored-cars') },
                { label: 'Start Trip', tone: 'indigo', onClick: () => handleNavigate('trips') },
                { label: 'End Trip', tone: 'amber', onClick: () => handleNavigate('trips') },
                { label: 'Create Mission', tone: 'blue', onClick: () => handleNavigate('missions') },
              ]}
            />

            <section className="w-full bento-card p-0! overflow-hidden table-glass">
              {/* Table header â€” static, never scrolls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border-subtle shrink-0">
                <div>
                  <h2 className="soc-section-title">{isSupervisorViewer ? 'Guard Account Management' : 'User Management'}</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {isSupervisorViewer ? 'Create and update guard accounts assigned to your operations.' : 'Manage system users, permissions, and security roles'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canCreateGuardAccounts ? (
                    <button
                      type="button"
                      onClick={() => setCreateGuardModalOpen(true)}
                      className="soc-btn soc-btn-primary"
                    >
                      Create Guard Account
                    </button>
                  ) : null}
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                      type="text"
                      aria-label="Search users"
                      placeholder={isSupervisorViewer ? 'Search guards...' : 'Search users...'}
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value)
                        setUserPage(1)
                      }}
                      className="pl-9 pr-4 py-2 text-sm bg-background border border-border-subtle rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-(--color-focus-ring) w-44"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-b border-border-subtle px-5 py-4 md:grid-cols-4">
                <div className="rounded border border-border-subtle bg-background px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{isSupervisorViewer ? 'Total Guards' : 'Total Users'}</div>
                  <div className="mt-1 text-xl font-bold text-text-primary">{summaryStats.total}</div>
                </div>
                <div className="rounded border border-border-subtle bg-background px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Active</div>
                  <div className="mt-1 text-xl font-bold text-success-text">{summaryStats.active}</div>
                </div>
                <div className="rounded border border-border-subtle bg-background px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Pending</div>
                  <div className="mt-1 text-xl font-bold text-warning-text">{summaryStats.pending}</div>
                </div>
                <div className="rounded border border-border-subtle bg-background px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{isSupervisorViewer ? 'Guards' : 'Supervisors'}</div>
                  <div className="mt-1 text-xl font-bold text-info-text">{isSupervisorViewer ? summaryStats.guards : summaryStats.supervisors}</div>
                </div>
              </div>
              {selectedUserIds.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-background px-5 py-3">
                  <p className="text-sm font-medium text-text-secondary">
                    {selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'} selected
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {canApproveGuards ? (
                      <button
                        type="button"
                        onClick={handleBulkApproveSelected}
                        disabled={bulkProcessing}
                        className="soc-btn soc-btn-success"
                      >
                        Approve Selected
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleBulkSuspendSelected}
                      disabled={bulkProcessing}
                      title="Coming soon"
                      className="soc-btn soc-btn-warning opacity-50 cursor-not-allowed"
                    >
                      Suspend Selected
                    </button>
                    {canManageUsers ? (
                      <button
                        type="button"
                        onClick={handleBulkDeleteSelected}
                        disabled={bulkProcessing}
                        className="soc-btn soc-btn-danger"
                      >
                        Delete Selected
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      disabled={bulkProcessing}
                      className="rounded border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold text-text-secondary disabled:opacity-60"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
              {filteredUsers.length > 0 ? (
                <div className="soc-scroll-area flex-1 min-h-0 overflow-auto">
                  <table className="hidden w-full min-w-[980px] md:table">
                    <thead className="thead-glass">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={allSelectableChecked}
                              onChange={toggleSelectAllVisible}
                              className="h-4 w-4 rounded border-border-subtle bg-background"
                              aria-label="Select all visible users"
                            />
                            <span>Select</span>
                          </label>
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">User Details</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Username</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Role</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Status</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Last Login</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-text-tertiary">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {pagedUsers.map((u: User) => {
                        const derivedStatus = userStatusById.get(u.id) || 'inactive'
                        const rowSelected = selectedUserIds.includes(u.id)
                        const canEdit = canEditUserRow(u.role)
                        const canDelete = canManageUsers && canEditUserRow(u.role) && u.id !== user.id
                        const pendingApproval = pendingApprovalIds.has(u.id)
                        return (
                          <tr key={u.id} className="transition-colors hover:bg-surface-hover/50">
                            <td className="px-3 py-2.5 align-top">
                              <input
                                type="checkbox"
                                checked={rowSelected}
                                onChange={() => toggleUserSelection(u.id)}
                                className="h-4 w-4 rounded border-border-subtle bg-background"
                                aria-label={`Select ${u.full_name || u.username || u.email}`}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-3">
                                <UserAvatar user={u} />
                                <div className="min-w-0">
                                  <div
                                    className="text-sm font-medium text-text-primary truncate"
                                    title={u.full_name || u.username}
                                  >
                                    {truncateText(u.full_name || u.username, 26)}
                                  </div>
                                  <div className="text-xs text-text-tertiary truncate" title={u.email}>{truncateText(u.email, 30)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-sm text-text-secondary" title={u.username}>{truncateText(u.username, 22)}</td>
                            <td className="px-3 py-2.5">
                              <RoleBadge roleRaw={u.role} />
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusIndicator status={derivedStatus} />
                            </td>
                            <td className="px-3 py-2.5 text-xs text-text-secondary">
                              <div className="flex flex-col gap-0.5">
                                <span>{getRelativeLastLogin(u.last_seen_at)}</span>
                                <span className="text-[11px] text-text-tertiary">Signal {getPreciseLastSeen(u.last_seen_at)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                {pendingApproval && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveIfPending(u)}
                                    title="Approve pending user"
                                    aria-label={`Approve ${u.full_name || u.username || u.email}`}
                                    className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-success-bg hover:text-success-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
                                  >
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleEditUser(u)}
                                    title="Edit user"
                                    aria-label={`Edit ${u.full_name || u.username || u.email}`}
                                    className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-info-bg hover:text-info-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                )}
                                {canResetGuardPassword && normalizeRole(u.role) === 'guard' && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetPasswordAction(u)}
                                    title="Set temporary password"
                                    aria-label={`Set temporary password for ${u.full_name || u.username || u.email}`}
                                    className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-info-bg hover:text-info-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
                                  >
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-5a2 2 0 00-2-2H6a2 2 0 00-2 2v5a2 2 0 002 2zm10-12V7a4 4 0 00-8 0v3h8z" />
                                    </svg>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleSuspendAction(u)}
                                  title="Coming soon"
                                  aria-label={`Suspend ${u.full_name || u.username || u.email}`}
                                  className="min-h-11 min-w-11 rounded p-2 text-text-tertiary opacity-50 cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-12.728 12.728M8 7h8a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2z" />
                                  </svg>
                                </button>
                                <Allowed
                                  role={user.role}
                                  permission="manage_users"
                                  fallback={<DeniedFallback title="Delete blocked" reason="Your role cannot delete this account." />}
                                >
                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => requestDeleteUser(u.id, u.email)}
                                      title="Delete user"
                                      aria-label={`Delete ${u.full_name || u.username || u.email}`}
                                      className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-danger-bg hover:text-danger-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  )}
                                </Allowed>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="space-y-3 p-4 md:hidden">
                    {pagedUsers.map((u: User) => {
                      const derivedStatus = userStatusById.get(u.id) || 'inactive'
                      const rowSelected = selectedUserIds.includes(u.id)
                      const pendingApproval = pendingApprovalIds.has(u.id)
                      const canDelete = canManageUsers && canEditUserRow(u.role) && u.id !== user.id

                      return (
                        <article key={`mobile-${u.id}`} className="rounded border border-border-subtle bg-background p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={rowSelected}
                                onChange={() => toggleUserSelection(u.id)}
                                className="h-4 w-4 rounded border-border-subtle bg-background"
                                aria-label={`Select ${u.full_name || u.username || u.email}`}
                              />
                              <UserAvatar user={u} />
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-text-primary">{u.full_name || u.username}</h3>
                                <p className="truncate text-xs text-text-tertiary">{u.email}</p>
                              </div>
                            </div>
                            <StatusIndicator status={derivedStatus} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-text-tertiary">Role</p>
                              <div className="mt-1"><RoleBadge roleRaw={u.role} /></div>
                            </div>
                            <div>
                              <p className="text-text-tertiary">Last Login</p>
                              <p className="mt-1 font-medium text-text-secondary">{getRelativeLastLogin(u.last_seen_at)}</p>
                              <p className="mt-1 text-[11px] text-text-tertiary">Signal {getPreciseLastSeen(u.last_seen_at)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {pendingApproval ? (
                              <button
                                type="button"
                                onClick={() => handleApproveIfPending(u)}
                                className="soc-btn soc-btn-success"
                              >
                                Approve
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleEditUser(u)}
                              className="soc-btn soc-btn-neutral"
                            >
                              Edit
                            </button>
                            {canResetGuardPassword && normalizeRole(u.role) === 'guard' && (
                              <button
                                type="button"
                                onClick={() => handleResetPasswordAction(u)}
                                className="soc-btn soc-btn-neutral"
                              >
                                Set password
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSuspendAction(u)}
                              title="Coming soon"
                              className="soc-btn soc-btn-neutral opacity-50 cursor-not-allowed"
                            >
                              Suspend
                            </button>
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => requestDeleteUser(u.id, u.email)}
                                className="soc-btn soc-btn-danger"
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-text-secondary">No users found.</p>
                  <p className="mt-1 text-xs text-text-tertiary">Try a different search term.</p>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
                <p className="text-xs text-text-tertiary">
                  Showing {totalVisibleUsers === 0 ? 0 : (userPage - 1) * USER_PAGE_SIZE + 1}-{Math.min(userPage * USER_PAGE_SIZE, totalVisibleUsers)} of {totalVisibleUsers} users
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                    disabled={userPage === 1}
                    className="soc-btn soc-btn-neutral disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Previous user page"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-xs font-semibold text-text-secondary" aria-live="polite">
                    Page {userPage} of {totalUserPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
                    disabled={userPage === totalUserPages}
                    className="soc-btn soc-btn-neutral disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Next user page"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : activeSection === 'requests' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <OperationalRequestsPanel user={user} />
          </div>
        ) : activeSection === 'approvals' ? (
          <div className="flex-1 space-y-6 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {approvalsLoading ? (
              <TableLoadingState
                title="Pending Guard Registrations"
                subtitle="Loading approval queue and verification state."
                rows={4}
                columns={5}
              />
            ) : (
              <section className="w-full table-glass rounded p-4 md:p-5">
                <h2 className="text-2xl font-bold text-text-primary mb-6">Pending Guard Registrations</h2>
                <div className="overflow-auto">
                  <table className="w-full border-collapse min-w-[640px]">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Guard Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Requested Role</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Submitted Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApprovals.length === 0 ? (
                        <tr>
                          <td className="px-4 py-10 text-center" colSpan={5}>
                            <EmptyState icon={ClipboardX} title="No pending approvals" subtitle="All guard registrations have been processed" />
                          </td>
                        </tr>
                      ) : (
                        pendingApprovals.map((pendingUser) => (
                          <tr key={pendingUser.id} className="border-b border-border hover:bg-surface-hover">
                            <td className="px-4 py-3 text-text-primary">
                              <div className="font-medium">{pendingUser.full_name || pendingUser.username}</div>
                              <div className="text-xs text-text-tertiary">{pendingUser.email}</div>
                            </td>
                            <td className="px-4 py-3 text-text-primary uppercase">{normalizeRole(pendingUser.role)}</td>
                            <td className="px-4 py-3 text-text-primary">{new Date(pendingUser.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`soc-chip ${pendingUser.verified ? 'status-bar-warning text-warning-text' : 'status-bar-critical text-danger-text'}`}>
                                {pendingUser.verified ? 'Pending Approval' : 'Pending Verification'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setSelectedApproval(pendingUser)}
                                  className="soc-btn soc-btn-neutral"
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => handleApprovalAction(pendingUser.id, 'approve')}
                                  disabled={processingApprovalId === pendingUser.id}
                                  className="soc-btn soc-btn-success disabled:opacity-60"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => openRejectionDialog(pendingUser)}
                                  disabled={processingApprovalId === pendingUser.id}
                                  className="soc-btn soc-btn-danger disabled:opacity-60"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        ) : activeSection === 'schedule' ? (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden w-full animate-fade-in">
            {shiftsLoading ? (
              <TableLoadingState
                title="All Guard Schedules"
                subtitle="Loading current deployment roster."
                rows={5}
                columns={7}
              />
            ) : (
              <>
                <section className="flex flex-col flex-1 min-h-0 w-full rounded overflow-hidden table-glass mb-4">
                  <div className="shrink-0 px-6 py-5 border-b border-border-subtle flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-bold text-text-primary">All Guard Schedules</h2>
                    <button
                      type="button"
                      onClick={() => {
                        void fetchClientSites()
                        setShowAddScheduleForm(true)
                      }}
                      className="soc-btn soc-btn-primary w-full shrink-0 sm:w-auto"
                      title="Add a new guard schedule"
                    >
                      <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                      Add Schedule
                    </button>
                  </div>
                  {shifts.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full border-collapse min-w-[600px]">
                      <thead className="thead-glass">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Guard</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Site</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Start Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">End Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map((shift: any) => (
                          <tr key={shift.id} className="border-b border-border hover:bg-surface-hover">
                            <td className="px-4 py-3 text-text-primary">
                              <div className="font-medium">{shift.guard_name || shift.guard_username}</div>
                              <div className="text-xs text-text-tertiary">{shift.guard_username}</div>
                            </td>
                            <td className="px-4 py-3 text-text-primary">{shift.client_site}</td>
                            <td className="px-4 py-3 text-text-primary">{new Date(shift.start_time).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-text-primary">{new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-4 py-3 text-text-primary">{new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                shift.status === 'completed' ? 'bg-success-bg text-success-text ring-1 ring-success-border' :
                                shift.status === 'scheduled' ? 'bg-info-bg text-info-text ring-1 ring-info-border' :
                                shift.status === 'in_progress' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                                'soc-status-neutral'
                              }`}>
                                {shift.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                className="bg-primary hover:bg-primary-hover text-primary-text px-4 py-1.5 rounded text-sm font-medium transition-colors"
                                onClick={() => setEditingShift(shift)}
                                title="Edit shift"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={CalendarX2} title="No schedules found" subtitle="Create a new schedule to get started" />
                )}
              </section>

              <SentinelModal
                open={showAddScheduleForm}
                onClose={() => setShowAddScheduleForm(false)}
                title="Add New Schedule"
                subtitle="Assign a guard shift to a client site"
                size="lg"
              >
                {error && (
                  <div className="mb-4 p-3 bg-danger-bg border border-danger-border text-danger-text rounded text-sm">
                    {error}
                  </div>
                )}
                {clientSitesError && (
                  <div className="mb-4 p-3 bg-warning-bg border border-warning-border text-warning-text rounded text-sm">
                    {clientSitesError}
                  </div>
                )}

                <form onSubmit={handleScheduleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <GuardSearchSelect
                      id="schedule-guard"
                      label="Select Guard"
                      required
                      value={scheduleFormData.guard_id}
                      onChange={(value) => setScheduleFormData({ ...scheduleFormData, guard_id: value })}
                      guards={availableGuards.map((guard) => ({
                        id: guard.id,
                        fullName: guard.full_name,
                        username: guard.username,
                        guardCode: guard.guard_code,
                      }))}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <SearchableSelect
                      id="schedule-client-site"
                      label="Select Client Site"
                      required
                      value={scheduleFormData.client_site}
                      onChange={(value) => setScheduleFormData({ ...scheduleFormData, client_site: value })}
                      disabled={clientSitesLoading || availableClientSites.length === 0}
                      options={availableClientSites.map((site) => ({
                        id: site.id,
                        value: site.name,
                        label: site.name,
                        description: site.address,
                        searchValues: [site.name, site.address],
                      }))}
                      placeholder={clientSitesLoading ? 'Loading client sites...' : 'Search by site name or address...'}
                      helperText={clientSitesLoading ? 'Loading available client sites.' : 'Search by site name or address.'}
                      emptyMessage="No client sites are available."
                      noResultsMessage={(query) => `No client sites match "${query}". Try searching by site name or address.`}
                    />
                    {availableClientSites.length === 0 && !clientSitesLoading ? (
                      <p className="mt-1 text-xs text-text-tertiary">
                        No active client sites found. Add client sites in Operations Map or Resource Management first.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={scheduleFormData.date}
                      onChange={(e) => setScheduleFormData({...scheduleFormData, date: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-(--color-focus-ring) focus:border-(--color-focus-ring)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={scheduleFormData.start_time}
                      onChange={(e) => setScheduleFormData({...scheduleFormData, start_time: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-(--color-focus-ring) focus:border-(--color-focus-ring)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      value={scheduleFormData.end_time}
                      onChange={(e) => setScheduleFormData({...scheduleFormData, end_time: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-(--color-focus-ring) focus:border-(--color-focus-ring)"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={shiftsLoading || clientSitesLoading || availableClientSites.length === 0}
                      className="soc-btn-primary w-full min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {shiftsLoading ? 'Creating Schedule...' : 'Create Schedule'}
                    </button>
                  </div>
                </form>
              </SentinelModal>
            </>
            )}
          </div>
        ) : activeSection === 'missions' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {/* Mission Assignment Form */}
            <section className="w-full table-glass rounded p-6 md:p-8 mb-6">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Assign New Mission</h2>
              {error && (
                <div className="mb-4 p-3 bg-danger-bg border border-danger-border text-danger-text rounded text-sm">
                  {error}
                </div>
              )}
              {missionResponse && (
                <div className="mb-4 p-4 bg-success-bg border border-success-border rounded">
                  <h3 className="font-bold text-success-text mb-2">Mission Assigned Successfully!</h3>
                  <p className="text-sm text-text-primary mb-2">Mission ID: {missionResponse.mission_id}</p>
                  <div className="text-sm text-text-primary">
                    <p className="font-semibold">Allocated Resources:</p>
                    <ul className="ml-4 mt-1">
                      <li>Guards: {missionResponse.allocated_resources?.guards?.length || 0}</li>
                      <li>Firearms: {missionResponse.allocated_resources?.firearms?.length || 0}</li>
                      <li>Vehicles: {missionResponse.allocated_resources?.vehicles?.length || 0}</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => setMissionResponse(null)}
                    className="mt-2 text-sm text-success-text underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <form onSubmit={handleMissionSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="soc-form-label" htmlFor="mission-name">Mission Name</label>
                  <input
                    id="mission-name"
                    type="text"
                    required
                    value={missionFormData.mission_name}
                    onChange={(e) => setMissionFormData({...missionFormData, mission_name: e.target.value})}
                    placeholder="Enter mission name"
                    className="soc-form-control w-full"
                  />
                </div>

                <div>
                  <label className="soc-form-label" htmlFor="mission-destination">Destination</label>
                  <input
                    id="mission-destination"
                    type="text"
                    required
                    value={missionFormData.destination}
                    onChange={(e) => setMissionFormData({...missionFormData, destination: e.target.value})}
                    placeholder="Enter destination"
                    className="soc-form-control w-full"
                  />
                </div>

                <AssignmentPicker
                  id="mission-guard"
                  label="Select Guard"
                  required
                  tone="teal"
                  value={selectedGuards}
                  onChange={setSelectedGuards}
                  placeholder="-- Select a guard --"
                  emptyMessage="No approved guards are currently available."
                  options={availableGuards.map((guard) => ({ value: guard.id, label: guard.full_name || guard.username }))}
                />

                <AssignmentPicker
                  id="mission-firearm"
                  label="Select Firearm"
                  required
                  tone="indigo"
                  value={selectedFirearms}
                  onChange={setSelectedFirearms}
                  placeholder="-- Select a firearm --"
                  emptyMessage="No available firearms have a valid license."
                  options={availableFirearms.map((firearm) => ({
                    value: firearm.id,
                    label: `${firearm.serialNumber || firearm.serial_number || 'Unknown serial'} - ${firearm.model || 'Unknown model'} (${firearm.caliber || 'Unknown caliber'})`,
                  }))}
                />

                <AssignmentPicker
                  id="mission-vehicle"
                  label="Select Vehicle"
                  required
                  tone="amber"
                  value={selectedVehicles}
                  onChange={setSelectedVehicles}
                  placeholder="-- Select a vehicle --"
                  emptyMessage="No available vehicles are currently ready."
                  options={availableVehicles.map((vehicle) => ({ value: vehicle.id, label: `${vehicle.model} - ${vehicle.license_plate}` }))}
                />

                <div>
                  <label className="soc-form-label" htmlFor="mission-date">Date</label>
                  <input
                    id="mission-date"
                    type="date"
                    required
                    value={missionFormData.date}
                    onChange={(e) => setMissionFormData({...missionFormData, date: e.target.value})}
                    className="soc-form-control w-full"
                  />
                </div>

                <div>
                  <label className="soc-form-label" htmlFor="mission-start-time">Start Time</label>
                  <input
                    id="mission-start-time"
                    type="time"
                    required
                    value={missionFormData.start_time}
                    onChange={(e) => setMissionFormData({...missionFormData, start_time: e.target.value})}
                    className="soc-form-control w-full"
                  />
                </div>

                <div>
                  <label className="soc-form-label" htmlFor="mission-end-time">End Time</label>
                  <input
                    id="mission-end-time"
                    type="time"
                    required
                    value={missionFormData.end_time}
                    onChange={(e) => setMissionFormData({...missionFormData, end_time: e.target.value})}
                    className="soc-form-control w-full"
                  />
                </div>

                <div>
                  <label className="soc-form-label" htmlFor="mission-priority">Priority</label>
                  <select
                    id="mission-priority"
                    value={missionFormData.priority}
                    onChange={(e) => setMissionFormData({...missionFormData, priority: e.target.value})}
                    className="soc-form-control w-full"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="soc-form-label" htmlFor="mission-special-requirements">Special Requirements (Optional)</label>
                  <textarea
                    id="mission-special-requirements"
                    value={missionFormData.special_requirements}
                    onChange={(e) => setMissionFormData({...missionFormData, special_requirements: e.target.value})}
                    placeholder="Enter any special requirements"
                    rows={3}
                    className="soc-form-control w-full"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={missionsLoading}
                    className="soc-btn-primary w-full min-h-12 gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Target size={18} aria-hidden="true" />
                    {missionsLoading ? 'Assigning Mission...' : 'Assign Mission'}
                  </button>
                </div>
              </form>
            </section>

            {/* Mission History */}
            <section className="w-full table-glass rounded p-6 md:p-8">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Mission History</h2>
              {missionsLoading ? (
                <TableLoadingState
                  title="Mission History"
                  subtitle="Loading assignments, priorities, and field status."
                  rows={5}
                  columns={7}
                />
              ) : missions.length > 0 ? (
                <div className="overflow-auto">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Destination</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Time</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Vehicle</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Driver</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missions.map((mission: any) => (
                        <tr key={mission.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary text-xs font-mono">{mission.id.substring(0, 8)}...</td>
                          <td className="px-4 py-3 text-text-primary">{mission.destination || 'N/A'}</td>
                          <td className="px-4 py-3 text-text-primary">{mission.start_time ? new Date(mission.start_time).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-4 py-3 text-text-primary">
                            {mission.start_time && mission.end_time 
                              ? `${new Date(mission.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(mission.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                              : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-text-primary">{mission.vehicle_model || 'N/A'}</td>
                          <td className="px-4 py-3 text-text-primary">{mission.driver_name || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              mission.status === 'completed' ? 'bg-success-bg text-success-text ring-1 ring-success-border' :
                              mission.status === 'scheduled' ? 'bg-info-bg text-info-text ring-1 ring-info-border' :
                              mission.status === 'in_progress' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                              'soc-status-neutral'
                            }`}>
                              {mission.status || 'unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Target} title="No missions found" subtitle="Missions will appear here once assigned" />
              )}
            </section>
          </div>
        ) : activeSection === 'analytics' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <AnalyticsDashboard user={user} onLogout={onLogout} onViewChange={onViewChange ?? (() => undefined)} activeView={activeView ?? 'analytics'} />
          </div>
        ) : activeSection === 'trips' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <TripManagement />
          </div>
        ) : activeSection === 'audit-log' ? (
          <Suspense
            fallback={
              <section
                className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in"
                aria-live="polite"
              >
                <div className="table-glass rounded p-6 md:p-8">
                  <p className="text-sm text-text-secondary">Loading audit intelligence...</p>
                </div>
              </section>
            }
          >
            <AuditDashboard user={user} onLogout={onLogout} onViewChange={onViewChange ?? (() => undefined)} activeView={activeView ?? 'audit-log'} />
          </Suspense>
        ) : activeSection === 'manage' ? (
          <ResourceManagementPanel
            users={users}
            onDeleteUser={requestDeleteUser}
            onUsersChanged={fetchData}
            canManageUsers={canManageUsers}
            isSuperadminViewer={isSuperadminViewer}
          />
        ) : activeSection === 'operations-map' ? (
          <SuperadminOperationsMapSection trackingAccuracyMode={trackingAccuracyMode} />
        ) : null}

        <RejectApprovalDialog
          approval={rejectionApproval ? {
            id: rejectionApproval.id,
            fullName: rejectionApproval.full_name,
            username: rejectionApproval.username,
            email: rejectionApproval.email,
          } : null}
          submitting={processingApprovalId === rejectionApproval?.id}
          onClose={() => setRejectionApproval(null)}
          onSubmit={(reason) => rejectionApproval ? handleApprovalAction(rejectionApproval.id, 'reject', reason) : Promise.resolve(false)}
        />

        <ConfirmationDialog
          open={Boolean(pendingUserDeletion)}
          onClose={() => setPendingUserDeletion(null)}
          onConfirm={confirmUserDeletion}
          title={pendingUserDeletion?.bulk ? 'Delete selected accounts?' : 'Delete user account?'}
          description={pendingUserDeletion?.bulk
            ? `${pendingUserDeletion.users.length} selected user account${pendingUserDeletion.users.length === 1 ? '' : 's'} will be deleted. This action cannot be undone.`
            : pendingUserDeletion ? `${pendingUserDeletion.users[0]?.email} will lose access to SENTINEL. This action cannot be undone.` : ''}
          confirmLabel={pendingUserDeletion?.bulk ? 'Delete accounts' : 'Delete account'}
          confirmingLabel="Deleting..."
        />

        {editingUser && (
          <EditUserModal 
            user={editingUser}
            viewerRole={user.role}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveUser}
          />
        )}

        <GuardPasswordModal
          user={passwordResetUser}
          onClose={() => setPasswordResetUser(null)}
          onSuccess={fetchData}
        />

        {editingShift && (
          <EditScheduleModal
            shift={editingShift}
            onClose={() => setEditingShift(null)}
            onSave={fetchShifts}
            onDelete={fetchShifts}
          />
        )}

        {selectedApproval && (
          <div className="fixed inset-0 z-[95] flex">
            <button
              className="h-full flex-1 bg-black/45 backdrop-blur-[1px]"
              onClick={() => setSelectedApproval(null)}
              aria-label="Close approval details"
            />
            <aside className="soc-modal-surface soc-scroll-area h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-text-primary">Approval Details</h3>
              <p className="mt-1 text-sm text-text-secondary">Review applicant profile before approval.</p>

              <div className="mt-4 space-y-3 rounded border border-border-subtle bg-background p-4 text-sm">
                <p><span className="font-semibold">Name:</span> {selectedApproval.full_name || selectedApproval.username}</p>
                <p><span className="font-semibold">Email:</span> {selectedApproval.email}</p>
                <p><span className="font-semibold">Phone:</span> {selectedApproval.phone_number || '-'}</p>
                <p><span className="font-semibold">License:</span> {selectedApproval.license_number || '-'}</p>
                <p><span className="font-semibold">License Expiry:</span> {selectedApproval.license_expiry_date ? new Date(selectedApproval.license_expiry_date).toLocaleDateString() : '-'}</p>
                <p><span className="font-semibold">Submitted:</span> {new Date(selectedApproval.created_at).toLocaleString()}</p>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => handleApprovalAction(selectedApproval.id, 'approve')}
                  className="soc-btn soc-btn-success"
                >
                  Approve
                </button>
                <button
                  onClick={() => openRejectionDialog(selectedApproval)}
                  className="soc-btn soc-btn-danger"
                >
                  Reject
                </button>
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="soc-btn soc-btn-neutral"
                >
                  Close
                </button>
              </div>
            </aside>
          </div>
        )}

        <CreateGuardAccountModal
          isOpen={createGuardModalOpen}
          onClose={() => setCreateGuardModalOpen(false)}
          viewerRole={normalizedViewerRole}
          onCreated={() => fetchData()}
        />
      </OperationalShell>
    </>
  )
}

export default SuperadminDashboard
