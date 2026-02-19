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

interface AdminDashboardProps {
  user: User
  onLogout: () => void
}

const AdminDashboard: FC<AdminDashboardProps> = ({ onLogout }) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [editingUser, setEditingUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

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

  const handleLogout = () => {
    onLogout()
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
      <aside className="w-64 bg-gradient-to-b from-indigo-600 to-purple-900 text-white p-8 flex flex-col shadow-lg">
        <div className="pb-6 border-b border-white/20 mb-8">
          <Logo />
        </div>
        <nav className="flex-1 flex flex-col gap-2">
          <button 
            className="bg-white/30 hover:bg-white/20 text-white px-4 py-3 rounded-lg text-left font-medium transition-all duration-300 hover:translate-x-1 border-l-4 border-yellow-400 pl-3"
          >
            Dashboard
          </button>
        </nav>
        <button 
          onClick={handleLogout} 
          className="bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 text-white px-4 py-3 rounded-lg font-semibold mt-6 transition-colors"
        >
          Logout
        </button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="bg-white px-8 py-6 flex justify-between items-center shadow-sm border-b border-gray-200">
          <div className="flex items-center gap-6">
            <Logo />
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
          >
            Logout
          </button>
        </header>

        <div className="flex-1 p-8 overflow-y-auto w-full">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-red-800 font-medium">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-12 text-gray-600 font-medium">Loading users...</div>
          )}

          {!loading && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-200">Users</h2>
              {users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full">
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

          {editingUser && (
            <EditUserModal
              user={editingUser}
              onClose={() => setEditingUser(null)}
              onSave={handleSaveUser}
            />
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
