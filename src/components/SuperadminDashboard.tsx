import { useState, useEffect, useMemo, FC } from 'react'
import EditUserModal from './EditUserModal'
import EditScheduleModal from './EditScheduleModal'
import AnalyticsDashboard from './AnalyticsDashboard'
import TripManagement from './TripManagement'
import NotificationCenter, { Notification, createNotification } from './NotificationCenter'
import { API_BASE_URL } from '../config'
import { User as AppUser } from '../App'
import { getSidebarNav } from '../config/navigation'
import { normalizeRole } from '../types/auth'
import CommandCenterDashboard from './dashboard/CommandCenterDashboard'
import AssignmentPicker from './dashboard/AssignmentPicker'
import LiveFreshnessPill from './dashboard/ui/LiveFreshnessPill'
import Allowed from './rbac/Allowed'
import DeniedFallback from './rbac/DeniedFallback'
import OperationalShell from './layout/OperationalShell'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { can } from '../utils/permissions'
import { getTrackingAccuracyMode, setTrackingAccuracyMode, TrackingAccuracyMode } from '../utils/trackingPolicy'
import AuditLogViewer from './AuditLogViewer'
import { logError } from '../utils/logger'

interface User {
  id: string
  email: string
  username: string
  role: string
  last_seen_at?: string
  full_name?: string
  phone_number?: string
  license_number?: string
  license_issued_date?: string
  license_expiry_date?: string
  address?: string
  [key: string]: any
}

const ONLINE_WINDOW_MS = 3 * 60 * 1000

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
    ? 'bg-purple-500/20 text-purple-300'
    : normalizedRole === 'supervisor'
      ? 'bg-amber-500/20 text-amber-300'
      : 'bg-teal-500/20 text-teal-300'

  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor}`} aria-hidden="true">
      {initial}
    </div>
  )
}

const RoleBadge: FC<{ roleRaw: string }> = ({ roleRaw }) => {
  const role = normalizeRole(roleRaw)
  const rolePill = role === 'superadmin' || role === 'admin'
    ? 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30'
    : role === 'supervisor'
      ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
      : 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30'

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
      dot: 'bg-emerald-400',
      glow: '0 0 6px rgba(52,211,153,0.7)',
      label: 'Active',
      pill: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
    },
    inactive: {
      dot: 'bg-zinc-400',
      glow: '0 0 6px rgba(161,161,170,0.7)',
      label: 'Inactive',
      pill: 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30',
    },
    pending: {
      dot: 'bg-amber-400',
      glow: '0 0 6px rgba(251,191,36,0.7)',
      label: 'Pending',
      pill: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
    },
    suspended: {
      dot: 'bg-red-400',
      glow: '0 0 6px rgba(248,113,113,0.7)',
      label: 'Suspended',
      pill: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
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
  created_at: string
}

interface SuperadminDashboardProps {
  user: AppUser
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const SuperadminDashboard: FC<SuperadminDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [stats, setStats] = useState<any>({})
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingShift, setEditingShift] = useState<any | null>(null)
  const [error, setError] = useState<string>('')
  const [activeSection, setActiveSection] = useState<'dashboard' | 'approvals' | 'schedule' | 'missions' | 'analytics' | 'trips' | 'audit-log'>('dashboard')
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false)
  const [missions, setMissions] = useState<any[]>([])
  const [missionsLoading, setMissionsLoading] = useState<boolean>(false)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalUser[]>([])
  const [selectedApproval, setSelectedApproval] = useState<PendingApprovalUser | null>(null)
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
  const [trackingAccuracyMode, setTrackingAccuracyModeState] = useState<TrackingAccuracyMode>(getTrackingAccuracyMode())
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'admin' | 'supervisor' | 'guard'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | UserDerivedStatus>('all')
  const [filterMenuOpen, setFilterMenuOpen] = useState<boolean>(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false)
  const [availableGuards, setAvailableGuards] = useState<User[]>([])
  const [availableFirearms, setAvailableFirearms] = useState<any[]>([])
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [selectedGuards, setSelectedGuards] = useState<string>('')
  const [selectedFirearms, setSelectedFirearms] = useState<string>('')
  const [selectedVehicles, setSelectedVehicles] = useState<string>('')
  const [showAddScheduleForm, setShowAddScheduleForm] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [lastUserSyncAt, setLastUserSyncAt] = useState<number>(() => Date.now())
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
  const navItems = getSidebarNav(user.role)

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
    activeSection === 'dashboard' ? 'Dashboard' :
    activeSection === 'approvals' ? 'Guard Approvals' :
    activeSection === 'schedule' ? 'Guard Schedules' :
    activeSection === 'missions' ? 'Mission Assignment' :
    activeSection === 'analytics' ? 'Analytics & Reports' :
    activeSection === 'trips' ? 'Trip Management' :
    activeSection === 'audit-log' ? 'System Audit Log' : 'Dashboard'
  const badgeLabel =
    activeSection === 'dashboard' ? 'Overview' :
    activeSection === 'approvals' ? 'Approvals' :
    activeSection === 'trips' ? 'Trips' :
    activeSection === 'audit-log' ? 'Audit Log' :
    activeSection.replace('-', ' ')

  const addNotification = (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => {
    const notification = createNotification(type, title, message)
    setNotifications(prev => [...prev, notification])
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  useEffect(() => {
    if (canManageUsers) {
      fetchData()
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
      fetchPendingApprovals()
      fetchShifts()
      fetchMissions()
    } else if (activeSection === 'approvals') {
      fetchPendingApprovals()
    } else if (activeSection === 'schedule') {
      fetchShifts()
    } else if (activeSection === 'missions') {
      fetchMissions()
    }
  }, [activeSection, canManageUsers])

  useEffect(() => {
    if (!activeView) return
    const viewToSection: Record<string, 'dashboard' | 'approvals' | 'schedule' | 'missions' | 'analytics' | 'trips' | 'audit-log'> = {
      users: 'dashboard',
      dashboard: 'dashboard',
      approvals: 'approvals',
      schedule: 'schedule',
      missions: 'missions',
      analytics: 'analytics',
      trips: 'trips',
      'audit-log': 'audit-log'
    }
    const nextSection = viewToSection[activeView]
    if (nextSection && nextSection !== activeSection) {
      setActiveSection(nextSection)
    }
  }, [activeView])

  const fetchData = async () => {
    try {
      setLoading(true)
      const data = await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/users`,
        { headers: getAuthHeaders() },
        'Failed to fetch users',
      )
      const users = Array.isArray(data) ? data : (data.users || data || [])
      setUsers(users)
      setLastUserSyncAt(Date.now())
      
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
      logError('Error fetching data:', err)
    } finally {
      setLoading(false)
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
      setLastUserSyncAt(Date.now())
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
      setLastUserSyncAt(Date.now())
      setError('')
    } catch (err) {
      setError('Error loading pending approvals: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setApprovalsLoading(false)
    }
  }

  const fetchGuardsAndFirearms = async () => {
    try {
      const sources: Promise<any>[] = []
      if (canManageUsers) {
        sources.push(
          fetchJsonOrThrow<any>(
            `${API_BASE_URL}/api/users`,
            { headers: getAuthHeaders() },
            'Failed to fetch users',
          ),
        )
      }
      sources.push(
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
      )

      const results = await Promise.all(sources)

      const usersData = canManageUsers ? results[0] : []
      const firearmsData = canManageUsers ? results[1] : results[0]
      const vehiclesData = canManageUsers ? results[2] : results[1]

      const allUsers = Array.isArray(usersData) ? usersData : (usersData?.users || [])
      const guards = allUsers.filter((u: User) => normalizeRole(u.role) === 'guard')
      setAvailableGuards(guards)

      const firearms = Array.isArray(firearmsData) ? firearmsData : (firearmsData?.firearms || [])
      setAvailableFirearms(firearms.filter((f: any) => f.status === 'available'))

      const vehicles = Array.isArray(vehiclesData)
        ? vehiclesData
        : (vehiclesData?.armored_cars || vehiclesData?.vehicles || [])
      setAvailableVehicles(vehicles.filter((v: any) => v.status === 'available'))
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
          vehicles_required: selectedVehicles ? 1 : 0
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
    if (view === 'approvals' || view === 'schedule' || view === 'dashboard' || view === 'missions' || view === 'analytics' || view === 'trips' || view === 'audit-log') {
      setActiveSection(view as 'dashboard' | 'approvals' | 'schedule' | 'missions' | 'analytics' | 'trips' | 'audit-log')
    } else if (onViewChange) {
      onViewChange(view)
    }
  }

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setShiftsLoading(true)
      setError('')
      
      // Combine date and times to create datetime strings
      const startDateTime = `${scheduleFormData.date}T${scheduleFormData.start_time}:00Z`
      const endDateTime = `${scheduleFormData.date}T${scheduleFormData.end_time}:00Z`
      
      const payload = {
        guard_id: scheduleFormData.guard_id,
        client_site: scheduleFormData.client_site,
        start_time: startDateTime,
        end_time: endDateTime,
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

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return
    }

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

  const filteredUsers = roleScopedUsers
    .filter((u) => {
      if (roleFilter === 'all') return true
      return normalizeRole(u.role) === roleFilter
    })
    .filter((u) => {
      if (statusFilter === 'all') return true
      return userStatusById.get(u.id) === statusFilter
    })
    .filter(u =>
    !searchQuery ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const roleA = normalizeRole(a.role)
      const roleB = normalizeRole(b.role)
      const roleDelta = rolePriority[roleA] - rolePriority[roleB]
      if (roleDelta !== 0) return roleDelta

      const nameA = (a.full_name || a.username || a.email || '').toLowerCase()
      const nameB = (b.full_name || b.username || b.email || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

  const totalVisibleUsers = filteredUsers.length
  const summaryStats = useMemo(() => {
    const active = roleScopedUsers.filter(u => getUserDerivedStatus(u, pendingApprovalIds) === 'active').length
    const pending = roleScopedUsers.filter(u => getUserDerivedStatus(u, pendingApprovalIds) === 'pending').length
    const supervisors = roleScopedUsers.filter(u => normalizeRole(u.role) === 'supervisor').length
    return {
      total: roleScopedUsers.length,
      active,
      pending,
      supervisors,
    }
  }, [roleScopedUsers, pendingApprovalIds])

  const selectableUserIds = filteredUsers
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

  const handleResetPasswordAction = (targetUser: User) => {
    addNotification(
      'warning',
      'Reset Password Unavailable',
      `No admin reset endpoint is configured for ${targetUser.email}. Use the standard forgot-password flow.`
    )
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

  const handleBulkDeleteSelected = async () => {
    const deletableUsers = filteredUsers.filter(u => selectedUserIds.includes(u.id) && canEditUserRow(u.role) && u.id !== user.id)
    if (deletableUsers.length === 0) {
      addNotification('info', 'No Deletable Users Selected', 'Select users you are allowed to remove.')
      return
    }

    if (!window.confirm(`Delete ${deletableUsers.length} selected user account(s)? This action cannot be undone.`)) {
      return
    }

    try {
      setBulkProcessing(true)
      await Promise.all(
        deletableUsers.map((targetUser) =>
          fetchJsonOrThrow<any>(`${API_BASE_URL}/api/user/${targetUser.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          }, `Failed to delete ${targetUser.email}`)
        )
      )
      addNotification('success', 'Bulk Delete Complete', `${deletableUsers.length} account(s) deleted.`)
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
      if (activeSection === 'dashboard' || activeSection === 'approvals') tasks.push(fetchPendingApprovals())
      if (activeSection === 'dashboard' || activeSection === 'schedule') tasks.push(fetchShifts())
      if (activeSection === 'dashboard' || activeSection === 'missions') tasks.push(fetchMissions())
      await Promise.all(tasks)
    } finally {
      window.setTimeout(() => setRefreshing(false), 500)
    }
  }

  const activeGuardsOnDuty = shifts.filter((shift: any) => shift.status === 'in_progress').length
  const guardsAbsentToday = shifts.filter((shift: any) => shift.status === 'no_show' || shift.status === 'absent').length
  const pendingGuardApprovals = pendingApprovals.length
  const activeMissions = missions.filter((mission: any) => mission.status === 'in_progress' || mission.status === 'active').length
  const scheduledShifts = shifts.filter((shift: any) => shift.status === 'scheduled').length
  const operationsAlerts = guardsAbsentToday + pendingGuardApprovals

  const handleApprovalAction = async (targetUserId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingApprovalId(targetUserId)
      await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/users/${targetUserId}/approval`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action }),
      }, `Failed to ${action} account`)

      addNotification(
        'success',
        action === 'approve' ? 'Guard Approved' : 'Guard Rejected',
        action === 'approve' ? 'Guard account approved successfully' : 'Guard account rejected successfully'
      )
      await fetchPendingApprovals()
      await fetchData()
      setError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${action} account`
      setError(message)
      addNotification('error', 'Approval Action Failed', message)
    } finally {
      setProcessingApprovalId(null)
    }
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
        onLogoClick={() => {
          setActiveSection('dashboard')
          onViewChange?.('dashboard')
        }}
        rightSlot={
          <button
            onClick={handleRefresh}
            className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover md:inline-flex"
          >
            <svg className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 12a9 9 0 10-3.2 6.9" />
              <path d="M21 3v6h-6" />
            </svg>
            Refresh
          </button>
        }
        error={error}
      >

        {activeSection === 'dashboard' && loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading system data...</div>
          </div>
        ) : activeSection === 'dashboard' ? (
          <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-8 w-full animate-fade-in gap-4 md:gap-6">
            <CommandCenterDashboard
              quickActions={[
                { label: 'Assign Shift', tone: 'indigo', onClick: () => handleNavigate('schedule') },
                { label: 'Approve Guard', tone: 'emerald', onClick: () => handleNavigate('approvals') },
                { label: 'Allocate Firearm', tone: 'blue', onClick: () => onViewChange?.('allocation') },
                { label: 'Assign Vehicle', tone: 'amber', onClick: () => onViewChange?.('armored-cars') },
                { label: 'Start Trip', tone: 'indigo', onClick: () => handleNavigate('trips') },
                { label: 'End Trip', tone: 'amber', onClick: () => handleNavigate('trips') },
                { label: 'Create Mission', tone: 'blue', onClick: () => handleNavigate('missions') },
              ]}
            />

            <section className="flex flex-col flex-1 min-h-0 w-full bento-card !p-0 overflow-hidden table-glass">
              {/* Table header — static, never scrolls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border-subtle flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">User Management</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">Manage system users, permissions, and security roles</p>
                </div>
                <div className="flex items-center gap-2">
                  <LiveFreshnessPill updatedAt={lastUserSyncAt} label="Roster sync" />
                  <label className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background px-2 py-2 text-xs font-semibold text-text-secondary" htmlFor="tracking-accuracy-mode">
                    Accuracy
                    <select
                      id="tracking-accuracy-mode"
                      value={trackingAccuracyMode}
                      onChange={(e) => {
                        const mode = e.target.value as TrackingAccuracyMode
                        setTrackingAccuracyModeState(mode)
                        setTrackingAccuracyMode(mode)
                        addNotification('info', 'Tracking Accuracy Updated', `Mode set to ${mode}. Refresh active sessions for full effect.`)
                      }}
                      className="rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs font-semibold text-text-primary"
                    >
                      <option value="strict">Strict</option>
                      <option value="balanced">Balanced</option>
                    </select>
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm bg-background border border-border-subtle rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-indigo-500 w-44"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterMenuOpen((prev) => !prev)}
                    aria-expanded={filterMenuOpen}
                    aria-controls="user-role-filter-menu"
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-background border border-border-subtle rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    Filter: {roleFilter === 'all' ? 'All Roles' : roleFilter}
                  </button>
                  <label htmlFor="user-status-filter" className="sr-only">Filter by user status</label>
                  <select
                    id="user-status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | UserDerivedStatus)}
                    className="rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-b border-border-subtle px-5 py-4 md:grid-cols-4">
                <div className="rounded-xl border border-border-subtle bg-background px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Total Users</div>
                  <div className="mt-1 text-xl font-bold text-text-primary">{summaryStats.total}</div>
                </div>
                <div className="rounded-xl border border-border-subtle bg-background px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Active</div>
                  <div className="mt-1 text-xl font-bold text-emerald-300">{summaryStats.active}</div>
                </div>
                <div className="rounded-xl border border-border-subtle bg-background px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Pending</div>
                  <div className="mt-1 text-xl font-bold text-amber-300">{summaryStats.pending}</div>
                </div>
                <div className="rounded-xl border border-border-subtle bg-background px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Supervisors</div>
                  <div className="mt-1 text-xl font-bold text-indigo-300">{summaryStats.supervisors}</div>
                </div>
              </div>
              {filterMenuOpen ? (
                <div id="user-role-filter-menu" className="px-5 py-3 border-b border-border-subtle">
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="User role filters">
                    {([
                      { key: 'all', label: 'All Roles' },
                      { key: 'superadmin', label: 'Superadmins' },
                      { key: 'admin', label: 'Admins' },
                      { key: 'supervisor', label: 'Supervisors' },
                      { key: 'guard', label: 'Guards' },
                    ] as const).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setRoleFilter(item.key)
                          setFilterMenuOpen(false)
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          roleFilter === item.key
                            ? 'bg-info-bg text-info-text ring-1 ring-info-border'
                            : 'bg-background text-text-secondary ring-1 ring-border-subtle'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedUserIds.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-background px-5 py-3">
                  <p className="text-sm font-medium text-text-secondary">
                    {selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'} selected
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBulkApproveSelected}
                      disabled={bulkProcessing}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                    >
                      Approve Selected
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkSuspendSelected}
                      disabled={bulkProcessing}
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 disabled:opacity-60"
                    >
                      Suspend Selected
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkDeleteSelected}
                      disabled={bulkProcessing}
                      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-60"
                    >
                      Delete Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      disabled={bulkProcessing}
                      className="rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold text-text-secondary disabled:opacity-60"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
              {filteredUsers.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="hidden w-full min-w-[980px] md:table">
                    <thead className="thead-glass">
                      <tr className="border-b border-border">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">
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
                        <th className="sticky top-0 z-10 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary bg-surface">User Details</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Username</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Role</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Status</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Last Login</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-tertiary">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {filteredUsers.map((u: User) => {
                        const derivedStatus = userStatusById.get(u.id) || 'inactive'
                        const rowSelected = selectedUserIds.includes(u.id)
                        const canEdit = canEditUserRow(u.role)
                        const canDelete = canEditUserRow(u.role) && u.id !== user.id
                        const pendingApproval = pendingApprovalIds.has(u.id)
                        return (
                          <tr key={u.id} className="transition-colors hover:bg-surface-hover/50">
                            <td className="px-5 py-3.5 align-top">
                              <input
                                type="checkbox"
                                checked={rowSelected}
                                onChange={() => toggleUserSelection(u.id)}
                                className="h-4 w-4 rounded border-border-subtle bg-background"
                                aria-label={`Select ${u.full_name || u.username || u.email}`}
                              />
                            </td>
                            <td className="px-5 py-3.5">
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
                            <td className="px-5 py-3.5 text-sm text-text-secondary" title={u.username}>{truncateText(u.username, 22)}</td>
                            <td className="px-5 py-3.5">
                              <RoleBadge roleRaw={u.role} />
                            </td>
                            <td className="px-5 py-3.5">
                              <StatusIndicator status={derivedStatus} />
                            </td>
                            <td className="px-5 py-3.5 text-xs text-text-secondary">
                              <div className="flex flex-col gap-0.5">
                                <span>{getRelativeLastLogin(u.last_seen_at)}</span>
                                <span className="text-[11px] text-text-tertiary">Signal {getPreciseLastSeen(u.last_seen_at)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1">
                                {pendingApproval && (
                                  <button
                                    onClick={() => handleApproveIfPending(u)}
                                    title="Approve pending user"
                                    aria-label={`Approve ${u.full_name || u.username || u.email}`}
                                    className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-emerald-500/10 hover:text-emerald-300"
                                  >
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => handleEditUser(u)}
                                    title="Edit user"
                                    aria-label={`Edit ${u.full_name || u.username || u.email}`}
                                    className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-indigo-500/10 hover:text-indigo-400"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleResetPasswordAction(u)}
                                  title="Reset password"
                                  aria-label={`Reset password for ${u.full_name || u.username || u.email}`}
                                  className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-sky-500/10 hover:text-sky-300"
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7m0 0l-3 3m3-3l3 3M5 12a7 7 0 1114 0v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleSuspendAction(u)}
                                  title="Suspend user"
                                  aria-label={`Suspend ${u.full_name || u.username || u.email}`}
                                  className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-amber-500/10 hover:text-amber-300"
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
                                      onClick={() => handleDeleteUser(u.id, u.email)}
                                      title="Delete user"
                                      aria-label={`Delete ${u.full_name || u.username || u.email}`}
                                      className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-400"
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
                    {filteredUsers.map((u: User) => {
                      const derivedStatus = userStatusById.get(u.id) || 'inactive'
                      const rowSelected = selectedUserIds.includes(u.id)
                      const pendingApproval = pendingApprovalIds.has(u.id)
                      const canDelete = canEditUserRow(u.role) && u.id !== user.id

                      return (
                        <article key={`mobile-${u.id}`} className="rounded-xl border border-border-subtle bg-background p-4">
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
                                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300"
                              >
                                Approve
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleEditUser(u)}
                              className="rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-300"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetPasswordAction(u)}
                              className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-300"
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSuspendAction(u)}
                              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300"
                            >
                              Suspend
                            </button>
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300"
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
                <p className="text-center text-text-secondary py-12 italic text-sm">No users found</p>
              )}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
                <p className="text-xs text-text-tertiary">Showing {totalVisibleUsers} of {users.length} users</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-background border border-border-subtle rounded-lg hover:bg-surface-hover transition-colors">Previous</button>
                  <button className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-background border border-border-subtle rounded-lg hover:bg-surface-hover transition-colors">Next</button>
                </div>
              </div>
            </section>
          </div>
        ) : activeSection === 'approvals' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {approvalsLoading ? (
              <div className="text-center py-12 text-text-secondary font-medium">Loading pending approvals...</div>
            ) : (
              <section className="w-full table-glass rounded-2xl p-6 md:p-8">
                <h2 className="text-2xl font-bold text-text-primary mb-6">Pending Guard Registrations</h2>
                <div className="overflow-auto">
                  <table className="w-full border-collapse min-w-[820px]">
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
                          <td className="px-4 py-10 text-center text-text-secondary" colSpan={5}>No pending guard approvals.</td>
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
                                  onClick={() => handleApprovalAction(pendingUser.id, 'reject')}
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
              <div className="text-center py-12 text-text-secondary font-medium">Loading schedules...</div>
            ) : (
              <>
                <section className="flex flex-col flex-1 min-h-0 w-full rounded-2xl overflow-hidden table-glass mb-4">
                  <div className="flex-shrink-0 px-6 py-5 border-b border-border-subtle flex justify-between items-center">
                    <h2 className="text-xl font-bold text-text-primary">All Guard Schedules</h2>
                    <button
                      onClick={() => setShowAddScheduleForm(!showAddScheduleForm)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
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
                                shift.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' :
                                shift.status === 'scheduled' ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30' :
                                shift.status === 'in_progress' ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30' :
                                'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
                              }`}>
                                {shift.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
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
                  <p className="text-center text-text-secondary py-8 italic text-sm md:text-base">No schedules found</p>
                )}
              </section>

              {showAddScheduleForm && (
                <section className="w-full table-glass rounded-2xl p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-text-primary">Add New Schedule</h2>
                    <button
                      onClick={() => setShowAddScheduleForm(false)}
                      className="text-text-tertiary hover:text-text-primary transition-colors"
                      title="Close form"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  
                  <form onSubmit={handleScheduleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <AssignmentPicker
                        id="schedule-guard"
                        label="Select Guard"
                        required
                        tone="teal"
                        value={scheduleFormData.guard_id}
                        onChange={(value) => setScheduleFormData({ ...scheduleFormData, guard_id: value })}
                        placeholder="-- Select a guard --"
                        options={availableGuards.map((guard) => ({ value: guard.id, label: guard.full_name || guard.username }))}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-text-primary mb-1">Site/Location</label>
                      <input
                        type="text"
                        required
                        value={scheduleFormData.client_site}
                        onChange={(e) => setScheduleFormData({...scheduleFormData, client_site: e.target.value})}
                        placeholder="Enter site or location"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Date</label>
                      <input
                        type="date"
                        required
                        value={scheduleFormData.date}
                        onChange={(e) => setScheduleFormData({...scheduleFormData, date: e.target.value})}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={scheduleFormData.start_time}
                        onChange={(e) => setScheduleFormData({...scheduleFormData, start_time: e.target.value})}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">End Time</label>
                      <input
                        type="time"
                        required
                        value={scheduleFormData.end_time}
                        onChange={(e) => setScheduleFormData({...scheduleFormData, end_time: e.target.value})}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={shiftsLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
                      >
                        {shiftsLoading ? 'Creating Schedule...' : 'Create Schedule'}
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </>
            )}
          </div>
        ) : activeSection === 'missions' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {/* Mission Assignment Form */}
            <section className="w-full table-glass rounded-2xl p-6 md:p-8 mb-6">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Assign New Mission</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {missionResponse && (
                <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-lg">
                  <h3 className="font-bold text-green-900 mb-2">Mission Assigned Successfully!</h3>
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
                    className="mt-2 text-sm text-green-800 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <form onSubmit={handleMissionSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Mission Name</label>
                  <input
                    type="text"
                    required
                    value={missionFormData.mission_name}
                    onChange={(e) => setMissionFormData({...missionFormData, mission_name: e.target.value})}
                    placeholder="Enter mission name"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Destination</label>
                  <input
                    type="text"
                    required
                    value={missionFormData.destination}
                    onChange={(e) => setMissionFormData({...missionFormData, destination: e.target.value})}
                    placeholder="Enter destination"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
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
                  options={availableFirearms.map((firearm) => ({ value: firearm.id, label: `${firearm.serial_number} - ${firearm.model} (${firearm.caliber})` }))}
                />

                <AssignmentPicker
                  id="mission-vehicle"
                  label="Select Vehicle"
                  required
                  tone="amber"
                  value={selectedVehicles}
                  onChange={setSelectedVehicles}
                  placeholder="-- Select a vehicle --"
                  options={availableVehicles.map((vehicle) => ({ value: vehicle.id, label: `${vehicle.model} - ${vehicle.license_plate} (Capacity: ${vehicle.capacity_kg}kg)` }))}
                />

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={missionFormData.date}
                    onChange={(e) => setMissionFormData({...missionFormData, date: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={missionFormData.start_time}
                    onChange={(e) => setMissionFormData({...missionFormData, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={missionFormData.end_time}
                    onChange={(e) => setMissionFormData({...missionFormData, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Priority</label>
                  <select
                    value={missionFormData.priority}
                    onChange={(e) => setMissionFormData({...missionFormData, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-text-primary mb-1">Special Requirements (Optional)</label>
                  <textarea
                    value={missionFormData.special_requirements}
                    onChange={(e) => setMissionFormData({...missionFormData, special_requirements: e.target.value})}
                    placeholder="Enter any special requirements"
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={missionsLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    {missionsLoading ? 'Assigning Mission...' : 'Assign Mission'}
                  </button>
                </div>
              </form>
            </section>

            {/* Mission History */}
            <section className="w-full table-glass rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Mission History</h2>
              {missionsLoading ? (
                <div className="text-center py-12 text-text-secondary font-medium">Loading missions...</div>
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
                              mission.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' :
                              mission.status === 'scheduled' ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30' :
                              mission.status === 'in_progress' ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30' :
                              'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
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
                <p className="text-center text-text-secondary py-8 italic text-sm md:text-base">No missions found</p>
              )}
            </section>
          </div>
        ) : activeSection === 'analytics' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <AnalyticsDashboard />
          </div>
        ) : activeSection === 'trips' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <TripManagement />
          </div>
        ) : activeSection === 'audit-log' ? (
          <AuditLogViewer />
        ) : null}

        {editingUser && (
          <EditUserModal 
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveUser}
          />
        )}

        {editingShift && (
          <EditScheduleModal
            shift={editingShift}
            onClose={() => setEditingShift(null)}
            onSave={fetchShifts}
            onDelete={fetchShifts}
          />
        )}

        {selectedApproval && (
          <div className="fixed inset-0 z-50 flex">
            <button
              className="h-full flex-1 bg-black/40"
              onClick={() => setSelectedApproval(null)}
              aria-label="Close approval details"
            />
            <aside className="h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-text-primary">Approval Details</h3>
              <p className="mt-1 text-sm text-text-secondary">Review applicant profile before approval.</p>

              <div className="mt-4 space-y-3 rounded-lg border border-border-subtle bg-background p-4 text-sm">
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
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleApprovalAction(selectedApproval.id, 'reject')}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Reject
                </button>
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-hover"
                >
                  Close
                </button>
              </div>
            </aside>
          </div>
        )}
      </OperationalShell>
    </>
  )
}

export default SuperadminDashboard


