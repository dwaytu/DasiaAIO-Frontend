import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'
import { User as AppUser } from '../App'

interface User {
  id: string
  email: string
  username: string
  full_name?: string
  phone_number?: string
  license_number?: string
  license_expiry_date?: string
  [key: string]: any
}

interface UserDashboardProps {
  user: AppUser
  onLogout: () => void
  onViewChange?: (view: string) => void
}

interface AttendanceRecord {
  id: string
  check_in_time: string
  check_out_time?: string
  status: string
}

interface ShiftItem {
  id: string
  client_site: string
  start_time: string
  end_time: string
  status: string
}

interface AllocationItem {
  id: string
  firearm_id: string
  firearm_model: string
  firearm_caliber: string
  firearm_serial_number: string
  allocation_date: string
  status: string
}

interface PermitItem {
  id: string
  permit_type: string
  issued_date: string
  expiry_date: string
  status: string
}

interface SupportTicketItem {
  id: string
  subject: string
  message: string
  status: string
  created_at: string
}

const UserDashboard: FC<UserDashboardProps> = ({ user, onLogout, onViewChange }) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'overview' | 'schedule' | 'firearms' | 'permits' | 'support'>('overview')
  const [scheduleItems, setScheduleItems] = useState<ShiftItem[]>([])
  const [firearmItems, setFirearmItems] = useState<AllocationItem[]>([])
  const [permitItems, setPermitItems] = useState<PermitItem[]>([])
  const [ticketItems, setTicketItems] = useState<SupportTicketItem[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [scheduleForm, setScheduleForm] = useState({
    clientSite: '',
    date: '',
    startTime: '',
    endTime: ''
  })
  const [scheduleStatus, setScheduleStatus] = useState<string>('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState<boolean>(false)
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' })
  const [ticketStatus, setTicketStatus] = useState<string>('')
  const [ticketSubmitting, setTicketSubmitting] = useState<boolean>(false)
  const navItems = [
    { view: 'overview', label: 'Dashboard' },
    { view: 'calendar', label: 'Calendar' },
    { view: 'schedule', label: 'Schedule' },
    { view: 'firearms', label: 'Firearms' },
    { view: 'permits', label: 'My Permits' },
    { view: 'support', label: 'Contacts' }
  ]

  useEffect(() => {
    if (!user?.id) return
    fetchAttendance(user.id)
    fetchSchedule(user.id)
    fetchFirearms(user.id)
    fetchPermits(user.id)
    fetchTickets(user.id)
  }, [user?.id])

  const fetchAttendance = async (guardId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/${guardId}`)
      if (response.ok) {
        const data = await response.json()
        setAttendance(data.attendance || [])
      }
    } catch (err) {
      console.error('Error fetching attendance:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSchedule = async (guardId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/guard/${guardId}/shifts`)
      if (response.ok) {
        const data = await response.json()
        setScheduleItems(data.shifts || [])
      }
    } catch (err) {
      console.error('Error fetching schedule:', err)
    }
  }

  const fetchFirearms = async (guardId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/guard-allocations/${guardId}`)
      if (response.ok) {
        const data = await response.json()
        setFirearmItems(data.allocations || [])
      }
    } catch (err) {
      console.error('Error fetching firearms:', err)
    }
  }

  const fetchPermits = async (guardId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/guard-firearm-permits/${guardId}`)
      if (response.ok) {
        const data = await response.json()
        setPermitItems(data.permits || [])
      }
    } catch (err) {
      console.error('Error fetching permits:', err)
    }
  }

  const fetchTickets = async (guardId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/support-tickets/${guardId}`)
      if (response.ok) {
        const data = await response.json()
        setTicketItems(data.tickets || [])
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
    }
  }

  const isLicenseExpired = () => {
    if (!user?.license_expiry_date) return false
    return new Date(user.license_expiry_date) < new Date()
  }

  const daysUntilExpiry = () => {
    if (!user?.license_expiry_date) return null
    const days = Math.ceil((new Date(user.license_expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  const getStatusBadgeColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'present':
        return 'bg-green-100 text-green-800'
      case 'checked_in':
        return 'bg-blue-100 text-blue-800'
      case 'checked_out':
        return 'bg-green-100 text-green-800'
      case 'absent':
        return 'bg-red-100 text-red-800'
      case 'late':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatShiftTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  const calcHours = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return 0
    const start = new Date(checkIn).getTime()
    const end = new Date(checkOut).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) return 0
    return Math.max(0, (end - start) / (1000 * 60 * 60))
  }

  const handleScheduleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id) return

    if (!scheduleForm.clientSite || !scheduleForm.date || !scheduleForm.startTime || !scheduleForm.endTime) {
      setScheduleStatus('All fields are required.')
      return
    }

    const startLocal = new Date(`${scheduleForm.date}T${scheduleForm.startTime}`)
    const endLocal = new Date(`${scheduleForm.date}T${scheduleForm.endTime}`)

    if (Number.isNaN(startLocal.getTime()) || Number.isNaN(endLocal.getTime())) {
      setScheduleStatus('Invalid date or time.')
      return
    }

    if (endLocal <= startLocal) {
      setScheduleStatus('End time must be after start time.')
      return
    }

    setScheduleSubmitting(true)
    setScheduleStatus('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guard_id: user.id,
          start_time: startLocal.toISOString(),
          end_time: endLocal.toISOString(),
          client_site: scheduleForm.clientSite
        })
      })

      if (!response.ok) {
        const data = await response.json()
        setScheduleStatus(data.error || 'Failed to request schedule.')
        return
      }

      setScheduleStatus('Schedule request submitted.')
      setScheduleForm({ clientSite: '', date: '', startTime: '', endTime: '' })
      fetchSchedule(user.id)
    } catch (err) {
      setScheduleStatus(err instanceof Error ? err.message : 'Failed to request schedule.')
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const handleTicketSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id) return

    if (!ticketForm.subject || !ticketForm.message) {
      setTicketStatus('Subject and message are required.')
      return
    }

    setTicketSubmitting(true)
    setTicketStatus('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/support-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guard_id: user.id,
          subject: ticketForm.subject,
          message: ticketForm.message
        })
      })

      if (!response.ok) {
        const data = await response.json()
        setTicketStatus(data.error || 'Failed to create ticket.')
        return
      }

      setTicketStatus('Ticket submitted successfully.')
      setTicketForm({ subject: '', message: '' })
      fetchTickets(user.id)
    } catch (err) {
      setTicketStatus(err instanceof Error ? err.message : 'Failed to create ticket.')
    } finally {
      setTicketSubmitting(false)
    }
  }

  const handleNavigate = (section: 'overview' | 'schedule' | 'firearms' | 'permits' | 'support' | 'calendar') => {
    if (section === 'calendar') {
      onViewChange?.('calendar')
      return
    }
    setActiveSection(section as 'overview' | 'schedule' | 'firearms' | 'permits' | 'support')
  }

  const handleRefresh = async () => {
    if (!user?.id) return
    setLoading(true)
    await Promise.all([
      fetchAttendance(user.id),
      fetchSchedule(user.id),
      fetchFirearms(user.id),
      fetchPermits(user.id),
      fetchTickets(user.id)
    ])
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen w-screen bg-gray-100 font-sans">
      <Sidebar
        items={navItems}
        activeView={activeSection}
        onNavigate={(view) => handleNavigate(view as typeof activeSection)}
        onLogoClick={() => handleNavigate('overview')}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title={
            activeSection === 'overview' ? `Welcome, ${user?.username}` :
            activeSection === 'schedule' ? 'My Schedule' :
            activeSection === 'firearms' ? 'Assigned Firearms' :
            activeSection === 'permits' ? 'My Permits' :
            'Contact Support'
          }
          badgeLabel={activeSection === 'overview' ? 'Overview' : activeSection.replace('-', ' ')}
          onLogout={onLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined}
          rightSlot={
            <button
              onClick={handleRefresh}
              className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
          }
        />

        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
          <div className="space-y-8">
            {/* Profile Section */}
            {activeSection === 'overview' && (
              <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">My Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Full Name</label>
                  <p className="text-gray-800 font-medium">{user?.full_name || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Email</label>
                  <p className="text-gray-800 font-medium">{user?.email || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Phone</label>
                  <p className="text-gray-800 font-medium">{user?.phone_number || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="text-sm font-semibold text-gray-600 block mb-2">License Number</label>
                  <p className="text-gray-800 font-medium">{user?.license_number || 'N/A'}</p>
                </div>
              </div>
              </section>
            )}

            {/* License Status */}
            {activeSection === 'overview' && (
              <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">License Status</h2>
              <div className={`p-6 rounded-lg border-2 flex items-center justify-between ${
                isLicenseExpired()
                  ? 'bg-red-50 border-red-300'
                  : 'bg-green-50 border-green-300'
              }`}>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">License Expiry Date</p>
                  <p className="text-lg font-bold text-gray-800">
                    {user?.license_expiry_date
                      ? new Date(user.license_expiry_date).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div className={`px-6 py-3 rounded-lg text-center ${
                  isLicenseExpired()
                    ? 'bg-red-200 text-red-800'
                    : 'bg-green-200 text-green-800'
                }`}>
                  {isLicenseExpired() ? (
                    <>
                      <div className="text-2xl mb-1">⚠️</div>
                      <div className="font-bold">EXPIRED</div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl mb-1">✓</div>
                      <div className="font-bold">ACTIVE</div>
                      {daysUntilExpiry() !== null && (
                        <div className="text-sm mt-1">{daysUntilExpiry()} days left</div>
                      )}
                    </>
                  )}
                </div>
              </div>
              </section>
            )}

            {/* Attendance Section */}
            {activeSection === 'overview' && (
              <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">Recent Attendance</h2>
              {loading ? (
                <div className="text-center py-8 text-gray-600">Loading attendance records...</div>
              ) : attendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Date</th>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Check-In</th>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Check-Out</th>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Hours</th>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 5).map((record) => (
                        <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-gray-800">{new Date(record.check_in_time).toLocaleDateString()}</td>
                          <td className="px-6 py-3 text-gray-800">{new Date(record.check_in_time).toLocaleTimeString()}</td>
                          <td className="px-6 py-3 text-gray-800">{record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : '-'}</td>
                          <td className="px-6 py-3 text-gray-800">{calcHours(record.check_in_time, record.check_out_time).toFixed(1)} hrs</td>
                          <td className="px-6 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(record.status)}`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-600">No attendance records found</p>
              )}
              </section>
            )}

            {activeSection === 'schedule' && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">Shift Schedule</h2>
                <form className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleScheduleSubmit}>
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-gray-600 block mb-2">Client Site</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800"
                      placeholder="Site name"
                      value={scheduleForm.clientSite}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, clientSite: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 block mb-2">Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800"
                      value={scheduleForm.date}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, date: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 block mb-2">Start Time</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800"
                      value={scheduleForm.startTime}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, startTime: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 block mb-2">End Time</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800"
                      value={scheduleForm.endTime}
                      onChange={(event) => setScheduleForm((prev) => ({ ...prev, endTime: event.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-4 flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={scheduleSubmitting}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-70"
                    >
                      {scheduleSubmitting ? 'Submitting...' : 'Request Schedule'}
                    </button>
                    {scheduleStatus && (
                      <span className="text-sm font-semibold text-gray-700">{scheduleStatus}</span>
                    )}
                  </div>
                </form>
                {scheduleItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Site</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Date</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Time</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleItems.map((item) => (
                          <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 text-gray-800">{item.client_site}</td>
                            <td className="px-6 py-3 text-gray-800">{new Date(item.start_time).toLocaleDateString()}</td>
                            <td className="px-6 py-3 text-gray-800">{formatShiftTime(item.start_time, item.end_time)}</td>
                            <td className="px-6 py-3">
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-600">No shifts scheduled</p>
                )}
              </section>
            )}

            {activeSection === 'firearms' && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">Assigned Firearms</h2>
                {firearmItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Serial Number</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Model</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Caliber</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Status</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Allocated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {firearmItems.map((item) => (
                          <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 text-gray-800">{item.firearm_serial_number}</td>
                            <td className="px-6 py-3 text-gray-800">{item.firearm_model}</td>
                            <td className="px-6 py-3 text-gray-800">{item.firearm_caliber}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-gray-800">{new Date(item.allocation_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-600">No active allocations</p>
                )}
              </section>
            )}

            {activeSection === 'permits' && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">My Permits</h2>
                {permitItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Permit ID</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Type</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Issued</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Expiry</th>
                          <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permitItems.map((item) => (
                          <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 text-gray-800">{item.id}</td>
                            <td className="px-6 py-3 text-gray-800">{item.permit_type}</td>
                            <td className="px-6 py-3 text-gray-800">{new Date(item.issued_date).toLocaleDateString()}</td>
                            <td className="px-6 py-3 text-gray-800">{new Date(item.expiry_date).toLocaleDateString()}</td>
                            <td className="px-6 py-3">
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-600">No permits found</p>
                )}
              </section>
            )}

            {activeSection === 'support' && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">Contacts Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="rounded-lg border border-gray-200 p-5">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Operations Desk</h3>
                    <p className="text-sm text-gray-600 mb-3">24/7 support for urgent issues.</p>
                    <div className="text-sm text-gray-800">
                      <div>Phone: +63 912 345 6789</div>
                      <div>Email: ops@dasiaaio.com</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-5">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Site Supervisor</h3>
                    <p className="text-sm text-gray-600 mb-3">For on-site scheduling changes.</p>
                    <div className="text-sm text-gray-800">
                      <div>Phone: +63 901 234 5678</div>
                      <div>Email: supervisor@dasiaaio.com</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-5">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">HR and Compliance</h3>
                    <p className="text-sm text-gray-600 mb-3">Licensing and permit concerns.</p>
                    <div className="text-sm text-gray-800">
                      <div>Phone: +63 955 321 4567</div>
                      <div>Email: hr@dasiaaio.com</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-5">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Submit a Ticket</h3>
                    <p className="text-sm text-gray-600 mb-3">We will respond within 24 hours.</p>
                    <form className="space-y-3" onSubmit={handleTicketSubmit}>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800"
                        placeholder="Subject"
                        value={ticketForm.subject}
                        onChange={(event) => setTicketForm((prev) => ({ ...prev, subject: event.target.value }))}
                      />
                      <textarea
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800 min-h-[96px]"
                        placeholder="Message"
                        value={ticketForm.message}
                        onChange={(event) => setTicketForm((prev) => ({ ...prev, message: event.target.value }))}
                      />
                      <button
                        type="submit"
                        disabled={ticketSubmitting}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-70"
                      >
                        {ticketSubmitting ? 'Submitting...' : 'Create Ticket'}
                      </button>
                      {ticketStatus && (
                        <div className="text-sm font-semibold text-gray-700">{ticketStatus}</div>
                      )}
                    </form>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">My Tickets</h3>
                  {ticketItems.length > 0 ? (
                    <div className="space-y-3">
                      {ticketItems.map((ticket) => (
                        <div key={ticket.id} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-800">{ticket.subject}</h4>
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {ticket.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{ticket.message}</p>
                          <div className="text-xs text-gray-500">{new Date(ticket.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No tickets yet.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default UserDashboard
