import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Role } from '../../types/auth'
import { ROUTES } from '../routes'

// Mock config.ts which uses import.meta.env
jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
  APP_VERSION: '1.0.0',
  APP_WHATS_NEW: '',
  LATEST_RELEASE_API_URL: '',
  RELEASE_DOWNLOAD_URL: '',
  detectRuntimePlatform: () => 'web',
}))

// Mock api utils that depend on config
jest.mock('../../utils/api', () => ({
  clearAuthSession: jest.fn(),
  fetchJsonOrThrow: jest.fn(),
  getAuthToken: jest.fn(),
  getRefreshToken: jest.fn(),
  hydrateAuthSession: jest.fn(),
  isAuthTokenExpired: jest.fn(),
  refreshAuthSessionIfNeeded: jest.fn(),
  storeAuthSession: jest.fn(),
  getAuthHeaders: jest.fn(),
}))

import { AuthContext } from '../../context/AuthContext'
import type { AuthContextValue } from '../../context/AuthContext'
import { AuthGuard, RoleGuard } from '../guards'

function makeAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    isLoggedIn: false,
    isLoading: false,
    hasAcceptedToa: false,
    toaChecked: false,
    toaError: '',
    login: jest.fn(),
    logout: jest.fn(),
    acceptToa: jest.fn(),
    declineToa: jest.fn(),
    setToaChecked: jest.fn(),
    setToaError: jest.fn(),
    ...overrides,
  }
}

function renderWithRouter(auth: AuthContextValue, routes: Parameters<typeof createMemoryRouter>[0], initialEntries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries })
  return render(
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

describe('AuthGuard', () => {
  it('renders loading state when auth is loading', () => {
    const auth = makeAuthValue({ isLoading: true })
    renderWithRouter(auth, [
      {
        element: <AuthGuard />,
        children: [{ path: '/test', element: <div>Protected</div> }],
      },
      { path: ROUTES.LOGIN, element: <div>Login Page</div> },
    ], ['/test'])

    expect(screen.queryByText('Protected')).toBeNull()
    expect(screen.queryByText('Login Page')).toBeNull()
  })

  it('redirects to login when not authenticated', () => {
    const auth = makeAuthValue({ isLoggedIn: false, isLoading: false })
    renderWithRouter(auth, [
      {
        element: <AuthGuard />,
        children: [{ path: '/test', element: <div>Protected</div> }],
      },
      { path: ROUTES.LOGIN, element: <div>Login Page</div> },
    ], ['/test'])

    expect(screen.getByText('Login Page')).toBeTruthy()
  })

  it('renders children when authenticated', () => {
    const auth = makeAuthValue({
      isLoggedIn: true,
      isLoading: false,
      user: { id: '1', email: 'a@b.com', username: 'test', role: 'guard' as Role },
    })
    renderWithRouter(auth, [
      {
        element: <AuthGuard />,
        children: [{ path: '/test', element: <div>Protected</div> }],
      },
      { path: ROUTES.LOGIN, element: <div>Login Page</div> },
    ], ['/test'])

    expect(screen.getByText('Protected')).toBeTruthy()
  })
})

describe('RoleGuard', () => {
  it('redirects guards to overview when role is not in the allowed list', () => {
    const auth = makeAuthValue({
      isLoggedIn: true,
      isLoading: false,
      user: { id: '1', email: 'a@b.com', username: 'test', role: 'guard' as Role },
    })
    renderWithRouter(auth, [
      {
        element: <RoleGuard roles={['superadmin', 'admin']} />,
        children: [{ path: '/admin', element: <div>Admin Only</div> }],
      },
      { path: ROUTES.OVERVIEW, element: <div>Guard Overview</div> },
    ], ['/admin'])

    expect(screen.queryByText('Admin Only')).toBeNull()
    expect(screen.getByText('Guard Overview')).toBeTruthy()
  })

  it('renders children when role is allowed', () => {
    const auth = makeAuthValue({
      isLoggedIn: true,
      isLoading: false,
      user: { id: '1', email: 'a@b.com', username: 'admin1', role: 'admin' as Role },
    })
    renderWithRouter(auth, [
      {
        element: <RoleGuard roles={['superadmin', 'admin']} />,
        children: [{ path: '/admin', element: <div>Admin Only</div> }],
      },
    ], ['/admin'])

    expect(screen.getByText('Admin Only')).toBeTruthy()
  })

  it('renders access denied when user is null', () => {
    const auth = makeAuthValue({ isLoggedIn: true, isLoading: false, user: null })
    renderWithRouter(auth, [
      {
        element: <RoleGuard roles={['superadmin']} />,
        children: [{ path: '/admin', element: <div>Admin Only</div> }],
      },
    ], ['/admin'])

    expect(screen.getByText('Access Denied')).toBeTruthy()
  })

  it('allows guards to open inbox deep links', () => {
    const auth = makeAuthValue({
      isLoggedIn: true,
      isLoading: false,
      user: { id: '1', email: 'a@b.com', username: 'guard1', role: 'guard' as Role },
    })

    renderWithRouter(auth, [
      {
        element: <RoleGuard roles={['guard']} />,
        children: [{ path: ROUTES.INBOX, element: <div>Guard Inbox</div> }],
      },
    ], [ROUTES.INBOX])

    expect(screen.getByText('Guard Inbox')).toBeTruthy()
  })

  it('allows guards to open support deep links', () => {
    const auth = makeAuthValue({
      isLoggedIn: true,
      isLoading: false,
      user: { id: '1', email: 'a@b.com', username: 'guard1', role: 'guard' as Role },
    })

    renderWithRouter(auth, [
      {
        element: <RoleGuard roles={['guard']} />,
        children: [{ path: ROUTES.SUPPORT, element: <div>Guard Support</div> }],
      },
    ], [ROUTES.SUPPORT])

    expect(screen.getByText('Guard Support')).toBeTruthy()
  })

  it('allows guards to pass through legacy notifications route', () => {
    const auth = makeAuthValue({
      isLoggedIn: true,
      isLoading: false,
      user: { id: '1', email: 'a@b.com', username: 'guard1', role: 'guard' as Role },
    })

    renderWithRouter(auth, [
      {
        element: <RoleGuard roles={['guard']} />,
        children: [{ path: ROUTES.NOTIFICATIONS, element: <div>Legacy Notifications</div> }],
      },
    ], [ROUTES.NOTIFICATIONS])

    expect(screen.getByText('Legacy Notifications')).toBeTruthy()
  })

  it('redirects guard away from elevated-only routes such as armored cars', () => {
    const auth = makeAuthValue({
      isLoggedIn: true,
      isLoading: false,
      user: { id: '1', email: 'a@b.com', username: 'guard1', role: 'guard' as Role },
    })

    renderWithRouter(auth, [
      {
        element: <RoleGuard roles={['guard']} />,
        children: [{ path: ROUTES.ARMORED_CARS, element: <div>Armored Cars</div> }],
      },
      { path: ROUTES.OVERVIEW, element: <div>Guard Overview</div> },
    ], [ROUTES.ARMORED_CARS])

    expect(screen.queryByText('Armored Cars')).toBeNull()
    expect(screen.getByText('Guard Overview')).toBeTruthy()
  })
})
