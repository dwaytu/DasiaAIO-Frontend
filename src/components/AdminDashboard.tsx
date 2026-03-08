import { useState, useEffect, FC } from 'react'
import EditUserModal from './EditUserModal'
import EditScheduleModal from './EditScheduleModal'
import BugReportButton from './BugReportButton'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'
import { User as AppUser } from '../App'

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
  const [approvalsLoading, setApprovalsLoading] = useState<boolean>(false)
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || activeSection
  const navItems = [
    { view: 'users', label: 'Dashboard', group: 'MAIN MENU' },
    { view: 'approvals', label: 'Approvals', group: 'MAIN MENU' },
    { view: 'calendar', label: 'Calendar', group: 'MAIN MENU' },
    { view: 'analytics', label: 'Analytics', group: 'MAIN MENU' },
    { view: 'trips', label: 'Trip Management', group: 'OPERATIONS' },
    { view: 'schedule', label: 'Schedule', group: 'OPERATIONS' },
    { view: 'missions', label: 'Missions', group: 'OPERATIONS' },
    { view: 'performance', label: 'Performance', group: 'OPERATIONS' },
    { view: 'merit', label: 'Merit Scores', group: 'OPERATIONS' },
    { view: 'firearms', label: 'Firearms', group: 'RESOURCES' },
    { view: 'allocation', label: 'Allocation', group: 'RESOURCES' },
    { view: 'permits', label: 'Permits', group: 'RESOURCES' },
    { view: 'maintenance', label: 'Maintenance', group: 'RESOURCES' },
    { view: 'armored-cars', label: 'Armored Cars', group: 'RESOURCES' }
  ]

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
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
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
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch shifts')
      }
      const data = await response.json()
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
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/users/pending-approvals`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch pending approvals')
      }
      const data = await response.json()
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
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/users/${targetUserId}/approval`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        let message = `Failed to ${action} account`
        try {
          const payload = await response.json()
          message = payload.error || payload.message || message
        } catch {
          // keep fallback
        }
        throw new Error(message)
      }

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
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/user/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedData),
      })

      if (!response.ok) {
        throw new Error('Failed to update user')
      }

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
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/user/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete user')
      }

      // Refresh user list
      await fetchUsers()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  return (
    <div className="flex min-h-screen w-screen bg-background font-sans">
      <Sidebar
        items={navItems}
        activeView={currentView}
        onNavigate={handleNavigate}
        onLogoClick={() => {
          setActiveSection('users')
          onViewChange?.('users')
        }}
        onLogout={handleLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
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
          onLogout={handleLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined}
          rightSlot={
            <button
              onClick={handleRefresh}
              className="px-3 py-2 text-sm font-semibold text-text-primary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors hidden md:block"
            >
              Refresh
            </button>
          }
        />

        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-red-800 font-medium">
              {error}
            </div>
          )}

          {/* Users Section */}
          {activeSection === 'users' && (
            <>
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
                                {(user.role === 'admin' || user.role === 'superadmin') && (
                                  <button
                                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-semibold"
                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                    title="Delete user"
                                  >
                                    Delete
                                  </button>
                                )}
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

          <BugReportButton userId={user.id} />
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard

