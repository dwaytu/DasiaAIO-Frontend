import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import SuperadminDashboard from './components/SuperadminDashboard'
import UserDashboard from './components/UserDashboard'
import PerformanceDashboard from './components/PerformanceDashboard'
import FirearmInventory from './components/FirearmInventory'
import FirearmAllocation from './components/FirearmAllocation'
import GuardFirearmPermits from './components/GuardFirearmPermits'
import FirearmMaintenance from './components/FirearmMaintenance'
import ArmoredCarDashboard from './components/ArmoredCarDashboard'
import ProfileDashboard from './components/ProfileDashboard'
import MeritScoreDashboard from './components/MeritScoreDashboard'
import CalendarDashboard from './components/CalendarDashboard'
import { normalizeRole, isLegacyRole, Role } from './types/auth'
import { can, Permission } from './utils/permissions'

export interface User {
  id: string
  email: string
  username: string
  role: Role
  [key: string]: any
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [user, setUser] = useState<User | null>(null)
  const [activeView, setActiveView] = useState<string>('users')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Restore authentication from localStorage on component mount
  useEffect(() => {
    const restoreAuth = () => {
      try {
        const storedUser = localStorage.getItem('user')
        const storedToken = localStorage.getItem('token')
        
        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser)
          parsedUser.role = normalizeRole(parsedUser.role)
          setUser(parsedUser)
          setIsLoggedIn(true)
        }
      } catch (error) {
        console.error('Failed to restore authentication:', error)
        // Clear potentially corrupted data
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      } finally {
        setIsLoading(false)
      }
    }

    restoreAuth()
  }, [])

  const handleLogin = (userData: User) => {
    if (!isLegacyRole(userData.role)) {
      console.error('Invalid role:', userData.role)
      return
    }
    const typedUser: User = {
      ...userData,
      role: normalizeRole(userData.role)
    }

    // Store user data in localStorage for persistence
    localStorage.setItem('user', JSON.stringify(typedUser))
    
    setUser(typedUser)
    setIsLoggedIn(true)
    setActiveView(typedUser.role === 'guard' ? 'overview' : 'dashboard')
  }

  const handleLogout = () => {
    // Clear authentication from localStorage
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    
    setUser(null)
    setIsLoggedIn(false)
    setActiveView('users')
  }

  const handleProfilePhotoUpdate = (photoUrl: string) => {
    if (user) {
      setUser({
        ...user,
        profilePhoto: photoUrl
      })
    }
  }

  const normalizedRole = normalizeRole(user?.role)

  type ViewComponent = (props: {
    user: User
    onLogout: () => void
    onViewChange: (view: string) => void
    activeView: string
  }) => JSX.Element

  const viewRegistry: Record<string, { component: ViewComponent; permission?: Permission }> = {
    calendar: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <CalendarDashboard user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
    },
    performance: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <PerformanceDashboard user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'view_analytics',
    },
    merit: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <MeritScoreDashboard user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'view_analytics',
    },
    firearms: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <FirearmInventory user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_firearms',
    },
    allocation: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <FirearmAllocation user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_allocations',
    },
    permits: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <GuardFirearmPermits user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_permits',
    },
    maintenance: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <FirearmMaintenance user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_maintenance',
    },
    'armored-cars': {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <ArmoredCarDashboard user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_armored_cars',
    },
  }

  const getHomeView = (role: Role): string => {
    if (role === 'guard') {
      return 'overview'
    }
    return 'dashboard'
  }

  const canView = (view: string, role: Role): boolean => {
    const route = viewRegistry[view]
    if (!route || !route.permission) {
      return true
    }

    return can(role, route.permission)
  }

  const renderHome = (role: Role, currentUser: User): JSX.Element => {
    if (role === 'superadmin' || role === 'admin' || role === 'supervisor') {
      return (
        <SuperadminDashboard
          user={currentUser}
          onLogout={handleLogout}
          onViewChange={setActiveView}
          activeView={activeView}
        />
      )
    }

    return (
      <UserDashboard
        user={currentUser}
        onLogout={handleLogout}
        onViewChange={setActiveView}
        activeView={activeView}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="h-screen overflow-hidden w-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4" style={{ color: 'var(--text-primary)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : activeView === 'profile' ? (
        <ProfileDashboard user={user!} onLogout={handleLogout} onBack={() => setActiveView(getHomeView(normalizedRole))} onProfilePhotoUpdate={handleProfilePhotoUpdate} />
      ) : user ? (
        (() => {
          const desiredView = activeView
          const route = viewRegistry[desiredView]

          if (route && canView(desiredView, normalizedRole)) {
            return route.component({ user, onLogout: handleLogout, onViewChange: setActiveView, activeView })
          }

          return renderHome(normalizedRole, user)
        })()
      ) : null}
    </div>
  )
}

export default App
