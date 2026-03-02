import { useState } from 'react'
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
  role: 'admin' | 'superadmin' | 'user' | 'guard'
  [key: string]: any
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [user, setUser] = useState<User | null>(null)
  const [activeView, setActiveView] = useState<string>('users')

  const handleLogin = (userData: User) => {
    const validRoles: Array<'admin' | 'superadmin' | 'user' | 'guard'> = ['admin', 'superadmin', 'user', 'guard']
    if (!validRoles.includes(userData.role as 'admin' | 'superadmin' | 'user' | 'guard')) {
      console.error('Invalid role:', userData.role)
      return
    }
    const typedUser: User = {
      ...userData,
      role: userData.role as 'admin' | 'superadmin' | 'user' | 'guard'
    }
    console.log('Login successful:', typedUser)
    setUser(typedUser)
    setIsLoggedIn(true)
    setActiveView('users')
  }

  const handleLogout = () => {
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

  console.log('App rendering, isLoggedIn:', isLoggedIn, 'user:', user)

  return (
    <div className="h-screen overflow-hidden w-full">
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : activeView === 'profile' ? (
        <ProfileDashboard user={user!} onLogout={handleLogout} onBack={() => setActiveView('users')} onProfilePhotoUpdate={handleProfilePhotoUpdate} />
      ) : user?.role === 'admin' ? (
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
      ) : user ? (
        activeView === 'calendar' ? (
          <CalendarDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        ) : (
          <UserDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} activeView={activeView} />
        )
      ) : null}
    </div>
  )
}

export default App
