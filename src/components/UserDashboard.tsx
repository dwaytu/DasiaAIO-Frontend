import { useState, useEffect, FC } from 'react'
import Logo from './Logo'
import { API_BASE_URL } from '../config'

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
  user: User
  onLogout: () => void
}

interface AttendanceRecord {
  id: string
  date: string
  checkIn: string
  checkOut: string
  hours: number
  status: string
}

const UserDashboard: FC<UserDashboardProps> = ({ user, onLogout }) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAttendance()
  }, [])

  const fetchAttendance = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance`)
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
      case 'absent':
        return 'bg-red-100 text-red-800'
      case 'late':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      <div className="flex-1">
        <header className="bg-white shadow-sm">
          <div className="flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-6">
              <Logo />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Welcome, {user?.username}</h1>
                <p className="text-sm text-gray-600">Guard</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-8">
          <div className="space-y-8">
            {/* Profile Section */}
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

            {/* License Status */}
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

            {/* Attendance Section */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">Recent Attendance</h2>
              {loading ? (
                <div className="text-center py-8 text-gray-600">Loading attendance records...</div>
              ) : attendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
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
                          <td className="px-6 py-3 text-gray-800">{new Date(record.date).toLocaleDateString()}</td>
                          <td className="px-6 py-3 text-gray-800">{record.checkIn}</td>
                          <td className="px-6 py-3 text-gray-800">{record.checkOut || '-'}</td>
                          <td className="px-6 py-3 text-gray-800">{record.hours.toFixed(1)} hrs</td>
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

            {/* Quick Actions */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">Quick Links</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <button className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 hover:shadow-md transition-shadow cursor-pointer">
                  <span className="text-3xl mb-2">📋</span>
                  <span className="text-sm font-semibold text-gray-800">Check Schedule</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200 hover:shadow-md transition-shadow cursor-pointer">
                  <span className="text-3xl mb-2">🔫</span>
                  <span className="text-sm font-semibold text-gray-800">View Firearms</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 hover:shadow-md transition-shadow cursor-pointer">
                  <span className="text-3xl mb-2">📜</span>
                  <span className="text-sm font-semibold text-gray-800">My Permits</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 hover:shadow-md transition-shadow cursor-pointer">
                  <span className="text-3xl mb-2">📞</span>
                  <span className="text-sm font-semibold text-gray-800">Contact Support</span>
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default UserDashboard
