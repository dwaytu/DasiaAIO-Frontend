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

export interface User {
  id: string
  email: string
  username: string
  role: 'superadmin' | 'admin' | 'supervisor' | 'guard' | 'user'
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
          setUser(parsedUser)
          setIsLoggedIn(true)
          console.log('Authentication restored from localStorage')
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
    const validRoles: Array<'superadmin' | 'admin' | 'supervisor' | 'guard' | 'user'> = ['superadmin', 'admin', 'supervisor', 'guard', 'user']
    if (!validRoles.includes(userData.role as 'superadmin' | 'admin' | 'supervisor' | 'guard' | 'user')) {
      console.error('Invalid role:', userData.role)
      return
    }
    const typedUser: User = {
      ...userData,
      role: userData.role as 'superadmin' | 'admin' | 'supervisor' | 'guard' | 'user'
    }
    console.log('Login successful:', typedUser)
    
    // Store user data in localStorage for persistence
    localStorage.setItem('user', JSON.stringify(typedUser))
    
    setUser(typedUser)
    setIsLoggedIn(true)
    setActiveView('users')
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

  console.log('App rendering, isLoggedIn:', isLoggedIn, 'user:', user, 'isLoading:', isLoading)

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
        <ProfileDashboard user={user!} onLogout={handleLogout} onBack={() => setActiveView('users')} onProfilePhotoUpdate={handleProfilePhotoUpdate} />
      ) : user?.role === 'superadmin' ? (
        activeView === 'calendar' ? (
          <CalendarDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'performance' ? (
          <PerformanceDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'merit' ? (
          <MeritScoreDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'firearms' ? (
          <FirearmInventory user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'allocation' ? (
          <FirearmAllocation user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'permits' ? (
          <GuardFirearmPermits user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'maintenance' ? (
          <FirearmMaintenance user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'armored-cars' ? (
          <ArmoredCarDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : (
          <SuperadminDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        )
      ) : user?.role === 'admin' || user?.role === 'supervisor' ? (
        activeView === 'calendar' ? (
          <CalendarDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'performance' ? (
          <PerformanceDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'merit' ? (
          <MeritScoreDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'firearms' ? (
          <FirearmInventory user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'allocation' ? (
          <FirearmAllocation user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'permits' ? (
          <GuardFirearmPermits user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'maintenance' ? (
          <FirearmMaintenance user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : activeView === 'armored-cars' ? (
          <ArmoredCarDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : (
          <SuperadminDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        )
      ) : user?.role === 'guard' || user?.role === 'user' ? (
        activeView === 'calendar' ? (
          <CalendarDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : (
          <UserDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        )
      ) : user ? (
        <UserDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
      ) : null}
    </div>
  )
}

export default App
