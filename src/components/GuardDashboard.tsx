import { FC } from 'react'
import BugReportButton from './BugReportButton'

interface User {
  [key: string]: any
}

interface GuardDashboardProps {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
}

const GuardDashboard: FC<GuardDashboardProps> = ({ user, onLogout }) => {
  return (
    <div className="flex min-h-screen bg-background font-sans">
      <div className="flex-1">
        <header className="bg-surface shadow-sm border-b border-border">
          <div className="flex items-center justify-between px-8 py-6">
            <h1 className="text-2xl font-bold text-text-primary">Guard Dashboard</h1>
            <button
              onClick={onLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="p-8">
          <h2 className="text-xl font-bold text-text-primary">Welcome, {user?.username}</h2>
          <BugReportButton userId={user?.id} />
        </main>
      </div>
    </div>
  )
}

export default GuardDashboard
