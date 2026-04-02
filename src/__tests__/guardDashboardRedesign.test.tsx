import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserDashboard from '../components/guards/UserDashboard'
import GuardResourcesTab from '../components/dashboard/GuardResourcesTab'
import GuardMapTab from '../components/dashboard/GuardMapTab'
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

async function defaultApiMock(url: string) {
  if (url.includes('/attendance/')) return { attendance: [] }
  if (url.includes('/guard-replacement/guard/')) {
    return {
      shifts: [
        {
          id: 'shift-1',
          client_site: 'North Gate',
          start_time: '2026-04-03T08:00:00.000Z',
          end_time: '2026-04-03T16:00:00.000Z',
          status: 'active',
        },
      ],
    }
  }
  if (url.includes('/guard-allocations/')) return { allocations: [] }
  if (url.includes('/guard-firearm-permits/')) return { permits: [] }
  if (url.includes('/support-tickets/')) return { tickets: [] }
  if (url.includes('/api/shifts/swap-requests')) return { swapRequests: [] }
  if (url.includes('/api/guard-replacement/availability/')) return { available: true }
  return []
}

function renderGuardDashboard(activeView = 'mission', onViewChange = jest.fn()) {
  return render(
    <ThemeProvider>
      <UserDashboard user={testUser} onLogout={jest.fn()} activeView={activeView} onViewChange={onViewChange} />
    </ThemeProvider>,
  )
}

describe('guard dashboard redesign tranche', () => {
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

  it('uses a single sticky bottom region for guard actions and navigation', async () => {
    renderGuardDashboard('mission')

    const stickyRegion = await screen.findByTestId('guard-sticky-region')
    expect(stickyRegion).toBeInTheDocument()
    expect(within(stickyRegion).getByRole('button', { name: /report incident/i })).toBeInTheDocument()
    expect(within(stickyRegion).getByRole('button', { name: /mission/i })).toBeInTheDocument()
  })

  it('renders resources in a summary-first hierarchy', () => {
    render(
      <GuardResourcesTab
        firearmItems={[
          {
            id: 'f-1',
            firearm_id: 'firearm-1',
            firearm_model: 'Glock 17',
            firearm_caliber: '9mm',
            firearm_serial_number: 'SN-001',
            allocation_date: '2026-03-01T00:00:00.000Z',
            status: 'active',
          },
        ]}
        permitItems={[
          {
            id: 'p-1',
            permit_type: 'Carry Permit',
            issued_date: '2026-01-01T00:00:00.000Z',
            expiry_date: '2026-12-01T00:00:00.000Z',
            status: 'active',
          },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: /resource snapshot/i })).toBeInTheDocument()
    expect(screen.getByText(/allocated firearms/i)).toBeInTheDocument()
    expect(screen.getByText(/active permits/i)).toBeInTheDocument()
  })

  it('shows map status context before expansion controls', () => {
    render(
      <GuardMapTab
        mapExpanded={false}
        onToggleExpand={jest.fn()}
        mapEmbedUrl={null}
        mapExternalUrl={null}
        lastKnownLocation={{
          latitude: 14.5995,
          longitude: 120.9842,
          accuracyMeters: 10,
          recordedAt: '2026-04-03T08:30:00.000Z',
          source: 'gps',
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: /location status/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand live map/i })).toBeInTheDocument()
  })

  it('decompresses support workspace into clear grouped cards', async () => {
    renderGuardDashboard('support')

    expect(await screen.findByRole('heading', { name: /field instructions/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /schedule change requests/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /support tickets/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /shift swaps/i })).toBeInTheDocument()
  })

  it('uses a schedule-based shift select and keeps manual target-guard fallback', async () => {
    renderGuardDashboard('support')

    expect(await screen.findByLabelText(/scheduled shift/i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /north gate/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/target guard id/i)).toBeInTheDocument()
  })

  it('opens profile inline without leaving the mission shell and closes with escape', async () => {
    const user = userEvent.setup()
    const onViewChange = jest.fn()

    renderGuardDashboard('mission', onViewChange)

    const profileButton = await screen.findByRole('button', { name: 'Profile' })
    await user.click(profileButton)

    expect(onViewChange).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: /mission screen/i })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /guard profile settings/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /guard profile settings/i })).not.toBeInTheDocument()
    })

    expect(document.activeElement).toBe(profileButton)
  })

  it('saves profile changes from the inline profile modal', async () => {
    const user = userEvent.setup()

    mockFetchJsonOrThrow.mockImplementation(async (url: string) => {
      if (url.endsWith(`/api/user/${testUser.id}`)) {
        return {}
      }

      return defaultApiMock(url)
    })

    renderGuardDashboard('mission')

    await user.click(await screen.findByRole('button', { name: 'Profile' }))
    const fullNameInput = await screen.findByLabelText(/full name/i)
    await user.clear(fullNameInput)
    await user.type(fullNameInput, 'Guard One Updated')
    await user.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument()
    })
  })

  it('toggles the guard dashboard theme from the header and persists the selection', async () => {
    const user = userEvent.setup()

    renderGuardDashboard('mission')

    const toggle = await screen.findByRole('button', { name: /switch to light mode/i })
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await user.click(toggle)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })
    expect(localStorage.getItem('sentinel-theme')).toBe('light')
  })

  it('shows shift swap request errors to the user', async () => {
    const user = userEvent.setup()

    mockFetchJsonOrThrow.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/shifts/swap-request')) {
        throw new Error('Shift swap request is invalid.')
      }

      return defaultApiMock(url)
    })

    renderGuardDashboard('support')

    await user.selectOptions(await screen.findByLabelText(/scheduled shift/i), 'shift-1')
    await user.type(screen.getByLabelText(/target guard id/i), 'guard-2')
    await user.click(screen.getByRole('button', { name: /request swap/i }))

    await waitFor(() => {
      expect(screen.getByText(/shift swap request is invalid/i)).toBeInTheDocument()
    })
  })

  it('shows support form errors instead of failing silently', async () => {
    const user = userEvent.setup()

    mockFetchJsonOrThrow.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/support-tickets')) {
        throw new Error('Unable to submit support ticket.')
      }

      return defaultApiMock(url)
    })

    renderGuardDashboard('support')

    await user.type(await screen.findByLabelText(/subject/i), 'Need support')
    await user.type(screen.getByLabelText(/message/i), 'Something failed during my shift.')
    await user.click(screen.getByRole('button', { name: /create ticket/i }))

    await waitFor(() => {
      expect(screen.getByText(/unable to submit support ticket/i)).toBeInTheDocument()
    })
  })

  it('closes the inline profile modal from its close button', async () => {
    const user = userEvent.setup()

    renderGuardDashboard('mission')

    await user.click(await screen.findByRole('button', { name: 'Profile' }))
    await user.click(screen.getByRole('button', { name: /close profile/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /guard profile settings/i })).not.toBeInTheDocument()
    })
  })

  it('closes the inline profile modal with its back action', async () => {
    const user = userEvent.setup()

    renderGuardDashboard('mission')

    await user.click(await screen.findByRole('button', { name: 'Profile' }))
    await user.click(screen.getByRole('button', { name: /back to mission shell/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /guard profile settings/i })).not.toBeInTheDocument()
    })
  })
})
