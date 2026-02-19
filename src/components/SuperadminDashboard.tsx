import { useState, useEffect, FC } from 'react'
import EditUserModal from './EditUserModal'
import EditScheduleModal from './EditScheduleModal'
import AnalyticsDashboard from './AnalyticsDashboard'
import TripManagement from './TripManagement'
import NotificationCenter, { Notification, createNotification } from './NotificationCenter'
import Sidebar from './Sidebar'
import Header from './Header'
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
  activeView?: string
}

const SuperadminDashboard: FC<SuperadminDashboardProps> = ({ onLogout, onViewChange, activeView }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [stats, setStats] = useState<any>({})
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingShift, setEditingShift] = useState<any | null>(null)
  const [error, setError] = useState<string>('')
  const [activeSection, setActiveSection] = useState<'dashboard' | 'schedule' | 'missions' | 'analytics' | 'trips'>('dashboard')
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false)
  const [missions, setMissions] = useState<any[]>([])
  const [missionsLoading, setMissionsLoading] = useState<boolean>(false)
  const [missionFormData, setMissionFormData] = useState({
    mission_name: '',
    guards_required: 2,
    vehicles_required: 1,
    firearms_required: 2,
    date: '',
    start_time: '',
    end_time: '',
    destination: '',
    priority: 'medium',
    special_requirements: ''
  })
  const [missionResponse, setMissionResponse] = useState<any>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const navItems = [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'analytics', label: 'Analytics' },
    { view: 'trips', label: 'Trip Management' },
    { view: 'schedule', label: 'Schedule' },
    { view: 'missions', label: 'Missions' },
    { view: 'performance', label: 'Performance' },
    { view: 'firearms', label: 'Firearms' },
    { view: 'allocation', label: 'Allocation' },
    { view: 'permits', label: 'Permits' },
    { view: 'maintenance', label: 'Maintenance' },
    { view: 'armored-cars', label: 'Armored Cars' }
  ]
  const sectionTitle =
    activeSection === 'dashboard' ? 'Dashboard' :
    activeSection === 'schedule' ? 'Guard Schedules' :
    activeSection === 'missions' ? 'Mission Assignment' :
    activeSection === 'analytics' ? 'Analytics & Reports' :
    activeSection === 'trips' ? 'Trip Management' : 'Dashboard'
  const badgeLabel =
    activeSection === 'dashboard' ? 'Overview' :
    activeSection === 'trips' ? 'Trips' :
    activeSection.replace('-', ' ')

  const addNotification = (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => {
    const notification = createNotification(type, title, message)
    setNotifications(prev => [...prev, notification])
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  useEffect(() => {
    fetchData()
    if (activeSection === 'schedule') {
      fetchShifts()
    } else if (activeSection === 'missions') {
      fetchMissions()
    }
  }, [activeSection])

  useEffect(() => {
    if (!activeView) return
    const viewToSection: Record<string, 'dashboard' | 'schedule' | 'missions' | 'analytics' | 'trips'> = {
      users: 'dashboard',
      dashboard: 'dashboard',
      schedule: 'schedule',
      missions: 'missions',
      analytics: 'analytics',
      trips: 'trips'
    }
    const nextSection = viewToSection[activeView]
    if (nextSection && nextSection !== activeSection) {
      setActiveSection(nextSection)
    }
  }, [activeView, activeSection])

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

  const fetchMissions = async () => {
    try {
      setMissionsLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/missions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch missions')
      }
      const data = await response.json()
      setMissions(data.missions || [])
      setError('')
    } catch (err) {
      setError('Error loading missions: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setMissionsLoading(false)
    }
  }

  const handleMissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setMissionsLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/missions/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(missionFormData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = errorData.message || 'Failed to assign mission'
        addNotification('error', 'Mission Assignment Failed', errorMsg)
        throw new Error(errorMsg)
      }

      const data = await response.json()
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
        guards_required: 2,
        vehicles_required: 1,
        firearms_required: 2,
        date: '',
        start_time: '',
        end_time: '',
        destination: '',
        priority: 'medium',
        special_requirements: ''
      })

      // Refresh missions list
      await fetchMissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign mission')
    } finally {
      setMissionsLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    console.log('handleNavigate called with view:', view);
    if (view === 'schedule' || view === 'dashboard' || view === 'missions' || view === 'analytics' || view === 'trips') {
      console.log('Setting activeSection to:', view);
      setActiveSection(view as 'dashboard' | 'schedule' | 'missions' | 'analytics' | 'trips')
    } else if (onViewChange) {
      console.log('Calling onViewChange with view:', view);
      onViewChange(view)
    } else {
      console.log('No handler for view:', view);
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

  const handleRefresh = () => {
    fetchData()
    if (activeSection === 'schedule') {
      fetchShifts()
    }
    if (activeSection === 'missions') {
      fetchMissions()
    }
  }

  return (
    <>
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
      <div className="flex min-h-screen w-screen bg-gray-100 font-sans">
        <Sidebar
          items={navItems}
          activeView={activeSection}
          onNavigate={handleNavigate}
          onLogout={onLogout}
        />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title={sectionTitle}
          badgeLabel={badgeLabel}
          onLogout={onLogout}
          rightSlot={
            <button
              onClick={handleRefresh}
              className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
          }
        />

        {error && <div className="bg-red-50 text-red-900 px-8 py-3 border border-red-200 rounded mx-8 my-4 font-medium">{error}</div>}

        {activeSection === 'dashboard' && loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading system data...</div>
          </div>
        ) : activeSection === 'dashboard' ? (
          <div className="flex-1 p-8 overflow-y-auto w-full animate-fade-in">
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
          <div className="flex-1 p-8 overflow-y-auto w-full animate-fade-in">
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
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Actions</th>
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
                  <p className="text-center text-gray-400 py-8 italic text-sm md:text-base">No schedules found</p>
                )}
              </section>
            )}
          </div>
        ) : activeSection === 'missions' ? (
          <div className="flex-1 p-8 overflow-y-auto w-full animate-fade-in">
            {/* Mission Assignment Form */}
            <section className="w-full bg-white p-8 rounded-xl shadow-sm mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Assign New Mission</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {missionResponse && (
                <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-lg">
                  <h3 className="font-bold text-green-900 mb-2">Mission Assigned Successfully!</h3>
                  <p className="text-sm text-gray-700 mb-2">Mission ID: {missionResponse.mission_id}</p>
                  <div className="text-sm text-gray-700">
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mission Name</label>
                  <input
                    type="text"
                    required
                    value={missionFormData.mission_name}
                    onChange={(e) => setMissionFormData({...missionFormData, mission_name: e.target.value})}
                    placeholder="Enter mission name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Destination</label>
                  <input
                    type="text"
                    required
                    value={missionFormData.destination}
                    onChange={(e) => setMissionFormData({...missionFormData, destination: e.target.value})}
                    placeholder="Enter destination"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Guards Required</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={missionFormData.guards_required}
                    onChange={(e) => setMissionFormData({...missionFormData, guards_required: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Firearms Required</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={missionFormData.firearms_required}
                    onChange={(e) => setMissionFormData({...missionFormData, firearms_required: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicles Required</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="5"
                    value={missionFormData.vehicles_required}
                    onChange={(e) => setMissionFormData({...missionFormData, vehicles_required: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={missionFormData.date}
                    onChange={(e) => setMissionFormData({...missionFormData, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={missionFormData.start_time}
                    onChange={(e) => setMissionFormData({...missionFormData, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={missionFormData.end_time}
                    onChange={(e) => setMissionFormData({...missionFormData, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={missionFormData.priority}
                    onChange={(e) => setMissionFormData({...missionFormData, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Special Requirements (Optional)</label>
                  <textarea
                    value={missionFormData.special_requirements}
                    onChange={(e) => setMissionFormData({...missionFormData, special_requirements: e.target.value})}
                    placeholder="Enter any special requirements"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <section className="w-full bg-white p-8 rounded-xl shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Mission History</h2>
              {missionsLoading ? (
                <div className="text-center py-12 text-gray-600 font-medium">Loading missions...</div>
              ) : missions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Destination</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Time</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Vehicle</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Driver</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missions.map((mission: any) => (
                        <tr key={mission.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700 text-xs font-mono">{mission.id.substring(0, 8)}...</td>
                          <td className="px-4 py-3 text-gray-700">{mission.destination || 'N/A'}</td>
                          <td className="px-4 py-3 text-gray-700">{mission.start_time ? new Date(mission.start_time).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {mission.start_time && mission.end_time 
                              ? `${new Date(mission.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(mission.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                              : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{mission.vehicle_model || 'N/A'}</td>
                          <td className="px-4 py-3 text-gray-700">{mission.driver_name || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              mission.status === 'completed' ? 'bg-green-100 text-green-800' :
                              mission.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                              mission.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
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
                <p className="text-center text-gray-400 py-8 italic text-sm md:text-base">No missions found</p>
              )}
            </section>
          </div>
        ) : activeSection === 'analytics' ? (
          <div className="flex-1 p-8 overflow-y-auto w-full animate-fade-in">
            <AnalyticsDashboard />
          </div>
        ) : activeSection === 'trips' ? (
          <div className="flex-1 p-8 overflow-y-auto w-full animate-fade-in">
            <TripManagement />
          </div>
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
      </main>
    </div>
    </>
  )
}

export default SuperadminDashboard
