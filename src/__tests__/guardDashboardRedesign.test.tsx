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

jest.mock('../hooks/useUI', () => ({
  useUI: () => ({
    isNetworkOnline: true,
  }),
}))

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    updateUser: jest.fn(),
  }),
}))

jest.mock('../hooks/useLocationConsent', () => ({
  useLocationConsent: () => ({
    hasLocationConsent: true,
    locationConsentChecked: true,
    consentActionPending: false,
    consentSyncError: '',
    geoPermissionState: 'granted',
    locationHeartbeatStatus: 'active',
    geoNotice: '',
    lastResolvedLocation: null,
    lastHeartbeatAt: null,
    lastHeartbeatApproximate: false,
    locationBannerDismissed: false,
    grantLocationConsent: async () => true,
    denyLocationConsent: async () => true,
    refreshTrackingConsent: async () => undefined,
    dismissLocationBanner: () => undefined,
    requestGeoPermission: async () => undefined,
    retryLocationHeartbeat: async () => undefined,
  }),
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

async function openGuardProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /open profile menu/i }))
  await user.click(await screen.findByRole('button', { name: /my profile/i }))
}

describe('guard dashboard redesign tranche', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'fetch', {
      writable: true,
      value: jest.fn(),
    })
  })

  beforeEach(() => {
    localStorage.clear()
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
    expect(within(stickyRegion).getByRole('button', { name: /mission/i })).toBeInTheDocument()
    expect(within(stickyRegion).getByRole('navigation', { name: /guard primary navigation/i })).toBeInTheDocument()
  })

  it('surfaces an immediate mission action with clear current-watch guidance', async () => {
    renderGuardDashboard('mission')

    expect(await screen.findByRole('heading', { name: /mission/i })).toBeInTheDocument()
    expect(screen.getByText(/awaiting check in/i)).toBeInTheDocument()
    expect(screen.getAllByText(/north gate/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/tracking and sync are ready for this watch/i)).toBeInTheDocument()
  })

  it('keeps the current shift action authoritative while preserving compact emergency access', async () => {
    renderGuardDashboard('mission')

    expect(await screen.findByText(/use mission action above/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^check in$/i })).not.toBeInTheDocument()
    expect(screen.getByText('Tracking details')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: /emergency contacts/i })).getAllByRole('link')).toHaveLength(4)
  })

  it('provides an optional local-first quick guide without hiding SOS access', async () => {
    const user = userEvent.setup()
    renderGuardDashboard('mission')

    expect(await screen.findByRole('heading', { name: /check in starts a routine shift/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /emergency sos/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/step 2 of 5/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip guide' }))
    expect(screen.queryByRole('heading', { name: /use inbox for operational updates/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open quick guide' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Open quick guide' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Open quick guide' })).toHaveFocus()
  })

  it('renders resources in a summary-first hierarchy', () => {
    render(
      <GuardResourcesTab
        firearmItems={[
          {
            id: 'f-1',
            firearmId: 'firearm-1',
            firearmModel: 'Glock 17',
            firearmCaliber: '9mm',
            firearmSerialNumber: 'SN-001',
            allocationDate: '2026-03-01T00:00:00.000Z',
            status: 'active',
          },
        ]}
        permitItems={[
          {
            id: 'p-1',
            permitType: 'Carry Permit',
            issuedDate: '2026-01-01T00:00:00.000Z',
            expiryDate: '2026-12-01T00:00:00.000Z',
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

    expect(screen.getByRole('heading', { name: /live map/i })).toBeInTheDocument()
    expect(screen.getByText(/tracking status unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/location not active/i)).toBeInTheDocument()
  })

  it('renders the current support ticket workspace', async () => {
    renderGuardDashboard('support')

    expect(await screen.findByRole('heading', { name: /support tickets/i })).toBeInTheDocument()
    expect(screen.getByText(/submit and track support requests/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new ticket/i })).toBeInTheDocument()
  })

  it('opens the create ticket form from the support workspace', async () => {
    const user = userEvent.setup()
    renderGuardDashboard('support')

    await user.click(await screen.findByRole('button', { name: /new ticket/i }))

    expect(await screen.findByRole('heading', { name: /create support ticket/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
  })

  it('shows a retry state when support tickets fail to load', async () => {
    mockFetchJsonOrThrow.mockImplementation(async (url: string) => {
      if (url.includes('/support-tickets/')) {
        throw new Error('Unable to load support tickets')
      }

      return defaultApiMock(url)
    })

    renderGuardDashboard('support')

    expect(await screen.findByText(/unable to load support tickets/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('guides the guard when no support tickets exist yet', async () => {
    renderGuardDashboard('support')

    expect(await screen.findByText(/no support tickets/i)).toBeInTheDocument()
    expect(screen.getByText(/need help\? create a ticket below/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create ticket/i })).toBeInTheDocument()
  })

  it('keeps the inbox usable when swap request updates are unavailable', async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 501,
      json: async () => ({ message: 'Not implemented' }),
    })

    renderGuardDashboard('inbox')

    expect(await screen.findByText(/inbox is showing other mission activity only/i)).toBeInTheDocument()
    expect(screen.queryByText(/unable to load inbox data/i)).not.toBeInTheDocument()
  })

  it('opens profile inline without leaving the mission shell and closes with escape', async () => {
    const user = userEvent.setup()
    const onViewChange = jest.fn()

    renderGuardDashboard('mission', onViewChange)

    const profileButton = await screen.findByRole('button', { name: /open profile menu/i })
    await openGuardProfile(user)

    expect(onViewChange).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: /mission/i })).toBeInTheDocument()
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

    await openGuardProfile(user)
    const fullNameInput = await screen.findByLabelText(/full name/i)
    await user.clear(fullNameInput)
    await user.type(fullNameInput, 'Guard One Updated')
    await user.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument()
    })
  })

  it('keeps the theme toggle out of the guard header controls', async () => {
    renderGuardDashboard('mission')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await screen.findByRole('heading', { name: /mission/i })
    expect(screen.queryByRole('button', { name: /switch to light mode/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /switch to dark mode/i })).not.toBeInTheDocument()
  })

  it('shows support ticket validation errors to the user', async () => {
    const user = userEvent.setup()

    renderGuardDashboard('support')

    await user.click(await screen.findByRole('button', { name: /new ticket/i }))
    await user.click(screen.getByRole('button', { name: /submit ticket/i }))

    await waitFor(() => {
      expect(screen.getByText(/please select a category/i)).toBeInTheDocument()
      expect(screen.getByText(/subject is required/i)).toBeInTheDocument()
      expect(screen.getByText(/description must be at least 10 characters/i)).toBeInTheDocument()
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

    await user.click(await screen.findByRole('button', { name: /new ticket/i }))
    await user.selectOptions(await screen.findByLabelText(/category/i), 'Equipment')
    await user.type(screen.getByLabelText(/subject/i), 'Need support')
    await user.type(screen.getByLabelText(/description/i), 'Something failed during my shift.')
    await user.click(screen.getByRole('button', { name: /submit ticket/i }))

    await waitFor(() => {
      expect(screen.getByText(/unable to submit support ticket/i)).toBeInTheDocument()
    })
  })

  it('closes the inline profile modal from its close button', async () => {
    const user = userEvent.setup()

    renderGuardDashboard('mission')

    await openGuardProfile(user)
    await user.click(screen.getByRole('button', { name: /close profile/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /guard profile settings/i })).not.toBeInTheDocument()
    })
  })

  it('closes the inline profile modal with its back action', async () => {
    const user = userEvent.setup()

    renderGuardDashboard('mission')

    await openGuardProfile(user)
    await user.click(screen.getByRole('button', { name: /back to mission shell/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /guard profile settings/i })).not.toBeInTheDocument()
    })
  })

  it('keeps incident reporting finger-friendly, focus-contained, and safely dismissible', async () => {
    const user = userEvent.setup()
    renderGuardDashboard('mission')

    const trigger = (await screen.findAllByRole('button', { name: /report incident/i }))[0]
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: /report incident/i })
    expect(dialog).toHaveClass('rounded-t-xl', 'sm:rounded-xl', 'overflow-y-auto')
    const highPriority = screen.getByRole('button', { name: 'high' })
    expect(highPriority).toHaveAttribute('aria-pressed', 'true')
    expect(highPriority).toHaveClass('min-h-11')
    await user.click(screen.getByRole('button', { name: 'low' }))
    expect(screen.getByRole('button', { name: 'low' })).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /report incident/i })).not.toBeInTheDocument())
    expect(document.activeElement).toBe(trigger)
  })

  it('vibrates only after an incident report is accepted', async () => {
    const user = userEvent.setup()
    const vibrate = jest.fn()
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
    renderGuardDashboard('mission')

    await user.click((await screen.findAllByRole('button', { name: /report incident/i }))[0])
    await user.type(screen.getByRole('textbox', { name: /what happened/i }), 'A suspicious person is attempting to enter the assigned post.')
    await user.click(screen.getByRole('button', { name: 'Submit Report' }))

    await waitFor(() => expect(vibrate).toHaveBeenCalledWith(40))
  })
})
