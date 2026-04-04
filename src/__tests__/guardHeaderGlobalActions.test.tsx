import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserDashboard from '../components/guards/UserDashboard'
import { ThemeProvider } from '../context/ThemeProvider'

jest.mock('../config', () => ({
  API_BASE_URL: 'https://example.test',
  detectRuntimePlatform: () => 'web',
}))

jest.mock('../utils/logger', () => ({
  logError: jest.fn(),
}))

jest.mock('../utils/trackingPolicy', () => ({
  getRequiredAccuracyMeters: () => 50,
  getTrackingAccuracyMode: () => 'balanced',
}))

jest.mock('../utils/location', () => ({
  LOCATION_TRACKING_TOGGLE_KEY: 'tracking-toggle',
  getLocationPermissionState: async () => 'granted',
  hasAcceptedLocationConsent: () => true,
  requestRuntimeLocationPermission: async () => 'granted',
  resolveLocationWithFallback: async () => ({
    latitude: 14.5995,
    longitude: 120.9842,
    accuracyMeters: 12,
    source: 'gps',
  }),
}))

jest.mock('../utils/pushNotifications', () => ({
  registerServiceWorker: jest.fn(async () => undefined),
  requestPushPermission: jest.fn(async () => false),
  subscribeToPush: jest.fn(async () => false),
  unsubscribeFromPush: jest.fn(async () => undefined),
}))

const mockFetchJsonOrThrow = jest.fn()

jest.mock('../utils/api', () => ({
  fetchJsonOrThrow: (...args: unknown[]) => mockFetchJsonOrThrow(...args),
  getAuthToken: () => 'token',
  getAuthHeaders: (extraHeaders: Record<string, string> = {}) => ({
    Authorization: 'Bearer token',
    ...extraHeaders,
  }),
}))

const testUser = {
  id: 'guard-1',
  email: 'guard@example.test',
  username: 'guard1',
  role: 'guard' as const,
  fullName: 'Guard One',
}

function buildIsoOffset(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString()
}

async function defaultApiMock(url: string) {
  if (url.includes('/attendance/')) return { attendance: [] }
  if (url.includes('/guard-replacement/guard/')) {
    return {
      shifts: [
        {
          id: 'shift-1',
          client_site: 'North Gate',
          start_time: buildIsoOffset(-1),
          end_time: buildIsoOffset(7),
          status: 'active',
        },
      ],
    }
  }
  if (url.includes('/guard-allocations/')) return { allocations: [] }
  if (url.includes('/guard-firearm-permits/')) return { permits: [] }
  if (url.includes('/support-tickets/')) return { tickets: [] }
  if (url.includes('/users/guard-1/notifications')) {
    return {
      notifications: [
        {
          id: 'notif-1',
          title: 'Relief update',
          message: 'Relief guard confirmed for North Gate.',
          type: 'shift',
          created_at: new Date().toISOString(),
          is_read: false,
        },
      ],
      unreadCount: 1,
    }
  }
  return []
}

function renderGuardDashboard(activeView = 'mission', onViewChange = jest.fn(), onLogout = jest.fn()) {
  return render(
    <ThemeProvider>
      <UserDashboard user={testUser} onLogout={onLogout} activeView={activeView} onViewChange={onViewChange} />
    </ThemeProvider>,
  )
}

describe('guard header global actions', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'fetch', {
      writable: true,
      value: jest.fn(),
    })
  })

  beforeEach(() => {
    localStorage.setItem('sentinel-theme', 'dark')
    mockFetchJsonOrThrow.mockImplementation(defaultApiMock)

    ;(globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ swapRequests: [] }),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('opens a compact quick inbox from the header and keeps the inbox fallback route available', async () => {
    const user = userEvent.setup()
    const onViewChange = jest.fn()

    renderGuardDashboard('mission', onViewChange)

    await user.click(await screen.findByRole('button', { name: /open quick inbox/i }))

    const quickInbox = await screen.findByRole('dialog', { name: /quick inbox/i })
    expect(quickInbox).toBeInTheDocument()
    expect(quickInbox).toHaveTextContent(/relief update|upcoming shift/i)

    await user.click(screen.getByRole('button', { name: /view full inbox/i }))

    expect(onViewChange).toHaveBeenCalledWith('inbox')
  })

  it('opens settings as an overlay without leaving the current guard section', async () => {
    const user = userEvent.setup()
    const onViewChange = jest.fn()

    renderGuardDashboard('mission', onViewChange)

    await user.click(await screen.findByRole('button', { name: /open settings/i }))

    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /guard settings/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /mission screen/i })).toBeInTheDocument()
    expect(onViewChange).not.toHaveBeenCalledWith('settings')
  })

  it('opens a profile dropdown with identity summary, profile entry, and logout action', async () => {
    const user = userEvent.setup()
    const onViewChange = jest.fn()
    const onLogout = jest.fn()

    renderGuardDashboard('mission', onViewChange, onLogout)

    await user.click(await screen.findByRole('button', { name: /open profile menu/i }))

    const profileMenu = await screen.findByRole('dialog', { name: /profile menu/i })
    expect(profileMenu).toHaveTextContent('Guard One')
    expect(profileMenu).toHaveTextContent(/guard/i)

    await user.click(screen.getByRole('button', { name: /my profile/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /guard profile settings/i })).toBeInTheDocument()
    })

    await user.click(await screen.findByRole('button', { name: /open profile menu/i }))
    await user.click(screen.getByRole('button', { name: /^logout$/i }))

    expect(onLogout).toHaveBeenCalled()
  })
})