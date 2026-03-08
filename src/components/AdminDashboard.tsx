import { useState, useEffect, FC } from 'react'
import EditUserModal from './EditUserModal'
import EditScheduleModal from './EditScheduleModal'
import BugReportButton from './BugReportButton'
import { API_BASE_URL } from '../config'
import { User as AppUser } from '../App'
import { getSidebarNav } from '../config/navigation'
import OperationalShell from './layout/OperationalShell'
import Allowed from './rbac/Allowed'
import DeniedFallback from './rbac/DeniedFallback'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import CommandCenterDashboard from './dashboard/CommandCenterDashboard'

interface User {
  id: string
  email: string
  username: string
  role: string
  full_name?: string
  phone_number?: string
  license_number?: string
  license_issued_date?: string
  license_expiry_date?: string
  address?: string
  [key: string]: any
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
  const currentView = activeView || activeSection
  const navItems = getSidebarNav(user.role, { homeView: 'users' })

  useEffect(() => {
    if (activeSection === 'users') {
      fetchUsers()
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

  const handleRefresh = () => {
    if (activeSection === 'users') {
      fetchUsers()
    } else if (activeSection === 'approvals') {
      fetchPendingApprovals()
    } else {
      fetchShifts()
    }
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
      rightSlot={
        <button
          onClick={handleRefresh}
          className="hidden rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover md:block"
        >
          Refresh
        </button>
      }
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
                <div className="text-center py-12 text-text-secondary font-medium">Loading users...</div>
              )}

              {!loading && (
                <div className="bg-surface rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Users</h2>
                  {users.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead className="bg-surface-hover border-b border-border">
                          <tr>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Email</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Username</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Full Name</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Role</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u: User) => (
                            <tr key={u.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                              <td className="px-6 py-3 text-text-primary">{u.email}</td>
                              <td className="px-6 py-3 text-text-primary">{u.username}</td>
                              <td className="px-6 py-3 text-text-primary">{u.full_name || '-'}</td>
                              <td className="px-6 py-3">
                                <span className="inline-block px-3 py-1 bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30 rounded-full text-xs font-semibold">
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-6 py-3 flex gap-2">
                                <button
                                  className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm font-semibold"
                                  onClick={() => handleEditUser(u)}
                                  title="Edit user details"
                                >
                                  Edit
                                </button>
                                <Allowed
                                  role={user.role}
                                  permission="manage_users"
                                  fallback={<DeniedFallback title="Delete disabled" reason="Your role cannot delete user accounts." />}
                                >
                                  <button
                                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-semibold"
                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                    title="Delete user"
                                  >
                                    Delete
                                  </button>
                                </Allowed>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-text-secondary text-center py-8">No users found</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Approvals Section */}
          {activeSection === 'approvals' && (
            <>
              {approvalsLoading && (
                <div className="text-center py-12 text-text-secondary font-medium">Loading pending approvals...</div>
              )}

              {!approvalsLoading && (
                <div className="bg-surface rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">Pending Guard Registrations</h2>
                  {pendingApprovals.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px]">
                        <thead className="bg-surface-hover border-b border-border">
                          <tr>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Applicant</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Contact</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">License</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Submitted</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-text-primary uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingApprovals.map((pendingUser) => (
                            <tr key={pendingUser.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                              <td className="px-4 py-3 text-text-primary">
                                <div className="font-medium">{pendingUser.full_name || pendingUser.username}</div>
                                <div className="text-xs text-text-tertiary">{pendingUser.username}</div>
                              </td>
                              <td className="px-4 py-3 text-text-primary">
                                <div>{pendingUser.email}</div>
                                <div className="text-xs text-text-tertiary">{pendingUser.phone_number || '-'}</div>
                              </td>
                              <td className="px-4 py-3 text-text-primary">
                                <div>{pendingUser.license_number || '-'}</div>
                                <div className="text-xs text-text-tertiary">
                                  Exp: {pendingUser.license_expiry_date ? new Date(pendingUser.license_expiry_date).toLocaleDateString() : '-'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-text-primary">
                                {new Date(pendingUser.created_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setSelectedApproval(pendingUser)}
                                    className="px-3 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors text-sm font-semibold"
                                  >
                                    Details
                                  </button>
                                  <button
                                    onClick={() => handleApprovalAction(pendingUser.id, 'approve')}
                                    disabled={processingApprovalId === pendingUser.id}
                                    className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60 transition-colors text-sm font-semibold"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleApprovalAction(pendingUser.id, 'reject')}
                                    disabled={processingApprovalId === pendingUser.id}
                                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60 transition-colors text-sm font-semibold"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-text-secondary text-center py-8">No pending guard approvals</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Schedule Section */}
          {activeSection === 'schedule' && (
            <>
              {shiftsLoading && (
                <div className="text-center py-12 text-text-secondary font-medium">Loading schedules...</div>
              )}

              {!shiftsLoading && (
                <div className="bg-surface rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold text-text-primary mb-6 pb-3 border-b border-border">All Guard Schedules</h2>
                  {shifts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
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
                                  shift.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' :
                                  shift.status === 'scheduled' ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30' :
                                  shift.status === 'in_progress' ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30' :
                                  'bg-surface-hover text-text-primary'
                                }`}>
                                  {shift.status}
                                </span>
                              </td>
                              <td className="px-6 py-3">
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
                    <p className="text-text-secondary text-center py-8">No schedules found</p>
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
            <div className="fixed inset-0 z-50 flex">
              <button
                className="h-full flex-1 bg-black/40"
                onClick={() => setSelectedApproval(null)}
                aria-label="Close approval details"
              />
              <aside className="h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-text-primary">Approval Details</h3>
                <p className="mt-1 text-sm text-text-secondary">Review applicant information before deciding.</p>

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

        <BugReportButton userId={user.id} />
      </div>
    </OperationalShell>
  )
}

export default AdminDashboard

