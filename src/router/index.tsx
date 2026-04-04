import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, useNavigate, useLocation } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { getAuthToken, getRefreshToken } from '../utils/api'
import { RoleGuard } from './guards'
import { ROUTES, VIEW_TO_ROUTE } from './routes'
import AppShell from '../components/layout/AppShell'

const LoginPage = lazy(() => import('../components/LoginPage'))
const SuperadminDashboard = lazy(() => import('../components/admin/SuperadminDashboard'))
const UserDashboard = lazy(() => import('../components/guards/UserDashboard'))
const CalendarDashboard = lazy(() => import('../components/CalendarDashboard'))
const PerformanceDashboard = lazy(() => import('../components/PerformanceDashboard'))
const MeritScoreDashboard = lazy(() => import('../components/MeritScoreDashboard'))
const FirearmInventory = lazy(() => import('../components/FirearmInventory'))
const FirearmAllocation = lazy(() => import('../components/FirearmAllocation'))
const GuardFirearmPermits = lazy(() => import('../components/GuardFirearmPermits'))
const FirearmMaintenance = lazy(() => import('../components/FirearmMaintenance'))
const ArmoredCarDashboard = lazy(() => import('../components/ArmoredCarDashboard'))
const ProfileDashboard = lazy(() => import('../components/ProfileDashboard'))
const SettingsView = lazy(() => import('../components/settings/SettingsView'))
const AnalyticsDashboard = lazy(() => import('../components/AnalyticsDashboard'))
const AuditDashboard = lazy(() => import('../components/AuditDashboard'))

function LazyFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-xl px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded-lg bg-surface-elevated" />
          <div className="h-24 rounded-lg bg-surface-elevated" />
          <div className="h-24 rounded-lg bg-surface-elevated" />
        </div>
      </div>
    </div>
  )
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LazyFallback />}>{children}</Suspense>
}

// Bridge: extracts auth state and converts legacy onViewChange to navigate()
function useLegacyProps() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const activeView = location.pathname.replace(/^\//, '') || 'dashboard'
  const onViewChange = (view: string) => {
    const route = VIEW_TO_ROUTE[view] || `/${view}`
    navigate(route)
  }
  return { user, onLogout: logout, onViewChange, activeView }
}

// --- Per-component wrappers that bridge AuthContext → legacy props ---

function LoginWrapper() {
  const { login } = useAuth()
  const navigate = useNavigate()
  return (
    <SuspenseWrapper>
      <LoginPage onLogin={(userData) => {
        // LoginPage already stores tokens via storeAuthSession() before calling onLogin
        const accessToken = getAuthToken() || ''
        const refreshToken = getRefreshToken() || ''
        login(userData, accessToken, refreshToken)
        // Navigate to role-appropriate home after login
        const target = userData.role === 'guard' ? ROUTES.OVERVIEW : ROUTES.DASHBOARD
        navigate(target, { replace: true })
      }} />
    </SuspenseWrapper>
  )
}

function LegacyPage({ Component }: { Component: ComponentType<any> }) {
  const props = useLegacyProps()
  if (!props.user) return null
  return <SuspenseWrapper><Component {...props} /></SuspenseWrapper>
}

function ProfileWrapper() {
  const { user, onLogout } = useLegacyProps()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <SuspenseWrapper>
      <ProfileDashboard
        user={user}
        onLogout={onLogout}
        onBack={() => navigate(user.role === 'guard' ? ROUTES.OVERVIEW : ROUTES.DASHBOARD)}
      />
    </SuspenseWrapper>
  )
}

const ELEVATED_ROLES = ['superadmin', 'admin', 'supervisor']
const ALL_ROLES = ['superadmin', 'admin', 'supervisor', 'guard']
const SUPERADMIN_ONLY = ['superadmin']
const GUARD_ONLY = ['guard']

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },

  {
    path: ROUTES.LOGIN,
    element: <LoginWrapper />,
  },

  // Authenticated routes (AppShell handles auth guard + ToA + global overlays)
  {
    element: <AppShell />,
    children: [
      // Admin/Supervisor home
      {
        element: <RoleGuard roles={ELEVATED_ROLES} />,
        children: [
          { path: ROUTES.DASHBOARD, element: <LegacyPage Component={SuperadminDashboard} /> },
          { path: ROUTES.APPROVALS, element: <LegacyPage Component={SuperadminDashboard} /> },
          { path: ROUTES.SCHEDULE, element: <LegacyPage Component={SuperadminDashboard} /> },
          { path: ROUTES.MISSIONS, element: <LegacyPage Component={SuperadminDashboard} /> },
          { path: ROUTES.TRIPS, element: <LegacyPage Component={SuperadminDashboard} /> },
        ],
      },

      // Guard home
      {
        element: <RoleGuard roles={GUARD_ONLY} />,
        children: [
          { path: ROUTES.OVERVIEW, element: <LegacyPage Component={UserDashboard} /> },
        ],
      },

      // All authenticated roles
      {
        element: <RoleGuard roles={ALL_ROLES} />,
        children: [
          { path: ROUTES.CALENDAR, element: <LegacyPage Component={CalendarDashboard} /> },
          { path: ROUTES.PERMITS, element: <LegacyPage Component={GuardFirearmPermits} /> },
          { path: ROUTES.ARMORED_CARS, element: <LegacyPage Component={ArmoredCarDashboard} /> },
          { path: ROUTES.PROFILE, element: <ProfileWrapper /> },
          { path: ROUTES.SETTINGS, element: <LegacyPage Component={SettingsView} /> },
          { path: ROUTES.SHIFT_SWAPS, element: <div>Shift Swaps</div> },
          { path: ROUTES.NOTIFICATIONS, element: <div>Notifications</div> },
          { path: ROUTES.SUPPORT, element: <div>Support</div> },
          { path: ROUTES.INBOX, element: <LegacyPage Component={SuperadminDashboard} /> },
        ],
      },

      // Elevated roles — manage firearms, analytics
      {
        element: <RoleGuard roles={ELEVATED_ROLES} />,
        children: [
          { path: ROUTES.PERFORMANCE, element: <LegacyPage Component={PerformanceDashboard} /> },
          { path: ROUTES.MERIT, element: <LegacyPage Component={MeritScoreDashboard} /> },
          { path: ROUTES.FIREARMS, element: <LegacyPage Component={FirearmInventory} /> },
          { path: ROUTES.ALLOCATION, element: <LegacyPage Component={FirearmAllocation} /> },
          { path: ROUTES.MAINTENANCE, element: <LegacyPage Component={FirearmMaintenance} /> },
          { path: ROUTES.ANALYTICS, element: <SuspenseWrapper><AnalyticsDashboard /></SuspenseWrapper> },
        ],
      },

      // Superadmin only — audit
      {
        element: <RoleGuard roles={SUPERADMIN_ONLY} />,
        children: [
          { path: ROUTES.AUDIT, element: <SuspenseWrapper><AuditDashboard /></SuspenseWrapper> },
        ],
      },

      // Catch-all
      { path: '*', element: <Navigate to={ROUTES.DASHBOARD} replace /> },
    ],
  },
])
