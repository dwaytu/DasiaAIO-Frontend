import { useState, useEffect, FC } from 'react'
import Logo from './Logo'
import EditUserModal from './EditUserModal'
import { API_BASE_URL } from '../config'

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

interface SuperadminDashboardProps {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
}

const SuperadminDashboard: FC<SuperadminDashboardProps> = ({ onLogout, onViewChange }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [stats, setStats] = useState<any>({})
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [error, setError] = useState<string>('')
  const [activeSection, setActiveSection] = useState<'dashboard' | 'schedule'>('dashboard')
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false)

  useEffect(() => {
    fetchData()
    if (activeSection === 'schedule') {
      fetchShifts()
    }
  }, [activeSection])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/users`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        
        // Calculate stats
        const adminCount = data.users.filter((u: User) => u.role === 'admin').length
        const guardCount = data.users.filter((u: User) => u.role === 'guard').length
        const userCount = data.users.filter((u: User) => u.role === 'user').length
        
        setStats({
          totalUsers: data.users.length,
          admins: adminCount,
          guards: guardCount,
          regularUsers: userCount
        })
      }
    } catch (err) {
      console.error('Error fetching data:', err)
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

  const handleNavigate = (view: string) => {
    if (view === 'schedule' || view === 'dashboard') {
      setActiveSection(view as 'dashboard' | 'schedule')
    } else if (onViewChange) {
      onViewChange(view)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
  }

  const handleSaveUser = async (updatedData: Partial<User>) => {
    if (!editingUser) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/${editingUser.id}`, {
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
      const response = await fetch(`${API_BASE_URL}/api/user/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete user')
      }

      // Refresh user list
      await fetchData()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  return (
    <div className="flex min-h-screen w-screen bg-gray-100 font-sans">
      <aside className="w-64 bg-gradient-to-b from-indigo-600 to-purple-900 text-white p-8 flex flex-col shadow-lg">
        <div className="pb-6 border-b border-white/20 mb-8">
          <Logo />
        </div>
        <nav className="flex-1 flex flex-col gap-2">
          {[
            { view: 'dashboard', label: 'Dashboard' },
            { view: 'schedule', label: 'Schedule' },
            { view: 'performance', label: 'Performance' },
            { view: 'firearms', label: 'Firearms' },
            { view: 'allocation', label: 'Allocation' },
            { view: 'permits', label: 'Permits' },
            { view: 'maintenance', label: 'Maintenance' },
            { view: 'armored-cars', label: 'Armored Cars' }
          ].map(({ view, label }) => (
            <button
              key={view}
              className={`text-white px-4 py-3 rounded-lg text-left font-medium transition-all duration-300 hover:translate-x-1 ${
                (view === 'dashboard' && activeSection === 'dashboard') || (view === 'schedule' && activeSection === 'schedule')
                  ? 'bg-white/30 border-l-4 border-yellow-400 pl-3' 
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              onClick={() => handleNavigate(view)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button 
          onClick={onLogout} 
          className="bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 text-white px-4 py-3 rounded-lg font-semibold mt-6 transition-colors"
        >
          Logout
        </button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="bg-white px-8 py-6 flex justify-between items-center shadow-sm border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 m-0">
            {activeSection === 'dashboard' ? 'Dashboard' : 'Guard Schedules'}
          </h1>
          <button 
            onClick={onLogout} 
            className="bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5"
          >
            Logout
          </button>
        </header>

        {error && <div className="bg-red-50 text-red-900 px-8 py-3 border border-red-200 rounded mx-8 my-4 font-medium">{error}</div>}

        {activeSection === 'dashboard' && loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading system data...</div>
          </div>
        ) : activeSection === 'dashboard' ? (
          <div className="flex-1 p-8 overflow-y-auto w-full">
            <section className="w-full grid grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-indigo-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <h3 className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">Total Users</h3>
                <p className="text-4xl font-bold text-indigo-600">{stats.totalUsers}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-indigo-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <h3 className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">Administrators</h3>
                <p className="text-4xl font-bold text-indigo-600">{stats.admins}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-indigo-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <h3 className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">Guards</h3>
                <p className="text-4xl font-bold text-indigo-600">{stats.guards}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-indigo-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <h3 className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">Regular Users</h3>
                <p className="text-4xl font-bold text-indigo-600">{stats.regularUsers}</p>
              </div>
            </section>

            <section className="w-full bg-white p-8 rounded-xl shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">All Users</h2>
              {users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Username</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Full Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Role</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u: User) => (
                        <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{u.email}</td>
                          <td className="px-4 py-3 text-gray-700">{u.username}</td>
                          <td className="px-4 py-3 text-gray-700">{u.full_name || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              u.role === 'admin' ? 'bg-red-100 text-red-800' :
                              u.role === 'superadmin' ? 'bg-amber-100 text-amber-800' :
                              u.role === 'guard' ? 'bg-green-100 text-green-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 flex gap-2">
                            <button 
                              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold text-sm uppercase tracking-wider transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-md"
                              onClick={() => handleEditUser(u)}
                              title="Edit user details"
                            >
                              Edit
                            </button>
                            <button 
                              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold text-sm uppercase tracking-wider transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-md"
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
                <p className="text-center text-gray-400 py-8 italic text-sm md:text-base">No users found</p>
              )}
            </section>
          </div>
        ) : activeSection === 'schedule' ? (
          <div className="flex-1 p-8 overflow-y-auto w-full">
            {shiftsLoading ? (
              <div className="text-center py-12 text-gray-600 font-medium">Loading schedules...</div>
            ) : (
              <section className="w-full bg-white p-8 rounded-xl shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">All Guard Schedules</h2>
                {shifts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Guard</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Site</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Start Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">End Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map((shift: any) => (
                          <tr key={shift.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700">
                              <div className="font-medium">{shift.guard_name || shift.guard_username}</div>
                              <div className="text-xs text-gray-500">{shift.guard_username}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{shift.client_site}</td>
                            <td className="px-4 py-3 text-gray-700">{new Date(shift.start_time).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-gray-700">{new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-4 py-3 text-gray-700">{new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                shift.status === 'completed' ? 'bg-green-100 text-green-800' :
                                shift.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                shift.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {shift.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-8 italic text-sm md:text-base">No schedules found</p>
                )}
              </section>
            )}
          </div>
        ) : null}

        {editingUser && (
          <EditUserModal 
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveUser}
          />
        )}
      </main>
    </div>
  )
}

export default SuperadminDashboard
