import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PanicButton from '../PanicButton'
import { resolveLocationWithFallback } from '../../../utils/location'
import { enqueueOfflineAction } from '../../../utils/offlineQueue'
import { fetchJsonOrThrow } from '../../../utils/api'

jest.mock('../../../config', () => ({
  API_BASE_URL: 'https://example.test',
  detectRuntimePlatform: () => 'capacitor',
}))

jest.mock('../../../utils/location', () => ({
  resolveLocationWithFallback: jest.fn(async () => ({
    latitude: 7.123456,
    longitude: 125.654321,
    accuracyMeters: 9,
    heading: null,
    speedKph: null,
    source: 'capacitor',
  })),
}))

jest.mock('../../../utils/api', () => ({
  getAuthToken: () => 'token',
  fetchJsonOrThrow: jest.fn(async () => ({})),
  isOfflineRequestError: (error: unknown) =>
    error instanceof Error && error.message.toLowerCase().includes('offline'),
}))

jest.mock('../../../utils/offlineQueue', () => ({
  enqueueOfflineAction: jest.fn(async () => undefined),
}))

const mockedResolveLocationWithFallback = resolveLocationWithFallback as jest.MockedFunction<typeof resolveLocationWithFallback>
const mockedEnqueueOfflineAction = enqueueOfflineAction as jest.MockedFunction<typeof enqueueOfflineAction>
const mockedFetchJsonOrThrow = fetchJsonOrThrow as jest.MockedFunction<typeof fetchJsonOrThrow>

describe('PanicButton', () => {
  beforeEach(() => {
    mockedFetchJsonOrThrow.mockResolvedValue({})

    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      writable: true,
      value: {
        getCurrentPosition: jest.fn(),
      },
    })

    Object.defineProperty(globalThis.navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses shared location resolver instead of direct navigator geolocation', async () => {
    const user = userEvent.setup()

    render(<PanicButton userId="guard-1" userDisplayName="Guard One" />)

    await user.click(screen.getByRole('button', { name: /emergency sos/i }))

    await waitFor(() => {
      expect(mockedResolveLocationWithFallback).toHaveBeenCalledWith('capacitor')
    })

    expect((navigator.geolocation as Geolocation).getCurrentPosition).not.toHaveBeenCalled()

    expect(mockedFetchJsonOrThrow).toHaveBeenCalledTimes(1)

    const requestInit = mockedFetchJsonOrThrow.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(requestInit.body)) as { location: string }
    expect(body.location).toContain('7.123456, 125.654321')
  })

  it('queues SOS payload offline when incident post fails', async () => {
    const user = userEvent.setup()
    mockedFetchJsonOrThrow.mockRejectedValueOnce(new Error('offline'))

    render(<PanicButton userId="guard-1" userDisplayName="Guard One" />)

    await user.click(screen.getByRole('button', { name: /emergency sos/i }))

    await waitFor(() => {
      expect(mockedEnqueueOfflineAction).toHaveBeenCalledTimes(1)
    })

    const queuedPayload = mockedEnqueueOfflineAction.mock.calls[0][0]
    const queuedBody = queuedPayload.body as { location?: unknown }
    expect(queuedBody.location).toEqual(expect.any(String))
    expect(String(queuedBody.location)).toContain('7.123456, 125.654321')
  })

  it('does not queue authorization or validation failures as sent SOS alerts', async () => {
    const user = userEvent.setup()
    mockedFetchJsonOrThrow.mockRejectedValueOnce(new Error('Session expired. Please log in again.'))

    render(<PanicButton userId="guard-1" userDisplayName="Guard One" />)
    await user.click(screen.getByRole('button', { name: /emergency sos/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/session expired/i)
    expect(mockedEnqueueOfflineAction).not.toHaveBeenCalled()
  })
})
