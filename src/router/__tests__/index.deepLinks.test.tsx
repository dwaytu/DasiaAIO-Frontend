import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
  APP_VERSION: '1.0.0',
  APP_WHATS_NEW: '',
  LATEST_RELEASE_API_URL: '',
  RELEASE_DOWNLOAD_URL: '',
  detectRuntimePlatform: () => 'web',
}))

jest.mock('../../utils/api', () => ({
  getAuthToken: jest.fn(() => 'token'),
  getRefreshToken: jest.fn(() => 'refresh-token'),
}))

jest.mock('../../components/layout/AppShell', () => {
  return {
    __esModule: true,
    default: () => <Outlet />,
  }
})

jest.mock('../../components/admin/SuperadminDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="elevated-inbox">Elevated Inbox Experience</div>,
}))

jest.mock('../../components/guards/UserDashboard', () => ({
  __esModule: true,
  default: ({ activeView }: { activeView?: string }) => (
    <div data-testid="guard-dashboard-view">{activeView ?? 'none'}</div>
  ),
}))

import type { AuthContextValue } from '../../context/AuthContext'
import { AuthContext } from '../../context/AuthContext'
import { appRoutes } from '../index'
import { ROUTES } from '../routes'

function makeAuthValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    isLoggedIn: true,
    isLoading: false,
    hasAcceptedToa: true,
    toaChecked: true,
    toaError: '',
    login: jest.fn(),
    logout: jest.fn(async () => undefined),
    acceptToa: jest.fn(async () => true),
    declineToa: jest.fn(),
    setToaChecked: jest.fn(),
    setToaError: jest.fn(),
    ...overrides,
  }
}

function renderRoute(pathname: string, auth: AuthContextValue) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [pathname] })
  return render(
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

describe('router deep-link behavior', () => {
  it('renders guard inbox view for guard /inbox deep-link', async () => {
    renderRoute(
      ROUTES.INBOX,
      makeAuthValue({
        user: { id: 'guard-1', email: 'guard@example.test', username: 'guard', role: 'guard' },
      }),
    )

    expect(await screen.findByTestId('guard-dashboard-view')).toHaveTextContent('inbox')
  })

  it('renders guard support view for guard /support deep-link', async () => {
    renderRoute(
      ROUTES.SUPPORT,
      makeAuthValue({
        user: { id: 'guard-1', email: 'guard@example.test', username: 'guard', role: 'guard' },
      }),
    )

    expect(await screen.findByTestId('guard-dashboard-view')).toHaveTextContent('support')
  })

  it('renders elevated inbox experience for elevated /inbox deep-link', async () => {
    renderRoute(
      ROUTES.INBOX,
      makeAuthValue({
        user: { id: 'admin-1', email: 'admin@example.test', username: 'admin', role: 'admin' },
      }),
    )

    expect(await screen.findByTestId('elevated-inbox')).toBeInTheDocument()
  })

  it('redirects elevated /support deep-link to elevated inbox destination', async () => {
    renderRoute(
      ROUTES.SUPPORT,
      makeAuthValue({
        user: { id: 'admin-1', email: 'admin@example.test', username: 'admin', role: 'admin' },
      }),
    )

    expect(await screen.findByTestId('elevated-inbox')).toBeInTheDocument()
  })

  it('routes legacy /notifications deep-link to inbox destination for guards', async () => {
    renderRoute(
      ROUTES.NOTIFICATIONS,
      makeAuthValue({
        user: { id: 'guard-1', email: 'guard@example.test', username: 'guard', role: 'guard' },
      }),
    )

    expect(await screen.findByTestId('guard-dashboard-view')).toHaveTextContent('inbox')
  })
})
