import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from './routes'

const GUARD_ALLOWED_PATHS = new Set([
  ROUTES.OVERVIEW,
  ROUTES.FEEDBACK,
  ROUTES.CALENDAR,
  ROUTES.INBOX,
  ROUTES.NOTIFICATIONS,
  ROUTES.PERMITS,
  ROUTES.PROFILE,
  ROUTES.SETTINGS,
  ROUTES.SUPPORT,
])

export function AuthGuard() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-full max-w-xl px-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 rounded bg-surface-elevated" />
            <div className="h-24 rounded bg-surface-elevated" />
            <div className="h-24 rounded bg-surface-elevated" />
          </div>
          <p className="mt-4 text-center text-sm text-text-secondary">
            Loading security operations workspace...
          </p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  return <Outlet />
}

export function RoleGuard({ roles }: { roles: string[] }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user || !roles.includes(user.role)) {
    // Guards get silent redirect to /overview instead of AccessDenied
    if (user?.role === 'guard') {
      return <Navigate to={ROUTES.OVERVIEW} replace />
    }
    return <AccessDenied />
  }

  // Extra safety: guard on a route not in their allowed set
  if (user.role === 'guard' && !GUARD_ALLOWED_PATHS.has(location.pathname as any)) {
    return <Navigate to={ROUTES.OVERVIEW} replace />
  }

  return <Outlet />
}

export function AccessDenied() {
  return (
    <main
      id="maincontent"
      className="flex h-full items-center justify-center p-4"
      tabIndex={-1}
    >
      <section className="w-full max-w-lg rounded border border-danger-border bg-surface p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-text-primary">Access Denied</h1>
        <p className="mt-3 text-sm text-text-secondary">
          You do not have permission to open this section. If this looks
          incorrect, contact a superadmin.
        </p>
      </section>
    </main>
  )
}
