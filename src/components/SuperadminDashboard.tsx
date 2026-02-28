import { useState, useEffect, FC } from 'react'
import EditUserModal from './EditUserModal'
import EditScheduleModal from './EditScheduleModal'
import AnalyticsDashboard from './AnalyticsDashboard'
import TripManagement from './TripManagement'
import NotificationCenter, { Notification, createNotification } from './NotificationCenter'
import Sidebar from './Sidebar'
import Header from './Header'
import { API_BASE_URL } from '../config'
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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'schedule' | 'missions' | 'analytics' | 'trips'>('dashboard')
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false)
  const [missions, setMissions] = useState<any[]>([])
  const [missionsLoading, setMissionsLoading] = useState<boolean>(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
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
  const [searchQuery, setSearchQuery] = useState<string>('')
  const navItems = [
    { view: 'dashboard', label: 'Dashboard', group: 'MAIN MENU' },
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
    { view: 'armored-cars', label: 'Armored Cars', group: 'RESOURCES' },
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
    console.log('activeSection changed to:', activeSection)
  }, [activeSection])

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
  }, [activeView])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/users`)
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      const users = Array.isArray(data) ? data : (data.users || data || [])
      setUsers(users)
      
      // Calculate stats
      const adminCount = users.filter((u: User) => u.role === 'admin').length
      const guardCount = users.filter((u: User) => u.role === 'guard').length
      const userCount = users.filter((u: User) => u.role === 'user').length
      
      setStats({
        totalUsers: users.length,
        admins: adminCount,
        guards: guardCount,
        regularUsers: userCount
      })
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

  const filteredUsers = users.filter(u =>
    !searchQuery ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

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
      <div className="flex min-h-screen w-screen bg-background font-sans">
        <Sidebar
          items={navItems}
          activeView={activeSection}
          onNavigate={handleNavigate}
          onLogoClick={() => setActiveSection('dashboard')}
          onLogout={onLogout}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title={sectionTitle}
          badgeLabel={badgeLabel}
          onLogout={onLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          onNavigateToProfile={() => onViewChange('profile')}
          rightSlot={
            <button
              onClick={handleRefresh}
              className="px-3 py-2 text-sm font-semibold text-text-primary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors hidden md:block"
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
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <section className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
              {/* Total Users */}
              <div className="bento-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">Total Users</p>
                  <p className="text-3xl font-bold text-text-primary">{stats.totalUsers ?? '—'}</p>
                </div>
              </div>
              {/* Administrators */}
              <div className="bento-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">Administrators</p>
                  <p className="text-3xl font-bold text-text-primary">{stats.admins ?? '—'}</p>
                </div>
              </div>
              {/* Active Guards */}
              <div className="bento-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">Active Guards</p>
                  <p className="text-3xl font-bold text-text-primary">{stats.guards ?? '—'}</p>
                </div>
              </div>
              {/* Regular Users */}
              <div className="bento-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">Regular Users</p>
                  <p className="text-3xl font-bold text-text-primary">{stats.regularUsers ?? '—'}</p>
                </div>
              </div>
            </section>

            <section className="w-full bento-card !p-0 overflow-hidden">
              {/* Table header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border-subtle">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">User Management</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">Manage system users, permissions, and security roles</p>
                </div>
                <div className="flex items-center gap-2">
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
                  <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-background border border-border-subtle rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    Filter
                  </button>
                </div>
              </div>
              {filteredUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">User Details</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Username</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Role</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Status</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-tertiary">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {filteredUsers.map((u: User) => {
                        const initial = (u.full_name || u.username || '?').charAt(0).toUpperCase()
                        const avatarColor = u.role === 'admin' || u.role === 'superadmin'
                          ? 'bg-purple-500/20 text-purple-300'
                          : u.role === 'guard'
                          ? 'bg-teal-500/20 text-teal-300'
                          : 'bg-blue-500/20 text-blue-300'
                        const rolePill = u.role === 'superadmin'
                          ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                          : u.role === 'admin'
                          ? 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30'
                          : u.role === 'guard'
                          ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30'
                          : 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
                        return (
                          <tr key={u.id} className="hover:bg-surface-hover/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor}`}>
                                  {initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-text-primary truncate">{u.full_name || u.username}</div>
                                  <div className="text-xs text-text-tertiary truncate">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-text-secondary">{u.username}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${rolePill}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.7)' }} />
                                <span className="text-xs text-text-secondary">Online</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleEditUser(u)}
                                  title="Edit user"
                                  className="p-2 rounded-lg text-text-tertiary hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  title="Delete user"
                                  className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-text-secondary py-12 italic text-sm">No users found</p>
              )}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
                <p className="text-xs text-text-tertiary">Showing {filteredUsers.length} of {users.length} users</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-background border border-border-subtle rounded-lg hover:bg-surface-hover transition-colors">Previous</button>
                  <button className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-background border border-border-subtle rounded-lg hover:bg-surface-hover transition-colors">Next</button>
                </div>
              </div>
            </section>
          </div>
        ) : activeSection === 'schedule' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {shiftsLoading ? (
              <div className="text-center py-12 text-text-secondary font-medium">Loading schedules...</div>
            ) : (
              <section className="w-full bg-surface p-6 md:p-8 rounded-xl shadow-sm">
                <h2 className="text-2xl font-bold text-text-primary mb-6">All Guard Schedules</h2>
                {shifts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[600px]">
                      <thead className="bg-background">
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
            )}
          </div>
        ) : activeSection === 'missions' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {/* Mission Assignment Form */}
            <section className="w-full bg-surface p-6 md:p-8 rounded-xl shadow-sm mb-6">
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

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Guards Required</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={missionFormData.guards_required}
                    onChange={(e) => setMissionFormData({...missionFormData, guards_required: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Firearms Required</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={missionFormData.firearms_required}
                    onChange={(e) => setMissionFormData({...missionFormData, firearms_required: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Vehicles Required</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="5"
                    value={missionFormData.vehicles_required}
                    onChange={(e) => setMissionFormData({...missionFormData, vehicles_required: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>

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
            <section className="w-full bg-surface p-6 md:p-8 rounded-xl shadow-sm">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Mission History</h2>
              {missionsLoading ? (
                <div className="text-center py-12 text-text-secondary font-medium">Loading missions...</div>
              ) : missions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead className="bg-background">
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


