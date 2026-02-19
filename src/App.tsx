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

  console.log('App rendering, isLoggedIn:', isLoggedIn, 'user:', user)

  return (
    <div className="app" style={{ minHeight: '100vh', width: '100%' }}>
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : user?.role === 'admin' ? (
        activeView === 'performance' ? (
          <PerformanceDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'firearms' ? (
          <FirearmInventory user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'allocation' ? (
          <FirearmAllocation user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'permits' ? (
          <GuardFirearmPermits user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'maintenance' ? (
          <FirearmMaintenance user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'armored-cars' ? (
          <ArmoredCarDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : (
          <SuperadminDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        )
      ) : user?.role === 'superadmin' ? (
        activeView === 'performance' ? (
          <PerformanceDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'firearms' ? (
          <FirearmInventory user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'allocation' ? (
          <FirearmAllocation user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'permits' ? (
          <GuardFirearmPermits user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'maintenance' ? (
          <FirearmMaintenance user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : activeView === 'armored-cars' ? (
          <ArmoredCarDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        ) : (
          <SuperadminDashboard user={user} onLogout={handleLogout} onViewChange={setActiveView} />
        )
      ) : user ? (
        <UserDashboard user={user} onLogout={handleLogout} />
      ) : null}
    </div>
  )
}

export default App
