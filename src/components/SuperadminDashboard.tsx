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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'approvals' | 'schedule' | 'missions' | 'analytics' | 'trips'>('dashboard')
  const [shifts, setShifts] = useState<any[]>([])
  const [shiftsLoading, setShiftsLoading] = useState<boolean>(false)
  const [missions, setMissions] = useState<any[]>([])
  const [missionsLoading, setMissionsLoading] = useState<boolean>(false)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalUser[]>([])
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
  const [availableGuards, setAvailableGuards] = useState<User[]>([])
  const [availableFirearms, setAvailableFirearms] = useState<any[]>([])
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [selectedGuards, setSelectedGuards] = useState<string>('')
  const [selectedFirearms, setSelectedFirearms] = useState<string>('')
  const [selectedVehicles, setSelectedVehicles] = useState<string>('')
  const [showAddScheduleForm, setShowAddScheduleForm] = useState<boolean>(false)
  const [scheduleFormData, setScheduleFormData] = useState({
    guard_id: '',
    client_site: '',
    date: '',
    start_time: '',
    end_time: ''
  })
  const normalizedViewerRole = user.role === 'user' ? 'guard' : user.role
  const isSuperadminViewer = normalizedViewerRole === 'superadmin'
  const isAdminViewer = normalizedViewerRole === 'admin'
  const isSupervisorViewer = normalizedViewerRole === 'supervisor'
  const canDeleteUsers = isSuperadminViewer || isAdminViewer

  const navItems = [
    { view: 'dashboard', label: 'Dashboard', group: 'MAIN MENU' },
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
    { view: 'armored-cars', label: 'Armored Cars', group: 'RESOURCES' },
  ].filter(item => {
    if (item.view === 'approvals') {
      return isSuperadminViewer || isAdminViewer || isSupervisorViewer
    }
    return true
  })

  const normalizeRole = (role: string) => role === 'user' ? 'guard' : role
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
    activeSection === 'trips' ? 'Trip Management' : 'Dashboard'
  const badgeLabel =
    activeSection === 'dashboard' ? 'Overview' :
    activeSection === 'approvals' ? 'Approvals' :
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
    fetchGuardsAndFirearms()
    if (activeSection === 'approvals') {
      fetchPendingApprovals()
    } else if (activeSection === 'schedule') {
      fetchShifts()
    } else if (activeSection === 'missions') {
      fetchMissions()
    }
  }, [activeSection])

  useEffect(() => {
    if (!activeView) return
    const viewToSection: Record<string, 'dashboard' | 'approvals' | 'schedule' | 'missions' | 'analytics' | 'trips'> = {
      users: 'dashboard',
      dashboard: 'dashboard',
      approvals: 'approvals',
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
      
      // Calculate stats
      const superadminCount = users.filter((u: User) => u.role === 'superadmin').length
      const adminCount = users.filter((u: User) => u.role === 'admin').length
      const supervisorCount = users.filter((u: User) => u.role === 'supervisor').length
      const guardCount = users.filter((u: User) => u.role === 'guard' || u.role === 'user').length
      
      setStats({
        totalUsers: users.length,
        superadmins: superadminCount,
        admins: adminCount,
        supervisors: supervisorCount,
        guards: guardCount,
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
      // Fetch all users (all users are guards)
      const token = localStorage.getItem('token')
      const usersResponse = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        const allUsers = Array.isArray(usersData) ? usersData : (usersData.users || [])
        // Filter out admin users, only get regular users (guards)
        const guards = allUsers.filter((u: User) => u.role === 'guard' || u.role === 'user')
        setAvailableGuards(guards)
      }

      // Fetch firearms (backend returns array directly)
      const firearmsResponse = await fetch(`${API_BASE_URL}/api/firearms`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (firearmsResponse.ok) {
        const firearmsData = await firearmsResponse.json()
        // Backend returns array directly, handle both formats for compatibility
        const firearms = Array.isArray(firearmsData) ? firearmsData : (firearmsData.firearms || [])
        // Only show available firearms
        const availableOnly = firearms.filter((f: any) => f.status === 'available')
        setAvailableFirearms(availableOnly)
      }

      // Fetch armored cars (vehicles)
      const vehiclesResponse = await fetch(`${API_BASE_URL}/api/armored-cars`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (vehiclesResponse.ok) {
        const vehiclesData = await vehiclesResponse.json()
        const vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData.armored_cars || vehiclesData.vehicles || [])
        // Only show available vehicles
        const availableVehicles = vehicles.filter((v: any) => v.status === 'available')
        setAvailableVehicles(availableVehicles)
      }
    } catch (err) {
      console.error('Error fetching guards, firearms, and vehicles:', err)
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
      
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/missions/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...missionFormData,
          guards_required: selectedGuards ? 1 : 0,
          firearms_required: selectedFirearms ? 1 : 0,
          vehicles_required: selectedVehicles ? 1 : 0
        })
      })

      if (!response.ok) {
        let errorMsg = 'Failed to assign mission'
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorData.message || errorMsg
        } catch {
          // If response is not JSON, try to get text
          try {
            const text = await response.text()
            errorMsg = text || errorMsg
          } catch {
            errorMsg = `Server error: ${response.status} ${response.statusText}`
          }
        }
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
      setError(err instanceof Error ? err.message : 'Failed to assign mission')
    } finally {
      setMissionsLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    console.log('handleNavigate called with view:', view);
    if (view === 'approvals' || view === 'schedule' || view === 'dashboard' || view === 'missions' || view === 'analytics' || view === 'trips') {
      console.log('Setting activeSection to:', view);
      setActiveSection(view as 'dashboard' | 'approvals' | 'schedule' | 'missions' | 'analytics' | 'trips')
    } else if (onViewChange) {
      console.log('Calling onViewChange with view:', view);
      onViewChange(view)
    } else {
      console.log('No handler for view:', view);
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

      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        let errorMsg = 'Failed to create schedule'
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorData.message || errorMsg
        } catch {
          // If response is not JSON, try to get text
          try {
            const text = await response.text()
            errorMsg = text || errorMsg
          } catch {
            errorMsg = `Server error: ${response.status} ${response.statusText}`
          }
        }
        addNotification('error', 'Schedule Creation Failed', errorMsg)
        throw new Error(errorMsg)
      }

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
      setError(err instanceof Error ? err.message : 'Failed to create schedule')
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
      await fetchData()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const roleScopedUsers = users.filter(u => canViewUserRow(u.role))

  const filteredUsers = roleScopedUsers.filter(u =>
    !searchQuery ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleRefresh = () => {
    fetchData()
    if (activeSection === 'approvals') {
      fetchPendingApprovals()
    }
    if (activeSection === 'schedule') {
      fetchShifts()
    }
    if (activeSection === 'missions') {
      fetchMissions()
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
          // keep fallback message
        }
        throw new Error(message)
      }

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
      <div className="flex min-h-screen lg:h-screen w-full bg-background font-sans">
        <Sidebar
          items={navItems}
          activeView={activeSection}
          onNavigate={handleNavigate}
          onLogoClick={() => setActiveSection('dashboard')}
          onLogout={onLogout}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden w-full">
        <Header
          title={sectionTitle}
          badgeLabel={badgeLabel}
          onLogout={onLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          onNavigateToProfile={() => onViewChange?.('profile')}
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
          <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-8 w-full animate-fade-in gap-4 md:gap-6">
            <section className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 flex-shrink-0">
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
              {/* Supervisors */}
              <div className="bento-card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">Supervisors</p>
                  <p className="text-3xl font-bold text-text-primary">{stats.supervisors ?? '—'}</p>
                </div>
              </div>
            </section>

            <section className="flex flex-col flex-1 min-h-0 w-full bento-card !p-0 overflow-hidden table-glass">
              {/* Table header — static, never scrolls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border-subtle flex-shrink-0">
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
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="thead-glass">
                      <tr className="border-b border-border">
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
                        const normalizedRole = u.role === 'user' ? 'guard' : u.role
                        const avatarColor = normalizedRole === 'superadmin' || normalizedRole === 'admin'
                          ? 'bg-purple-500/20 text-purple-300'
                          : normalizedRole === 'supervisor'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-teal-500/20 text-teal-300'
                        const rolePill = normalizedRole === 'superadmin' || normalizedRole === 'admin'
                          ? 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30'
                          : normalizedRole === 'supervisor'
                            ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30'
                        const displayRole = normalizedRole
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
                                {displayRole}
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
                                {canEditUserRow(u.role) && (
                                  <button
                                    onClick={() => handleEditUser(u)}
                                    title="Edit user"
                                    className="p-2 rounded-lg text-text-tertiary hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                )}
                                {canDeleteUsers && canEditUserRow(u.role) && u.id !== user.id && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                    title="Delete user"
                                    className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                )}
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
        ) : activeSection === 'approvals' ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {approvalsLoading ? (
              <div className="text-center py-12 text-text-secondary font-medium">Loading pending approvals...</div>
            ) : (
              <section className="w-full table-glass rounded-2xl p-6 md:p-8">
                <h2 className="text-2xl font-bold text-text-primary mb-6">Pending Guard Registrations</h2>
                {pendingApprovals.length > 0 ? (
                  <div className="overflow-auto">
                    <table className="w-full border-collapse min-w-[820px]">
                      <thead className="thead-glass">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Applicant</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Contact</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">License</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Submitted</th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingApprovals.map((pendingUser) => (
                          <tr key={pendingUser.id} className="border-b border-border hover:bg-surface-hover">
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
                            <td className="px-4 py-3 text-text-primary">{new Date(pendingUser.created_at).toLocaleString()}</td>
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
                  <p className="text-center text-text-secondary py-8 italic text-sm md:text-base">No pending guard approvals</p>
                )}
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
                      <label className="block text-sm font-semibold text-text-primary mb-1">Select Guard</label>
                      <select
                        required
                        value={scheduleFormData.guard_id}
                        onChange={(e) => setScheduleFormData({...scheduleFormData, guard_id: e.target.value})}
                        className="w-full px-4 py-2.5 border-2 border-border/50 rounded-xl bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all duration-200 hover:border-border [&>option]:py-2 [&>option]:px-2 [&>option:disabled]:text-text-tertiary [&>option:disabled]:italic"
                      >
                        <option value="" className="text-text-tertiary italic">-- Select a guard --</option>
                        {availableGuards.map((guard) => (
                          <option key={guard.id} value={guard.id}>
                            {guard.full_name || guard.username}
                          </option>
                        ))}
                      </select>
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

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Select Guard</label>
                  <select
                    required
                    value={selectedGuards}
                    onChange={(e) => setSelectedGuards(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all duration-200"
                  >
                    <option value="">-- Select a guard --</option>
                    {availableGuards.length > 0 ? (
                      availableGuards.map((guard) => (
                        <option key={guard.id} value={guard.id}>
                          {guard.full_name || guard.username}
                        </option>
                      ))
                    ) : (
                      <option disabled>No guards available</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Select Firearm</label>
                  <select
                    required
                    value={selectedFirearms}
                    onChange={(e) => setSelectedFirearms(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                  >
                    <option value="">-- Select a firearm --</option>
                    {availableFirearms.length > 0 ? (
                      availableFirearms.map((firearm) => (
                        <option key={firearm.id} value={firearm.id}>
                          {firearm.serial_number} - {firearm.model} ({firearm.caliber})
                        </option>
                      ))
                    ) : (
                      <option disabled>No available firearms in inventory</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Select Vehicle</label>
                  <select
                    required
                    value={selectedVehicles}
                    onChange={(e) => setSelectedVehicles(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all duration-200"
                  >
                    <option value="">-- Select a vehicle --</option>
                    {availableVehicles.length > 0 ? (
                      availableVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.model} - {vehicle.license_plate} (Capacity: {vehicle.capacity_kg}kg)
                        </option>
                      ))
                    ) : (
                      <option disabled>No available vehicles</option>
                    )}
                  </select>
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


