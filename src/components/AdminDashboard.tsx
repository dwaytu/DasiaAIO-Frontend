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
  license_expiry_date?: string
  [key: string]: any
}

interface AdminDashboardProps {
  user: AppUser
  onLogout: () => void
}

const AdminDashboard: FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingShift, setEditingShift] = useState<any | null>(null)
  const [activeSection, setActiveSection] = useState<'users' | 'schedule'>('users')
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const navItems = [
    { view: 'users', label: 'Dashboard' },
    { view: 'calendar', label: 'Calendar' },
    { view: 'schedule', label: 'Schedule' },
    { view: 'merit', label: 'Merit Scores' }
  ]

  useEffect(() => {
    fetchUsers()
    if (activeSection === 'schedule') {
      fetchShifts()
    }
  }, [activeSection])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/users`)
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data.users)
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
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts`)
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

  const handleLogout = () => {
    onLogout()
  }

  const handleRefresh = () => {
    if (activeSection === 'users') {
      fetchUsers()
    } else {
      fetchShifts()
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
  }

  const handleSaveUser = async (updatedData: Partial<User>) => {
    if (!editingUser) return

    try {
      const response = await fetch(`http://localhost:5000/api/user/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetch(`http://localhost:5000/api/user/${userId}`, {
        method: 'DELETE',
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
    <div className="flex min-h-screen w-screen bg-gray-100 font-sans">
      <Sidebar
        items={navItems}
        activeView={activeSection}
        onNavigate={(view) => setActiveSection(view as 'users' | 'schedule')}
        onLogoClick={() => setActiveSection('users')}
        onLogout={handleLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title={activeSection === 'users' ? 'User Management' : 'Guard Schedules'}
          badgeLabel={activeSection === 'users' ? 'Users' : 'Schedule'}
          onLogout={handleLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          onNavigateToProfile={() => window.location.reload()}
          rightSlot={
            <button
              onClick={handleRefresh}
              className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors hidden md:block"
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
                <div className="text-center py-12 text-gray-600 font-medium">Loading users...</div>
              )}

              {!loading && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">Users</h2>
                  {users.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Username</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Full Name</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u: User) => (
                            <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3 text-gray-800">{u.email}</td>
                              <td className="px-6 py-3 text-gray-800">{u.username}</td>
                              <td className="px-6 py-3 text-gray-800">{u.full_name || '-'}</td>
                              <td className="px-6 py-3">
                                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
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
                                <button
                                  className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-semibold"
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  title="Delete user"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-600 text-center py-8">No users found</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Schedule Section */}
          {activeSection === 'schedule' && (
            <>
              {shiftsLoading && (
                <div className="text-center py-12 text-gray-600 font-medium">Loading schedules...</div>
              )}

              {!shiftsLoading && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">All Guard Schedules</h2>
                  {shifts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Guard</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Site</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Start Time</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">End Time</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shifts.map((shift: any) => (
                            <tr key={shift.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3 text-gray-800">
                                <div className="font-medium">{shift.guard_name || shift.guard_username}</div>
                                <div className="text-xs text-gray-500">{shift.guard_username}</div>
                              </td>
                              <td className="px-6 py-3 text-gray-800">{shift.client_site}</td>
                              <td className="px-6 py-3 text-gray-800">{new Date(shift.start_time).toLocaleDateString()}</td>
                              <td className="px-6 py-3 text-gray-800">{new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-6 py-3 text-gray-800">{new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-6 py-3">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                  shift.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  shift.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                  shift.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
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
                    <p className="text-gray-600 text-center py-8">No schedules found</p>
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
