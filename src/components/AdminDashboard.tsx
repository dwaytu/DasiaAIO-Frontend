import { useState, useEffect, useMemo, FC } from 'react'
import EditUserModal from './EditUserModal'
import EditScheduleModal from './EditScheduleModal'
import BugReportButton from './BugReportButton'
import { API_BASE_URL } from '../config'
import type { User as AppUser } from '../context/AuthContext'
import { getSidebarNav } from '../config/navigation'
import OperationalShell from './layout/OperationalShell'
import Allowed from './rbac/Allowed'
import DeniedFallback from './rbac/DeniedFallback'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import CommandCenterDashboard from './dashboard/CommandCenterDashboard'
import LiveFreshnessPill from './dashboard/ui/LiveFreshnessPill'
import { TableLoadingState } from './dashboard/ui/DashboardLoadingState'
import { normalizeRole } from '../types/auth'

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

const truncateText = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}...`
}

type UserDerivedStatus = 'active' | 'inactive' | 'pending' | 'suspended'

const ONLINE_WINDOW_MS = 3 * 60 * 1000

const isUserOnline = (lastSeenAt?: string) => {
  if (!lastSeenAt) return false
  const lastSeen = new Date(lastSeenAt).getTime()
  if (Number.isNaN(lastSeen)) return false
  return Date.now() - lastSeen <= ONLINE_WINDOW_MS
}

const getRelativeLastLogin = (lastSeenAt?: string) => {
  if (!lastSeenAt) return 'Never'
  const ts = new Date(lastSeenAt).getTime()
  if (Number.isNaN(ts)) return 'Unknown'
  const diffMs = Date.now() - ts
  if (diffMs < 60 * 1000) return 'Just now'
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))} minutes ago`
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))} hours ago`
  if (diffMs < 48 * 60 * 60 * 1000) return 'Yesterday'
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))} days ago`
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
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor}`} aria-hidden="true">
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
      dot: 'bg-[color:var(--color-success)]',
      glow: '0 0 6px rgba(52,211,153,0.7)',
      label: 'Active',
      pill: 'bg-success-bg text-success-text ring-1 ring-success-border',
    },
    inactive: {
      dot: 'bg-zinc-400',
      glow: '0 0 6px rgba(161,161,170,0.7)',
      label: 'Inactive',
      pill: 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30',
    },
    pending: {
      dot: 'bg-[color:var(--color-warning)]',
      glow: '0 0 6px rgba(251,191,36,0.7)',
      label: 'Pending',
      pill: 'bg-warning-bg text-warning-text ring-1 ring-warning-border',
    },
    suspended: {
      dot: 'bg-[color:var(--color-danger)]',
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
  created_at: string
}

interface AdminDashboardProps {
  user: AppUser
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const AdminDashboard: FC<AdminDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingShift, setEditingShift] = useState<any | null>(null)
  const [activeSection, setActiveSection] = useState<'users' | 'approvals' | 'schedule'>('users')
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalUser[]>([])
  const [selectedApproval, setSelectedApproval] = useState<PendingApprovalUser | null>(null)
  const [approvalsLoading, setApprovalsLoading] = useState<boolean>(false)
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'admin' | 'supervisor' | 'guard'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | UserDerivedStatus>('all')
  const [filterMenuOpen, setFilterMenuOpen] = useState<boolean>(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false)
  const [lastUserSyncAt, setLastUserSyncAt] = useState<number>(() => Date.now())
  const currentView = activeView || activeSection
  const navItems = getSidebarNav(user.role, { homeView: 'users' })
  const normalizedViewerRole = normalizeRole(user.role)
  const isAdminViewer = normalizedViewerRole === 'admin'
  const isSupervisorViewer = normalizedViewerRole === 'supervisor'

  const canViewUserRow = (targetRoleRaw: string) => {
    const targetRole = normalizeRole(targetRoleRaw)
    if (isAdminViewer) return targetRole !== 'superadmin'
    if (isSupervisorViewer) return targetRole === 'guard'
    return false
  }

  const canEditUserRow = (targetRoleRaw: string) => {
    const targetRole = normalizeRole(targetRoleRaw)
    if (isAdminViewer) return targetRole !== 'superadmin'
    if (isSupervisorViewer) return targetRole === 'guard'
    return false
  }

  useEffect(() => {
    if (activeSection === 'users') {
      fetchUsers()
      fetchPendingApprovals()
    } else if (activeSection === 'approvals') {
      fetchPendingApprovals()
    } else if (activeSection === 'schedule') {
      fetchShifts()
    }
  }, [activeSection])

  useEffect(() => {
    if (activeView === 'users' || activeView === 'approvals' || activeView === 'schedule') {
      setActiveSection(activeView)
    }
  }, [activeView])

  const fetchUsers = async () => {
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
      setError('')
    } catch (err) {
      setError('Error loading users: ' + (err instanceof Error ? err.message : String(err)))
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

  const fetchPendingApprovals = async () => {
    try {
      setApprovalsLoading(true)
      const data = await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/users/pending-approvals`,
        { headers: getAuthHeaders() },
        'Failed to fetch pending approvals',
      )
      const approvalList = Array.isArray(data) ? data : (data.users || data || [])
      setPendingApprovals(approvalList)
      setLastUserSyncAt(Date.now())
      setError('')
    } catch (err) {
      setError('Error loading pending approvals: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setApprovalsLoading(false)
    }
  }

  const handleLogout = () => {
    onLogout()
  }

  const handleNavigate = (view: string) => {
    if (view === 'users' || view === 'approvals' || view === 'schedule') {
      setActiveSection(view as 'users' | 'approvals' | 'schedule')
      onViewChange?.(view)
      return
    }
    onViewChange?.(view)
  }

  const handleApprovalAction = async (targetUserId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingApprovalId(targetUserId)
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/users/${targetUserId}/approval`,
        {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ action }),
        },
        `Failed to ${action} account`,
      )

      await fetchPendingApprovals()
      await fetchUsers()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} account`)
    } finally {
      setProcessingApprovalId(null)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
  }

  const handleSaveUser = async (updatedData: Partial<User>) => {
    if (!editingUser) return

    try {
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/user/${editingUser.id}`,
        {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updatedData),
        },
        'Failed to update user',
      )

      // Refresh user list
      await fetchUsers()
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
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/user/${userId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
        'Failed to delete user',
      )

      // Refresh user list
      await fetchUsers()
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
    .filter((u) => {
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
    setError(`Reset password endpoint is not configured for ${targetUser.email}. Use forgot-password flow.`)
  }

  const handleSuspendAction = (targetUser: User) => {
    setError(`Suspend endpoint is not configured yet for ${targetUser.email}.`)
  }

  const handleApproveIfPending = async (targetUser: User) => {
    if (!pendingApprovalIds.has(targetUser.id)) return
    await handleApprovalAction(targetUser.id, 'approve')
  }

  const handleBulkApproveSelected = async () => {
    const pendingSelected = selectedUserIds.filter(id => pendingApprovalIds.has(id))
    if (pendingSelected.length === 0) {
      setError('No pending accounts selected to approve.')
      return
    }

    try {
      setBulkProcessing(true)
      await Promise.all(pendingSelected.map((id) => handleApprovalAction(id, 'approve')))
      setSelectedUserIds((prev) => prev.filter(id => !pendingSelected.includes(id)))
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkDeleteSelected = async () => {
    const deletableUsers = filteredUsers.filter(u => selectedUserIds.includes(u.id) && canEditUserRow(u.role) && u.id !== user.id)
    if (deletableUsers.length === 0) {
      setError('No deletable users selected.')
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
      await fetchUsers()
      setSelectedUserIds([])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkSuspendSelected = () => {
    setError('Bulk suspend endpoint is not configured yet.')
  }

  return (
    <OperationalShell
      user={user}
      title={
        activeSection === 'users'
          ? 'User Management'
          : activeSection === 'approvals'
            ? 'Guard Approvals'
            : 'Guard Schedules'
      }
      badgeLabel={
        activeSection === 'users'
          ? 'Users'
          : activeSection === 'approvals'
            ? 'Approvals'
            : 'Schedule'
      }
      navItems={navItems}
      activeView={currentView}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => {
        setActiveSection('users')
        onViewChange?.('users')
      }}
      error={error}
    >
      <div className="animate-fade-in space-y-4">

          {/* Users Section */}
          {activeSection === 'users' && (
            <>
              <CommandCenterDashboard
                quickActions={[
                  { label: 'Assign Shift', tone: 'indigo', onClick: () => handleNavigate('schedule') },
                  { label: 'Approve Guard', tone: 'emerald', onClick: () => handleNavigate('approvals') },
                  { label: 'Allocate Firearm', tone: 'blue', onClick: () => onViewChange?.('allocation') },
                  { label: 'Assign Vehicle', tone: 'amber', onClick: () => onViewChange?.('armored-cars') },
                  { label: 'Start Trip', tone: 'indigo', onClick: () => onViewChange?.('trips') },
                  { label: 'End Trip', tone: 'amber', onClick: () => onViewChange?.('trips') },
                  { label: 'Create Mission', tone: 'blue', onClick: () => onViewChange?.('missions') },
                ]}
              />

              {loading && (
                <TableLoadingState
                  title="User Management"
                  subtitle="Hydrating roster, role, and approval data."
                  rows={6}
                  columns={7}
                />
              )}

              {!loading && (
                <section className="flex flex-col min-h-0 w-full bento-card !p-0 overflow-hidden table-glass">
                  <div className="flex flex-col gap-3 border-b border-border-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-text-primary">User Management</h2>
                      <p className="mt-0.5 text-xs text-text-tertiary">Manage system users, approvals, and roles</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <LiveFreshnessPill updatedAt={lastUserSyncAt} label="Roster sync" />
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-44 rounded border border-border-subtle bg-background py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setFilterMenuOpen((prev) => !prev)}
                        aria-expanded={filterMenuOpen}
                        aria-controls="admin-user-role-filter-menu"
                        className="flex items-center gap-1.5 rounded border border-border-subtle bg-background px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        Filter: {roleFilter === 'all' ? 'All Roles' : roleFilter}
                      </button>
                      <label htmlFor="admin-user-status-filter" className="sr-only">Filter by user status</label>
                      <select
                        id="admin-user-status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'all' | UserDerivedStatus)}
                        className="rounded border border-border-subtle bg-background px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
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
                    <div className="rounded border border-border-subtle bg-background px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Total Users</div>
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
                      <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Supervisors</div>
                      <div className="mt-1 text-xl font-bold text-info-text">{summaryStats.supervisors}</div>
                    </div>
                  </div>

                  {filterMenuOpen ? (
                    <div id="admin-user-role-filter-menu" className="border-b border-border-subtle px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="User role filters">
                        {([
                          { key: 'all', label: 'All Roles' },
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
                          className="rounded border border-success-border bg-success-bg px-3 py-1.5 text-xs font-semibold text-success-text disabled:opacity-60"
                        >
                          Approve Selected
                        </button>
                        <button
                          type="button"
                          onClick={handleBulkSuspendSelected}
                          disabled={bulkProcessing}
                          className="rounded border border-warning-border bg-warning-bg px-3 py-1.5 text-xs font-semibold text-warning-text disabled:opacity-60"
                        >
                          Suspend Selected
                        </button>
                        <button
                          type="button"
                          onClick={handleBulkDeleteSelected}
                          disabled={bulkProcessing}
                          className="rounded border border-danger-border bg-danger-bg px-3 py-1.5 text-xs font-semibold text-danger-text disabled:opacity-60"
                        >
                          Delete Selected
                        </button>
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
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">User Details</th>
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
                            const canDelete = canEditUserRow(u.role) && u.id !== user.id
                            const canEdit = canEditUserRow(u.role)
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
                                      <div className="truncate text-sm font-medium text-text-primary" title={u.full_name || u.username}>
                                        {truncateText(u.full_name || u.username, 26)}
                                      </div>
                                      <div className="truncate text-xs text-text-tertiary" title={u.email}>{truncateText(u.email, 30)}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-text-secondary" title={u.username}>{truncateText(u.username, 22)}</td>
                                <td className="px-5 py-3.5"><RoleBadge roleRaw={u.role} /></td>
                                <td className="px-5 py-3.5"><StatusIndicator status={derivedStatus} /></td>
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
                                        type="button"
                                        onClick={() => handleApproveIfPending(u)}
                                        title="Approve pending user"
                                        aria-label={`Approve ${u.full_name || u.username || u.email}`}
                                        className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-success-bg hover:text-success-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
                                      >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                      </button>
                                    )}
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => handleEditUser(u)}
                                        title="Edit user"
                                        aria-label={`Edit ${u.full_name || u.username || u.email}`}
                                        className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-info-bg hover:text-info-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
                                      >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleResetPasswordAction(u)}
                                      title="Reset password"
                                      aria-label={`Reset password for ${u.full_name || u.username || u.email}`}
                                      className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-info-bg hover:text-info-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
                                    >
                                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7m0 0l-3 3m3-3l3 3M5 12a7 7 0 1114 0v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5z" /></svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSuspendAction(u)}
                                      title="Suspend user"
                                      aria-label={`Suspend ${u.full_name || u.username || u.email}`}
                                      className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-warning-bg hover:text-warning-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
                                    >
                                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-12.728 12.728M8 7h8a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2z" /></svg>
                                    </button>
                                    <Allowed
                                      role={user.role}
                                      permission="manage_users"
                                      fallback={<DeniedFallback title="Delete disabled" reason="Your role cannot delete user accounts." />}
                                    >
                                      {canDelete && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteUser(u.id, u.email)}
                                          title="Delete user"
                                          aria-label={`Delete ${u.full_name || u.username || u.email}`}
                                          className="min-h-11 min-w-11 rounded p-2 text-text-tertiary transition-colors hover:bg-danger-bg hover:text-danger-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
                                        >
                                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                            <article key={`admin-mobile-${u.id}`} className="rounded border border-border-subtle bg-background p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={rowSelected}
                                    onChange={() => toggleUserSelection(u.id)}
                                    className="h-4 w-4 rounded border-border-subtle bg-background"
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
                                  <button type="button" onClick={() => handleApproveIfPending(u)} className="min-h-11 rounded-md border border-success-border bg-success-bg px-2.5 py-1.5 text-xs font-semibold text-success-text">Approve</button>
                                ) : null}
                                <button type="button" onClick={() => handleEditUser(u)} className="min-h-11 rounded-md border border-info-border bg-info-bg px-2.5 py-1.5 text-xs font-semibold text-info-text">Edit</button>
                                <button type="button" onClick={() => handleResetPasswordAction(u)} className="min-h-11 rounded-md border border-info-border bg-info-bg px-2.5 py-1.5 text-xs font-semibold text-info-text">Reset</button>
                                <button type="button" onClick={() => handleSuspendAction(u)} className="min-h-11 rounded-md border border-warning-border bg-warning-bg px-2.5 py-1.5 text-xs font-semibold text-warning-text">Suspend</button>
                                {canDelete ? (
                                  <button type="button" onClick={() => handleDeleteUser(u.id, u.email)} className="min-h-11 rounded-md border border-danger-border bg-danger-bg px-2.5 py-1.5 text-xs font-semibold text-danger-text">Delete</button>
                                ) : null}
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-sm text-text-secondary">No users match the current filters.</p>
                      <p className="mt-1 text-xs text-text-tertiary">Try adjusting your search or filter criteria.</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3">
                    <p className="text-xs text-text-tertiary">Showing {filteredUsers.length} of {users.length} users</p>
                    <div className="flex gap-2">
                      <button type="button" className="min-h-11 rounded border border-border-subtle bg-background px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover">Previous</button>
                      <button type="button" className="min-h-11 rounded border border-border-subtle bg-background px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover">Next</button>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* Approvals Section */}
          {activeSection === 'approvals' && (
            <>
              {approvalsLoading && (
                <TableLoadingState
                  title="Pending Guard Registrations"
                  subtitle="Loading approval queue and verification state."
                  rows={4}
                  columns={5}
                />
              )}

              {!approvalsLoading && (
                <div className="bg-surface rounded shadow-md p-6">
                  <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Pending Guard Registrations</h2>
                  <div className="overflow-x-auto">
                    <table className="hidden w-full min-w-[800px] md:table">
                      <thead className="thead-glass">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Guard Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Requested Role</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Submitted Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingApprovals.length === 0 ? (
                          <tr>
                            <td className="px-4 py-10 text-center" colSpan={5}>
                              <p className="text-sm text-text-secondary">No pending approvals — all guard registrations have been processed.</p>
                            </td>
                          </tr>
                        ) : (
                          pendingApprovals.map((pendingUser) => (
                            <tr key={pendingUser.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                              <td className="px-4 py-3 text-text-primary">
                                <div className="font-medium">{pendingUser.full_name || pendingUser.username}</div>
                                <div className="text-xs text-text-tertiary">{pendingUser.email}</div>
                              </td>
                              <td className="px-4 py-3 text-text-primary uppercase">{pendingUser.role}</td>
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

                    <div className="space-y-3 md:hidden" data-mobile-stack="cards">
                      {pendingApprovals.length === 0 ? (
                        <div className="rounded border border-border-subtle bg-background p-4 text-center">
                          <p className="text-sm text-text-secondary">No pending approvals — all guard registrations have been processed.</p>
                        </div>
                      ) : (
                        pendingApprovals.map((pendingUser) => (
                          <article key={`pending-mobile-${pendingUser.id}`} className="rounded border border-border-subtle bg-background p-4">
                            <h3 className="text-sm font-semibold text-text-primary">{pendingUser.full_name || pendingUser.username}</h3>
                            <p className="mt-0.5 text-xs text-text-tertiary">{pendingUser.email}</p>
                            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-text-secondary">
                              <div>
                                <dt className="text-text-tertiary">Requested Role</dt>
                                <dd className="font-medium uppercase text-text-primary">{pendingUser.role}</dd>
                              </div>
                              <div>
                                <dt className="text-text-tertiary">Submitted Date</dt>
                                <dd className="font-medium text-text-primary">{new Date(pendingUser.created_at).toLocaleString()}</dd>
                              </div>
                            </dl>
                            <div className="mt-3 flex flex-wrap gap-2">
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
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Schedule Section */}
          {activeSection === 'schedule' && (
            <>
              {shiftsLoading && (
                <TableLoadingState
                  title="All Guard Schedules"
                  subtitle="Loading current deployment roster."
                  rows={5}
                  columns={7}
                />
              )}

              {!shiftsLoading && (
                <div className="bg-surface rounded shadow-md p-6">
                  <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">All Guard Schedules</h2>
                  {shifts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="hidden w-full min-w-[600px] md:table">
                        <thead className="bg-surface-hover border-b border-border">
                          <tr>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Guard</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Site</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Date</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Start Time</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">End Time</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Status</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shifts.map((shift: any) => (
                            <tr key={shift.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                              <td className="px-6 py-3 text-text-primary">
                                <div className="font-medium">{shift.guard_name || shift.guard_username}</div>
                                <div className="text-xs text-text-tertiary">{shift.guard_username}</div>
                              </td>
                              <td className="px-6 py-3 text-text-primary">{shift.client_site}</td>
                              <td className="px-6 py-3 text-text-primary">{new Date(shift.start_time).toLocaleDateString()}</td>
                              <td className="px-6 py-3 text-text-primary">{new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-6 py-3 text-text-primary">{new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-6 py-3">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                  shift.status === 'completed' ? 'bg-success-bg text-success-text ring-1 ring-success-border' :
                                  shift.status === 'scheduled' ? 'bg-info-bg text-info-text ring-1 ring-info-border' :
                                  shift.status === 'in_progress' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                                  'bg-surface-hover text-text-primary'
                                }`}>
                                  {shift.status}
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                <button
                                  className="bg-[color:var(--color-info)] hover:opacity-90 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
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

                      <div className="space-y-3 md:hidden" data-mobile-stack="cards">
                        {shifts.map((shift: any) => (
                          <article key={`schedule-mobile-${shift.id}`} className="rounded border border-border-subtle bg-background p-4">
                            <h3 className="text-sm font-semibold text-text-primary">{shift.guard_name || shift.guard_username}</h3>
                            <p className="mt-0.5 text-xs text-text-tertiary">{shift.client_site}</p>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                              <div>
                                <dt className="text-text-tertiary">Date</dt>
                                <dd className="font-medium text-text-primary">{new Date(shift.start_time).toLocaleDateString()}</dd>
                              </div>
                              <div>
                                <dt className="text-text-tertiary">Status</dt>
                                <dd className="font-medium uppercase text-text-primary">{shift.status}</dd>
                              </div>
                              <div>
                                <dt className="text-text-tertiary">Start</dt>
                                <dd className="font-medium text-text-primary">{new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd>
                              </div>
                              <div>
                                <dt className="text-text-tertiary">End</dt>
                                <dd className="font-medium text-text-primary">{new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd>
                              </div>
                            </dl>
                            <button
                              className="mt-3 rounded-md bg-[color:var(--color-info)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
                              onClick={() => setEditingShift(shift)}
                              title="Edit shift"
                            >
                              Edit
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-text-secondary">No schedules found — create a new schedule to get started.</p>
                      <p className="mt-1 text-xs text-text-tertiary">Schedules will appear here once created.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

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
            <div className="fixed inset-0 z-[95] flex">
              <button
                className="h-full flex-1 bg-black/45 backdrop-blur-[1px]"
                onClick={() => setSelectedApproval(null)}
                aria-label="Close approval details"
              />
              <aside className="soc-scroll-area h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-text-primary">Approval Details</h3>
                <p className="mt-1 text-sm text-text-secondary">Review applicant information before deciding.</p>

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
                    className="rounded bg-[color:var(--color-success)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApprovalAction(selectedApproval.id, 'reject')}
                    className="rounded bg-[color:var(--color-danger)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setSelectedApproval(null)}
                    className="rounded border border-border px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-hover"
                  >
                    Close
                  </button>
                </div>
              </aside>
            </div>
          )}

        <BugReportButton userId={user.id} />
      </div>
    </OperationalShell>
  )
}

export default AdminDashboard
